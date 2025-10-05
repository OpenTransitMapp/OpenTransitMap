import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DefaultConsumerGroupManager,
  DefaultMessageProcessor,
  DefaultConnectionManager,
  ValkeyStreamsBus
} from '../valkey-bus.js';
import type { RedisClient } from '../redis-client.js';
import type { Logger } from 'pino';

// Test doubles
function createMockLogger(): Logger {
  return {
    debug: vi.fn() as any,
    info: vi.fn() as any,
    warn: vi.fn() as any,
    error: vi.fn() as any,
    child: vi.fn().mockReturnThis(),
    level: 'info',
    silent: vi.fn(),
    trace: vi.fn() as any,
    fatal: vi.fn() as any
  } as unknown as Logger;
}

function createMockRedisClient(): RedisClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    xaddJson: vi.fn().mockResolvedValue('1-0'),
    xgroupCreate: vi.fn().mockResolvedValue(undefined),
    xreadgroupNormalized: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1)
  };
}

describe('DefaultConsumerGroupManager', () => {
  let client: RedisClient;
  let logger: Logger;
  let manager: DefaultConsumerGroupManager;

  beforeEach(() => {
    client = createMockRedisClient();
    logger = createMockLogger();
    manager = new DefaultConsumerGroupManager(client, logger);
  });

  it('should create consumer group successfully', async () => {
    await manager.ensureGroupExists('test-stream', 'test-group');
    
    expect(client.xgroupCreate).toHaveBeenCalledWith('test-stream', 'test-group', '0', true);
    expect(logger.info).toHaveBeenCalledWith({ stream: 'test-stream', group: 'test-group' }, 'consumer group created');
  });

  it('should handle BUSYGROUP error gracefully', async () => {
    const error = new Error('BUSYGROUP Consumer Group name already exists');
    (client.xgroupCreate as any).mockRejectedValueOnce(error);
    
    await manager.ensureGroupExists('test-stream', 'test-group');
    
    expect(client.xgroupCreate).toHaveBeenCalledWith('test-stream', 'test-group', '0', true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should log warning and re-throw for non-BUSYGROUP errors', async () => {
    const error = new Error('Some other error');
    (client.xgroupCreate as any).mockRejectedValueOnce(error);
    
    await expect(manager.ensureGroupExists('test-stream', 'test-group')).rejects.toThrow('Some other error');
    
    expect(logger.warn).toHaveBeenCalledWith({ stream: 'test-stream', group: 'test-group', err: error }, 'xgroup create warning');
  });
});

describe('DefaultMessageProcessor', () => {
  let client: RedisClient;
  let logger: Logger;
  let processor: DefaultMessageProcessor<any>;

  beforeEach(() => {
    client = createMockRedisClient();
    logger = createMockLogger();
    processor = new DefaultMessageProcessor(client, logger);
  });

  it('should process message successfully', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    
    const result = await processor.processMessage(
      'test-stream',
      'test-group',
      '1-0',
      '{"type":"test","data":"hello"}',
      handler
    );
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('1-0');
    expect(handler).toHaveBeenCalledWith({ type: 'test', data: 'hello' });
    expect(client.xack).toHaveBeenCalledWith('test-stream', 'test-group', '1-0');
  });

  it('should handle handler errors gracefully', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));
    
    const result = await processor.processMessage(
      'test-stream',
      'test-group',
      '1-0',
      '{"type":"test","data":"hello"}',
      handler
    );
    
    expect(result.success).toBe(false);
    expect(result.messageId).toBe('1-0');
    expect(result.error).toBeInstanceOf(Error);
    expect(client.xack).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should handle JSON parse errors', async () => {
    const handler = vi.fn();
    
    const result = await processor.processMessage(
      'test-stream',
      'test-group',
      '1-0',
      'invalid-json',
      handler
    );
    
    expect(result.success).toBe(false);
    expect(result.messageId).toBe('1-0');
    expect(result.error).toBeInstanceOf(Error);
    expect(handler).not.toHaveBeenCalled();
    expect(client.xack).not.toHaveBeenCalled();
  });
});

describe('DefaultConnectionManager', () => {
  let client: RedisClient;
  let logger: Logger;
  let manager: DefaultConnectionManager;

  beforeEach(() => {
    client = createMockRedisClient();
    logger = createMockLogger();
    manager = new DefaultConnectionManager(client, logger);
  });

  it('should connect successfully', async () => {
    await manager.ensureConnected();
    
    expect(client.connect).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({}, 'Valkey client connected');
  });

  it('should check health successfully', async () => {
    const healthy = await manager.isHealthy();
    
    expect(healthy).toBe(true);
    expect(client.ping).toHaveBeenCalled();
  });

  it('should return false for health check failures', async () => {
    (client.ping as any).mockRejectedValueOnce(new Error('Connection failed'));
    
    const healthy = await manager.isHealthy();
    
    expect(healthy).toBe(false);
  });

  it('should shutdown gracefully', async () => {
    await manager.shutdown();
    
    expect(client.quit).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({}, 'Valkey client disconnected');
  });
});

describe('ValkeyStreamsBus Integration', () => {
  let client: RedisClient;
  let logger: Logger;

  beforeEach(() => {
    client = createMockRedisClient();
    logger = createMockLogger();
  });

  it('should create bus with default dependencies', () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    expect(bus).toBeInstanceOf(ValkeyStreamsBus);
    expect(bus.getActiveSubscriptionCount()).toBe(0);
  });

  it('should handle connection errors during subscription setup', async () => {
    // Reset the mock to ensure it's clean
    vi.clearAllMocks();
    
    // Mock the connect to reject
    (client.connect as any).mockRejectedValueOnce(new Error('Connection failed'));
    
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const unsubscribe = bus.subscribe('test-topic', 'group', 'consumer', vi.fn());
    
    // Wait a bit for the async setup to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check if the error was logged
    expect(logger.error).toHaveBeenCalledWith(
      { stream: 'test-topic', group: 'group', err: expect.any(Error) },
      'subscription setup failed'
    );
    
    unsubscribe();
  });

  it('should handle group creation errors during subscription setup', async () => {
    // Reset the mock to ensure it's clean
    vi.clearAllMocks();
    
    // Mock the xgroupCreate to reject
    (client.xgroupCreate as any).mockRejectedValueOnce(new Error('Group creation failed'));
    
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const unsubscribe = bus.subscribe('test-topic', 'group', 'consumer', vi.fn());
    
    // Wait a bit for the async setup to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check if the error was logged
    expect(logger.error).toHaveBeenCalledWith(
      { stream: 'test-topic', group: 'group', err: expect.any(Error) },
      'subscription setup failed'
    );
    
    unsubscribe();
  });

  it('should get subscription by ID', () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const unsubscribe = bus.subscribe('test-topic', 'group', 'consumer', vi.fn());
    
    const subscriptions = Array.from({ length: bus.getActiveSubscriptionCount() }, (_, i) => 
      bus.getSubscription(`sub-${i + 1}`)
    );
    
    expect(subscriptions.some(sub => sub !== undefined)).toBe(true);
    
    unsubscribe();
  });

  it('should return undefined for non-existent subscription ID', () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const subscription = bus.getSubscription('non-existent');
    
    expect(subscription).toBeUndefined();
  });
});
