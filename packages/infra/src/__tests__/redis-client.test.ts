import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Redis } from 'ioredis';
import { IoRedisClient, type NormalizedStream } from '../redis-client.js';
import { RedisMetrics } from '../metrics.js';
import client from 'prom-client';

function createMockLogger() {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;
}

function createMockRedis(overrides: Partial<Redis> = {}): Redis {
  const base: any = {
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    xadd: vi.fn(),
    xack: vi.fn().mockResolvedValue(1),
    xgroup: vi.fn(),
    xreadgroup: vi.fn(),
  };
  return Object.assign(base, overrides) as Redis;
}

describe('IoRedisClient', () => {
  let logger: any;
  let metrics: RedisMetrics;

  beforeEach(() => {
    // Clear the Prometheus registry to avoid metric name conflicts
    client.register.clear();
    logger = createMockLogger();
    metrics = new RedisMetrics('test');
    // Stub metric methods to capture calls without relying on prom-client state
    metrics.incPublished = vi.fn() as any;
    metrics.incConsumed = vi.fn() as any;
    metrics.incErrors = vi.fn() as any;
    metrics.observeReadBlockedSeconds = vi.fn() as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Lifecycle', () => {
    it('connect() should be idempotent and attach event listeners', async () => {
      const mock = createMockRedis();
      const client = new IoRedisClient(mock, { logger, metrics });
      
      // First call
      await client.connect();
      expect(mock.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mock.on).toHaveBeenCalledWith('end', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('redis: connecting');
      
      // Second call should not call on() again
      const onCallCount = (mock.on as any).mock.calls.length;
      await client.connect();
      expect(mock.on).toHaveBeenCalledTimes(onCallCount);
    });

    it('quit() should close connection and reset state', async () => {
      const mock = createMockRedis();
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.connect();
      await client.quit();
      
      expect(mock.quit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('redis: quitting');
    });

    it('close() should be an alias for quit()', async () => {
      const mock = createMockRedis();
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.connect();
      await client.close();
      
      expect(mock.quit).toHaveBeenCalled();
    });

    it('ping() should return server response and log debug info', async () => {
      const mock = createMockRedis({ ping: vi.fn().mockResolvedValue('PONG') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      const result = await client.ping();
      
      expect(result).toBe('PONG');
      expect(mock.ping).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ res: 'PONG' }, 'redis: ping');
    });
  });

  describe('xaddJson', () => {
    it('should publish JSON with MAXLEN ~ and return id', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1700000-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      const id = await client.xaddJson('events.normalized', { a: 1 }, 10);
      
      expect(id).toBe('1700000-0');
      expect(mock.xadd).toHaveBeenCalled();
      const args = (mock.xadd as any).mock.calls[0];
      expect(args[0]).toBe('events.normalized');
      expect(args).toContain('MAXLEN');
      expect(args).toContain('~');
      expect(args).toContain(10);
      expect(args).toContain('*');
      expect(args).toContain('json');
      expect(args).toContain('{"a":1}');
      expect(metrics.incPublished).toHaveBeenCalledWith({ stream: 'events.normalized' });
    });

    it('should publish JSON without MAXLEN when maxLenApprox is not provided', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1700000-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('events.normalized', { a: 1 });
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).not.toContain('MAXLEN');
      expect(args).toContain('*');
      expect(args).toContain('json');
      expect(args).toContain('{"a":1}');
    });

    it('should publish JSON without MAXLEN when maxLenApprox is 0', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1700000-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('events.normalized', { a: 1 }, 0);
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).not.toContain('MAXLEN');
    });

    it('should handle complex payloads correctly', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1700000-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      const complexPayload = { 
        nested: { value: 1 }, 
        array: [1, 2, 3], 
        nullValue: null,
        undefinedValue: undefined
      };
      
      await client.xaddJson('events.normalized', complexPayload, 100);
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).toContain(JSON.stringify(complexPayload));
    });

    it('should log debug info and record metrics on success', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1700000-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('events.normalized', { a: 1 });
      
      expect(logger.debug).toHaveBeenCalledWith({ stream: 'events.normalized' }, 'redis: xadd');
      expect(metrics.incPublished).toHaveBeenCalledWith({ stream: 'events.normalized' });
    });

    it('should handle errors and record error metrics', async () => {
      const error = new Error('Redis connection failed');
      const mock = createMockRedis({ xadd: vi.fn().mockRejectedValue(error) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await expect(client.xaddJson('events.normalized', { a: 1 })).rejects.toThrow('Redis connection failed');
      
      expect(metrics.incErrors).toHaveBeenCalledWith({ op: 'xadd', stream: 'events.normalized' });
      expect(logger.error).toHaveBeenCalledWith({ stream: 'events.normalized', err: error }, 'redis: xadd error');
    });
  });

  describe('xgroupCreate', () => {
    it('should create consumer group with default parameters', async () => {
      const mock = createMockRedis({ xgroup: vi.fn().mockResolvedValue('OK') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xgroupCreate('stream1', 'group1');
      
      expect(mock.xgroup).toHaveBeenCalledWith('CREATE', 'stream1', 'group1', '0', 'MKSTREAM');
      expect(logger.info).toHaveBeenCalledWith({ stream: 'stream1', group: 'group1' }, 'redis: xgroup create');
    });

    it('should create consumer group with custom parameters', async () => {
      const mock = createMockRedis({ xgroup: vi.fn().mockResolvedValue('OK') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xgroupCreate('stream1', 'group1', '123-0', false);
      
      expect(mock.xgroup).toHaveBeenCalledWith('CREATE', 'stream1', 'group1', '123-0');
    });

    it('should ignore BUSYGROUP error', async () => {
      const err: any = new Error('BUSYGROUP Consumer Group name already exists');
      const mock = createMockRedis({ 
        xgroup: vi.fn().mockImplementation((..._args) => {
          throw err;
        })
      });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await expect(client.xgroupCreate('s', 'g')).resolves.toBeUndefined();
      expect(metrics.incErrors).not.toHaveBeenCalled();
    });

    it('should handle other errors and record error metrics', async () => {
      const error = new Error('Stream does not exist');
      const mock = createMockRedis({ xgroup: vi.fn().mockRejectedValue(error) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await expect(client.xgroupCreate('s', 'g')).rejects.toThrow('Stream does not exist');
      
      expect(metrics.incErrors).toHaveBeenCalledWith({ op: 'xgroupCreate', stream: 's', group: 'g' });
      expect(logger.warn).toHaveBeenCalledWith({ stream: 's', group: 'g', err: error }, 'redis: xgroup create error');
    });
  });

  describe('xreadgroupNormalized', () => {
    it('should normalize response and record metrics', async () => {
      const rawReply = [
        [
          'stream1',
          [
            ['170-0', ['json', '{"v":1}', 'other', 'x']],
          ],
        ],
      ];
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(rawReply) });
      const client = new IoRedisClient(mock, { logger, metrics, defaultRead: { blockMs: 5, count: 10 } });
      
      const res = await client.xreadgroupNormalized('g', 'c', 'stream1', '>');
      
      expect(res).toBeTruthy();
      const ns = res as NormalizedStream[];
      expect(ns[0].name).toBe('stream1');
      expect(ns[0].messages[0].id).toBe('170-0');
      expect(ns[0].messages[0].message.json).toBe('{"v":1}');
      expect(ns[0].messages[0].message.other).toBe('x');
      expect(metrics.observeReadBlockedSeconds).toHaveBeenCalled();
      expect(metrics.incConsumed).toHaveBeenCalledWith({ stream: 'stream1', group: 'g', count: '1' });
    });

    it('should handle multiple messages in response', async () => {
      const rawReply = [
        [
          'stream1',
          [
            ['170-0', ['json', '{"v":1}']],
            ['170-1', ['json', '{"v":2}']],
            ['170-2', ['json', '{"v":3}']],
          ],
        ],
      ];
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(rawReply) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      const res = await client.xreadgroupNormalized('g', 'c', 'stream1', '>');
      
      expect(res).toBeTruthy();
      const ns = res as NormalizedStream[];
      expect(ns[0].messages).toHaveLength(3);
      expect(ns[0].messages[0].id).toBe('170-0');
      expect(ns[0].messages[1].id).toBe('170-1');
      expect(ns[0].messages[2].id).toBe('170-2');
      expect(metrics.incConsumed).toHaveBeenCalledWith({ stream: 'stream1', group: 'g', count: '3' });
    });

    it('should return null when no messages available', async () => {
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(null) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      const res = await client.xreadgroupNormalized('g', 'c', 'stream1', '>');
      
      expect(res).toBeNull();
      expect(metrics.incConsumed).not.toHaveBeenCalled();
    });

    it('should use default read options when not provided', async () => {
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(null) });
      const client = new IoRedisClient(mock, { logger, metrics, defaultRead: { blockMs: 100, count: 5 } });
      
      await client.xreadgroupNormalized('g', 'c', 'stream1', '>');
      
      const args = (mock.xreadgroup as any).mock.calls[0];
      expect(args).toContain('BLOCK');
      expect(args).toContain(100);
      expect(args).toContain('COUNT');
      expect(args).toContain(5);
    });

    it('should use provided read options over defaults', async () => {
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(null) });
      const client = new IoRedisClient(mock, { logger, metrics, defaultRead: { blockMs: 100, count: 5 } });
      
      await client.xreadgroupNormalized('g', 'c', 'stream1', '>', { BLOCK: 200, COUNT: 10 });
      
      const args = (mock.xreadgroup as any).mock.calls[0];
      expect(args).toContain('BLOCK');
      expect(args).toContain(200);
      expect(args).toContain('COUNT');
      expect(args).toContain(10);
    });

    it('should handle partial read options', async () => {
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(null) });
      const client = new IoRedisClient(mock, { logger, metrics, defaultRead: { blockMs: 100, count: 5 } });
      
      await client.xreadgroupNormalized('g', 'c', 'stream1', '>', { BLOCK: 200 });
      
      const args = (mock.xreadgroup as any).mock.calls[0];
      expect(args).toContain('BLOCK');
      expect(args).toContain(200);
      expect(args).toContain('COUNT');
      expect(args).toContain(5); // Should use default
    });

    it('should log debug info when messages are received', async () => {
      const rawReply = [
        [
          'stream1',
          [
            ['170-0', ['json', '{"v":1}']],
            ['170-1', ['json', '{"v":2}']],
          ],
        ],
      ];
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(rawReply) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xreadgroupNormalized('g', 'c', 'stream1', '>');
      
      expect(logger.debug).toHaveBeenCalledWith({ count: 2 }, 'redis: xreadgroup');
    });

    it('should not log debug info when no messages received', async () => {
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(null) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xreadgroupNormalized('g', 'c', 'stream1', '>');
      
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should measure read blocked time correctly', async () => {
      const rawReply = [
        [
          'stream1',
          [
            ['170-0', ['json', '{"v":1}']],
          ],
        ],
      ];
      const mock = createMockRedis({ xreadgroup: vi.fn().mockResolvedValue(rawReply) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xreadgroupNormalized('g', 'c', 'stream1', '>');
      
      expect(metrics.observeReadBlockedSeconds).toHaveBeenCalledWith(
        expect.any(Number),
        { stream: 'stream1', group: 'g' }
      );
    });
  });

  describe('xack', () => {
    it('should acknowledge messages successfully', async () => {
      const mock = createMockRedis({ xack: vi.fn().mockResolvedValue(1) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      const result = await client.xack('s', 'g', '1-0');
      
      expect(result).toBe(1);
      expect(mock.xack).toHaveBeenCalledWith('s', 'g', '1-0');
      expect(logger.debug).toHaveBeenCalledWith({ stream: 's' }, 'redis: xack');
    });

    it('should handle xack errors and record error metrics', async () => {
      const error = new Error('Message not found');
      const mock = createMockRedis({ xack: vi.fn().mockRejectedValue(error) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await expect(client.xack('s', 'g', '1-0')).rejects.toThrow('Message not found');
      
      expect(metrics.incErrors).toHaveBeenCalledWith({ op: 'xack', stream: 's', group: 'g' });
      expect(logger.warn).toHaveBeenCalledWith({ stream: 's', group: 'g', err: error }, 'redis: xack error');
    });
  });

  describe('Error Handling and Metrics', () => {
    it('should record error metrics for xadd failures', async () => {
      const error = new Error('Connection lost');
      const mock = createMockRedis({ xadd: vi.fn().mockRejectedValue(error) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await expect(client.xaddJson('stream', { data: 1 })).rejects.toThrow('Connection lost');
      
      expect(metrics.incErrors).toHaveBeenCalledWith({ op: 'xadd', stream: 'stream' });
    });

    it('should record error metrics for xgroupCreate failures (non-BUSYGROUP)', async () => {
      const error = new Error('Stream not found');
      const mock = createMockRedis({ xgroup: vi.fn().mockRejectedValue(error) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await expect(client.xgroupCreate('stream', 'group')).rejects.toThrow('Stream not found');
      
      expect(metrics.incErrors).toHaveBeenCalledWith({ op: 'xgroupCreate', stream: 'stream', group: 'group' });
    });

    it('should not record error metrics for BUSYGROUP errors', async () => {
      const error = new Error('BUSYGROUP Consumer Group name already exists');
      const mock = createMockRedis({ 
        xgroup: vi.fn().mockImplementation((..._args) => {
          throw error;
        })
      });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await expect(client.xgroupCreate('stream', 'group')).resolves.toBeUndefined();
      
      expect(metrics.incErrors).not.toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log connection events', async () => {
      const mock = createMockRedis();
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.connect();
      
      expect(logger.info).toHaveBeenCalledWith('redis: connecting');
    });

    it('should log quit events', async () => {
      const mock = createMockRedis();
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.quit();
      
      expect(logger.info).toHaveBeenCalledWith('redis: quitting');
    });

    it('should log ping responses', async () => {
      const mock = createMockRedis({ ping: vi.fn().mockResolvedValue('PONG') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.ping();
      
      expect(logger.debug).toHaveBeenCalledWith({ res: 'PONG' }, 'redis: ping');
    });

    it('should log xadd operations', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('stream', { data: 1 });
      
      expect(logger.debug).toHaveBeenCalledWith({ stream: 'stream' }, 'redis: xadd');
    });

    it('should log xgroup create operations', async () => {
      const mock = createMockRedis({ xgroup: vi.fn().mockResolvedValue('OK') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xgroupCreate('stream', 'group');
      
      expect(logger.info).toHaveBeenCalledWith({ stream: 'stream', group: 'group' }, 'redis: xgroup create');
    });

    it('should log xack operations', async () => {
      const mock = createMockRedis({ xack: vi.fn().mockResolvedValue(1) });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xack('stream', 'group', '1-0');
      
      expect(logger.debug).toHaveBeenCalledWith({ stream: 'stream' }, 'redis: xack');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty payload in xaddJson', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('stream', {});
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).toContain('{}');
    });

    it('should handle null payload in xaddJson', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('stream', null);
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).toContain('null');
    });

    it('should handle undefined payload in xaddJson', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('stream', undefined);
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).toContain(undefined);
    });

    it('should handle negative maxLenApprox in xaddJson', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('stream', { data: 1 }, -5);
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).not.toContain('MAXLEN');
    });

    it('should handle very large maxLenApprox in xaddJson', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('stream', { data: 1 }, 1000000);
      
      const args = (mock.xadd as any).mock.calls[0];
      expect(args).toContain('MAXLEN');
      expect(args).toContain('~');
      expect(args).toContain(1000000);
    });

    it('should handle empty stream name in xaddJson', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('', { data: 1 });
      
      expect(mock.xadd).toHaveBeenCalledWith('', expect.any(String), 'json', expect.any(String));
    });

    it('should handle special characters in stream names', async () => {
      const mock = createMockRedis({ xadd: vi.fn().mockResolvedValue('1-0') });
      const client = new IoRedisClient(mock, { logger, metrics });
      
      await client.xaddJson('stream:with:colons', { data: 1 });
      
      expect(mock.xadd).toHaveBeenCalledWith('stream:with:colons', expect.any(String), 'json', expect.any(String));
    });
  });
});

