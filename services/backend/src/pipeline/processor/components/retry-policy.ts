import type { RetryPolicy, RetryConfig } from '../processor-types.js';
import type { Logger } from 'pino';

/**
 * Default implementation of retry policy.
 * 
 * Provides configurable retry logic with exponential backoff for failed operations.
 * Supports both fixed and exponential backoff strategies.
 * 
 * @class DefaultRetryPolicy
 * @implements {RetryPolicy}
 * @since 1.0.0
 */
export class DefaultRetryPolicy implements RetryPolicy {
  /**
   * Creates a new retry policy.
   * 
   * @param config - Retry configuration
   * @param logger - Logger for retry events
   */
  constructor(
    private readonly config: RetryConfig,
    private readonly logger: Logger
  ) {}

  /**
   * Executes a function with retry logic.
   * 
   * @param fn - Function to execute
   * @param context - Context for error reporting
   * @returns Promise resolving to function result
   */
  async execute<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          this.logger.info({
            context,
            attempt: attempt + 1,
            totalAttempts: attempt + 1
          }, 'Operation succeeded after retry');
        }
        
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          this.logger.error({
            context,
            attempt: attempt + 1,
            totalAttempts: attempt + 1,
            error: lastError
          }, 'Operation failed after all retry attempts');
          break;
        }

        const delay = this.calculateDelay(attempt);
        
        this.logger.warn({
          context,
          attempt: attempt + 1,
          totalAttempts: this.config.maxRetries + 1,
          delayMs: delay,
          error: lastError
        }, 'Operation failed, retrying after delay');

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Gets the current retry configuration.
   * 
   * @returns Retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Calculates the delay for the next retry attempt.
   * 
   * @param attempt - Current attempt number (0-based)
   * @returns Delay in milliseconds
   * @private
   */
  private calculateDelay(attempt: number): number {
    if (this.config.exponentialBackoff) {
      // Exponential backoff: baseDelay * 2^attempt, capped at maxDelay
      const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt);
      return Math.min(exponentialDelay, this.config.maxDelayMs);
    } else {
      // Fixed delay
      return this.config.baseDelayMs;
    }
  }

  /**
   * Sleeps for the specified number of milliseconds.
   * 
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after the delay
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Creates a retry policy with the specified configuration.
 * 
 * @param config - Retry configuration
 * @param logger - Logger for retry events
 * @returns Retry policy instance
 * 
 * @example
 * ```typescript
 * const retryPolicy = createRetryPolicy({
 *   maxRetries: 3,
 *   baseDelayMs: 1000,
 *   maxDelayMs: 10000,
 *   exponentialBackoff: true
 * }, logger);
 * ```
 * 
 * @since 1.0.0
 */
export function createRetryPolicy(config: RetryConfig, logger: Logger): RetryPolicy {
  return new DefaultRetryPolicy(config, logger);
}
