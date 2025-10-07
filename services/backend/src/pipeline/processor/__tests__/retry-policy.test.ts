import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultRetryPolicy, createRetryPolicy } from '../components/retry-policy.js';
import { createMockLogger } from '../../../__tests__/test-utils.js';
import type { RetryConfig } from '../processor-types.js';

describe('DefaultRetryPolicy', () => {
  let retryPolicy: DefaultRetryPolicy;
  let mockLogger: any;
  let config: RetryConfig;

  beforeEach(() => {
    mockLogger = createMockLogger();
    config = {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      exponentialBackoff: true
    };
    retryPolicy = new DefaultRetryPolicy(config, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      const retryConfig = retryPolicy.getConfig();
      expect(retryConfig).toEqual(config);
    });
  });

  describe('execute', () => {
    it('should execute function successfully on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const context = 'test-context';

      const result = await retryPolicy.execute(mockFn, context);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('first failure'))
        .mockRejectedValueOnce(new Error('second failure'))
        .mockResolvedValueOnce('success');
      const context = 'test-context';

      const result = await retryPolicy.execute(mockFn, context);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should retry up to maxRetries and then throw error', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('persistent failure'));
      const context = 'test-context';

      await expect(retryPolicy.execute(mockFn, context)).rejects.toThrow('persistent failure');
      expect(mockFn).toHaveBeenCalledTimes(4); // maxRetries + 1
    });

    it('should use exponential backoff when enabled', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
      const context = 'test-context';

      const startTime = Date.now();
      
      try {
        await retryPolicy.execute(mockFn, context);
      } catch {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // With exponential backoff: 100ms + 200ms + 400ms = 700ms minimum
      expect(totalTime).toBeGreaterThanOrEqual(700);
      expect(mockFn).toHaveBeenCalledTimes(4);
    });

    it('should use fixed delay when exponential backoff is disabled', async () => {
      const fixedDelayConfig: RetryConfig = {
        maxRetries: 2,
        baseDelayMs: 50,
        maxDelayMs: 1000,
        exponentialBackoff: false
      };
      const fixedDelayPolicy = new DefaultRetryPolicy(fixedDelayConfig, mockLogger);
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
      const context = 'test-context';

      const startTime = Date.now();
      
      try {
        await fixedDelayPolicy.execute(mockFn, context);
      } catch {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // With fixed delay: 50ms + 50ms = 100ms minimum
      expect(totalTime).toBeGreaterThanOrEqual(100);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should cap delay at maxDelayMs', async () => {
      const cappedConfig: RetryConfig = {
        maxRetries: 5,
        baseDelayMs: 100,
        maxDelayMs: 200, // Low cap
        exponentialBackoff: true
      };
      const cappedPolicy = new DefaultRetryPolicy(cappedConfig, mockLogger);
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
      const context = 'test-context';

      const startTime = Date.now();
      
      try {
        await cappedPolicy.execute(mockFn, context);
      } catch {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should be capped at 200ms per delay
      expect(totalTime).toBeLessThan(2000); // 6 * 200ms max
      expect(mockFn).toHaveBeenCalledTimes(6);
    });

    it('should handle zero maxRetries', async () => {
      const zeroRetryConfig: RetryConfig = {
        maxRetries: 0,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        exponentialBackoff: true
      };
      const zeroRetryPolicy = new DefaultRetryPolicy(zeroRetryConfig, mockLogger);
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
      const context = 'test-context';

      await expect(zeroRetryPolicy.execute(mockFn, context)).rejects.toThrow('failure');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should log appropriate messages for retries', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('first failure'))
        .mockRejectedValueOnce(new Error('second failure'))
        .mockResolvedValueOnce('success');
      const context = 'test-context';

      await retryPolicy.execute(mockFn, context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          attempt: 1,
          totalAttempts: 4,
          delayMs: 100,
          error: expect.any(Error)
        }),
        'Operation failed, retrying after delay'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          attempt: 2,
          totalAttempts: 4,
          delayMs: 200,
          error: expect.any(Error)
        }),
        'Operation failed, retrying after delay'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          attempt: 3,
          totalAttempts: 3
        }),
        'Operation succeeded after retry'
      );
    });

    it('should log error message when all retries are exhausted', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('persistent failure'));
      const context = 'test-context';

      try {
        await retryPolicy.execute(mockFn, context);
      } catch {
        // Expected to fail
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          attempt: 4,
          totalAttempts: 4,
          error: expect.any(Error)
        }),
        'Operation failed after all retry attempts'
      );
    });

    it('should not log retry message on first attempt success', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const context = 'test-context';

      await retryPolicy.execute(mockFn, context);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');
      const context = 'test-context';

      await expect(retryPolicy.execute(mockFn, context)).rejects.toThrow('string error');
      expect(mockFn).toHaveBeenCalledTimes(4);
    });

    it('should handle null/undefined exceptions', async () => {
      const mockFn = vi.fn().mockRejectedValue(null);
      const context = 'test-context';

      await expect(retryPolicy.execute(mockFn, context)).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(4);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const retryConfig = retryPolicy.getConfig();
      
      expect(retryConfig).toEqual(config);
      expect(retryConfig).not.toBe(config); // Should be a copy
    });

    it('should not affect original config when returned config is modified', () => {
      const retryConfig = retryPolicy.getConfig();
      retryConfig.maxRetries = 999;

      const originalConfig = retryPolicy.getConfig();
      expect(originalConfig.maxRetries).toBe(3);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential delays correctly', () => {
      const policy = new DefaultRetryPolicy({
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        exponentialBackoff: true
      }, mockLogger);

      // Access private method through any cast for testing
      const calculateDelay = (policy as any).calculateDelay.bind(policy);

      expect(calculateDelay(0)).toBe(100);  // 100 * 2^0 = 100
      expect(calculateDelay(1)).toBe(200);  // 100 * 2^1 = 200
      expect(calculateDelay(2)).toBe(400);  // 100 * 2^2 = 400
      expect(calculateDelay(3)).toBe(800);  // 100 * 2^3 = 800
    });

    it('should cap exponential delays at maxDelayMs', () => {
      const policy = new DefaultRetryPolicy({
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 300,
        exponentialBackoff: true
      }, mockLogger);

      const calculateDelay = (policy as any).calculateDelay.bind(policy);

      expect(calculateDelay(0)).toBe(100);  // 100 * 2^0 = 100
      expect(calculateDelay(1)).toBe(200);  // 100 * 2^1 = 200
      expect(calculateDelay(2)).toBe(300);  // 100 * 2^2 = 400, capped at 300
      expect(calculateDelay(3)).toBe(300);  // 100 * 2^3 = 800, capped at 300
    });

    it('should use fixed delay when exponential backoff is disabled', () => {
      const policy = new DefaultRetryPolicy({
        maxRetries: 3,
        baseDelayMs: 150,
        maxDelayMs: 1000,
        exponentialBackoff: false
      }, mockLogger);

      const calculateDelay = (policy as any).calculateDelay.bind(policy);

      expect(calculateDelay(0)).toBe(150);
      expect(calculateDelay(1)).toBe(150);
      expect(calculateDelay(2)).toBe(150);
      expect(calculateDelay(3)).toBe(150);
    });
  });

  describe('edge cases', () => {
    it('should handle very small delays', async () => {
      const smallDelayConfig: RetryConfig = {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 10,
        exponentialBackoff: true
      };
      const smallDelayPolicy = new DefaultRetryPolicy(smallDelayConfig, mockLogger);
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
      const context = 'test-context';

      const startTime = Date.now();
      
      try {
        await smallDelayPolicy.execute(mockFn, context);
      } catch {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete quickly with small delays
      expect(totalTime).toBeLessThan(100);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should handle very large maxRetries', async () => {
      const largeRetryConfig: RetryConfig = {
        maxRetries: 10,
        baseDelayMs: 1,
        maxDelayMs: 2,
        exponentialBackoff: false
      };
      const largeRetryPolicy = new DefaultRetryPolicy(largeRetryConfig, mockLogger);
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
      const context = 'test-context';

      try {
        await largeRetryPolicy.execute(mockFn, context);
      } catch {
        // Expected to fail
      }

      expect(mockFn).toHaveBeenCalledTimes(11); // maxRetries + 1
    });
  });
});

describe('createRetryPolicy', () => {
  it('should create a retry policy with the specified configuration', () => {
    const mockLogger = createMockLogger();
    const config: RetryConfig = {
      maxRetries: 5,
      baseDelayMs: 200,
      maxDelayMs: 2000,
      exponentialBackoff: true
    };

    const retryPolicy = createRetryPolicy(config, mockLogger);

    expect(retryPolicy).toBeInstanceOf(DefaultRetryPolicy);
    expect(retryPolicy.getConfig()).toEqual(config);
  });
});
