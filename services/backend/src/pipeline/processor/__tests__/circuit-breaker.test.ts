import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultCircuitBreaker } from '../components/circuit-breaker.js';
import { createMockLogger } from '../../../__tests__/test-utils.js';

describe('DefaultCircuitBreaker', () => {
  let circuitBreaker: DefaultCircuitBreaker;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    circuitBreaker = new DefaultCircuitBreaker(3, 1000, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with closed state', () => {
      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeUndefined();
      expect(state.nextRetryTime).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should execute function successfully in closed state', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const context = 'test-context';

      const result = await circuitBreaker.execute(mockFn, context);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState().state).toBe('closed');
    });

    it('should reset failure count on successful execution', async () => {
      // First, cause some failures
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      try {
        await circuitBreaker.execute(failingFn, context);
      } catch {
        // Expected to fail
      }

      expect(circuitBreaker.getFailureCount()).toBe(1);

      // Then succeed
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn, context);

      expect(circuitBreaker.getFailureCount()).toBe(0);
      expect(circuitBreaker.getState().state).toBe('closed');
    });

    it('should open circuit after threshold failures', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      // Execute failing function up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState().state).toBe('open');
      expect(circuitBreaker.getFailureCount()).toBe(3);
      expect(circuitBreaker.getState().nextRetryTime).toBeDefined();
    });

    it('should throw error when circuit is open and not ready for retry', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState().state).toBe('open');

      // Try to execute while circuit is open
      const successFn = vi.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(successFn, context)).rejects.toThrow(
        'Circuit breaker is open'
      );
      expect(successFn).not.toHaveBeenCalled();
    });

    it('should move to half-open state after timeout', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      const successFn = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successFn, context);

      expect(result).toBe('success');
      expect(circuitBreaker.getState().state).toBe('closed');
      expect(successFn).toHaveBeenCalledTimes(1);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should close circuit after successful execution in half-open state', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for timeout and move to half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn, context);

      expect(circuitBreaker.getState().state).toBe('closed');
      expect(circuitBreaker.getFailureCount()).toBe(0);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should re-open circuit if half-open execution fails', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for timeout and move to half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      // Try to execute but fail again
      const stillFailingFn = vi.fn().mockRejectedValue(new Error('still failing'));
      
      try {
        await circuitBreaker.execute(stillFailingFn, context);
      } catch {
        // Expected to fail
      }

      expect(circuitBreaker.getState().state).toBe('open');
      expect(circuitBreaker.getFailureCount()).toBe(4);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should log appropriate messages for state transitions', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const successFn = vi.fn().mockResolvedValue('success');
      const context = 'test-context';

      // Cause failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          error: expect.any(Error),
          failureCount: 3,
          threshold: 3
        }),
        'Circuit breaker failure recorded'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          failureCount: 3,
          threshold: 3,
          nextRetryTime: expect.any(String)
        }),
        'Circuit breaker opened due to failure threshold'
      );

      // Wait for timeout and succeed
      await new Promise(resolve => setTimeout(resolve, 1100));
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      await circuitBreaker.execute(successFn, context);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { context },
        'Circuit breaker moved to half-open state'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        { context },
        'Circuit breaker closed after successful execution'
      );

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('getState', () => {
    it('should return current state information', () => {
      const state = circuitBreaker.getState();
      
      expect(state).toEqual({
        state: 'closed',
        failureCount: 0,
        lastFailureTime: undefined,
        nextRetryTime: undefined
      });
    });

    it('should return updated state after failures', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      try {
        await circuitBreaker.execute(failingFn, context);
      } catch {
        // Expected to fail
      }

      const state = circuitBreaker.getState();
      expect(state.failureCount).toBe(1);
      expect(state.lastFailureTime).toBeDefined();
      expect(state.state).toBe('closed');
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to closed state', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState().state).toBe('open');

      // Reset
      circuitBreaker.reset();

      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeUndefined();
      expect(state.nextRetryTime).toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker manually reset'
      );
    });
  });

  describe('getFailureCount', () => {
    it('should return current failure count', () => {
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should return updated failure count after failures', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      try {
        await circuitBreaker.execute(failingFn, context);
      } catch {
        // Expected to fail
      }

      expect(circuitBreaker.getFailureCount()).toBe(1);
    });
  });

  describe('state check methods', () => {
    it('should correctly identify closed state', () => {
      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.isHalfOpen()).toBe(false);
    });

    it('should correctly identify open state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.isOpen()).toBe(true);
      expect(circuitBreaker.isClosed()).toBe(false);
      expect(circuitBreaker.isHalfOpen()).toBe(false);
    });

    it('should correctly identify half-open state', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn, context);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.isOpen()).toBe(true);

      // Wait for timeout and move to half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      // This should move to half-open state
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn, context);

      // After successful execution, it should be closed again
      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.isHalfOpen()).toBe(false);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('edge cases', () => {
    it('should handle threshold of 1', () => {
      const singleThresholdBreaker = new DefaultCircuitBreaker(1, 1000, mockLogger);
      expect(singleThresholdBreaker.getState().state).toBe('closed');
    });

    it('should handle very short timeout', async () => {
      const shortTimeoutBreaker = new DefaultCircuitBreaker(1, 10, mockLogger);
      const failingFn = vi.fn().mockRejectedValue(new Error('test error'));
      const context = 'test-context';

      try {
        await shortTimeoutBreaker.execute(failingFn, context);
      } catch {
        // Expected to fail
      }

      expect(shortTimeoutBreaker.getState().state).toBe('open');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 20));

      const successFn = vi.fn().mockResolvedValue('success');
      const result = await shortTimeoutBreaker.execute(successFn, context);

      expect(result).toBe('success');
      expect(shortTimeoutBreaker.getState().state).toBe('closed');
    });
  });
});