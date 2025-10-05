import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValkeyStreamsBus } from '../valkey-bus.js';
import type { RedisClient } from '../redis-client.js';
import type { Logger } from 'pino';

function createMockClient(): RedisClient & { __mocks: any } {
  const mocks = {
    connect: vi.fn().mockResolvedValue(undefined),
    xaddJson: vi.fn().mockResolvedValue('1-0'),
    xgroupCreate: vi.fn().mockResolvedValue(undefined),
    xreadgroupNormalized: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue('OK'),
    close: vi.fn().mockResolvedValue(undefined)
  };
  const client: any = { ...mocks };
  client.__mocks = mocks;
  return client as RedisClient & { __mocks: any };
}

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

describe('ValkeyStreamsBus', () => {
  let client: ReturnType<typeof createMockClient>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    client = createMockClient();
    logger = createMockLogger();
  });

  it('should publish messages successfully', async () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const result = await bus.publish('test-topic', { message: 'hello' });
    
    expect(result).toBe(true);
    expect(client.__mocks.xaddJson).toHaveBeenCalledWith('test-topic', { message: 'hello' }, 1000);
  });

  it('should handle publish errors gracefully', async () => {
    client.__mocks.xaddJson.mockRejectedValueOnce(new Error('Redis error'));
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const result = await bus.publish('test-topic', { message: 'hello' });
    
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should create subscription and return unsubscribe function', () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    const handler = vi.fn();
    
    const unsubscribe = bus.subscribe('test-topic', 'group', 'consumer', handler);
    
    expect(typeof unsubscribe).toBe('function');
    expect(bus.getActiveSubscriptionCount()).toBe(1);
    
    // Test unsubscribe
    unsubscribe();
    expect(bus.getActiveSubscriptionCount()).toBe(0);
  });

  it('should check health status', async () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const healthy = await bus.isHealthy();
    
    expect(healthy).toBe(true);
    expect(client.__mocks.ping).toHaveBeenCalled();
  });

  it('should handle health check failures', async () => {
    client.__mocks.ping.mockRejectedValueOnce(new Error('Connection failed'));
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    const healthy = await bus.isHealthy();
    
    expect(healthy).toBe(false);
  });

  it('should shutdown gracefully', async () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    // Add a subscription first
    bus.subscribe('test-topic', 'group', 'consumer', vi.fn());
    expect(bus.getActiveSubscriptionCount()).toBe(1);
    
    await bus.shutdown();
    
    expect(bus.getActiveSubscriptionCount()).toBe(0);
    expect(client.__mocks.quit).toHaveBeenCalled();
  });

  it('should track subscription count correctly', () => {
    const bus = new ValkeyStreamsBus(client, { maxLen: 1000, blockMs: 1000 }, logger);
    
    expect(bus.getActiveSubscriptionCount()).toBe(0);
    
    const unsubscribe1 = bus.subscribe('topic1', 'group1', 'consumer1', vi.fn());
    expect(bus.getActiveSubscriptionCount()).toBe(1);
    
    const unsubscribe2 = bus.subscribe('topic2', 'group2', 'consumer2', vi.fn());
    expect(bus.getActiveSubscriptionCount()).toBe(2);
    
    unsubscribe1();
    expect(bus.getActiveSubscriptionCount()).toBe(1);
    
    unsubscribe2();
    expect(bus.getActiveSubscriptionCount()).toBe(0);
  });
});
