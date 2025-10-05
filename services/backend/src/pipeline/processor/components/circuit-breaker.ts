import type { CircuitBreaker, CircuitBreakerState } from '../processor-types.js';
import type { Logger } from 'pino';

/**
 * Default implementation of circuit breaker.
 * 
 * Provides circuit breaker functionality to prevent cascading failures
 * by temporarily stopping execution when failure threshold is reached.
 * 
 * @class DefaultCircuitBreaker
 * @implements {CircuitBreaker}
 * @since 1.0.0
 */
export class DefaultCircuitBreaker implements CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;

  /**
   * Creates a new circuit breaker.
   * 
   * @param threshold - Number of consecutive failures before opening
   * @param timeoutMs - Timeout before attempting to close circuit
   * @param logger - Logger for circuit breaker events
   */
  constructor(
    private readonly threshold: number,
    private readonly timeoutMs: number,
    private readonly logger: Logger
  ) {}

  /**
   * Executes a function with circuit breaker protection.
   * 
   * @param fn - Function to execute
   * @param context - Context for error reporting
   * @returns Promise resolving to function result
   */
  async execute<T>(fn: () => Promise<T>, context: string): Promise<T> {
    if (this.state === 'open') {
      if (this.nextRetryTime && Date.now() < this.nextRetryTime.getTime()) {
        throw new Error(`Circuit breaker is open. Next retry at ${this.nextRetryTime.toISOString()}`);
      }
      
      // Move to half-open state
      this.state = 'half-open';
      this.logger.info({ context }, 'Circuit breaker moved to half-open state');
    }

    try {
      const result = await fn();
      
      // Success - reset failure count and close circuit if needed
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
        this.lastFailureTime = undefined;
        this.nextRetryTime = undefined;
        this.logger.info({ context }, 'Circuit breaker closed after successful execution');
      } else if (this.state === 'closed') {
        this.failureCount = 0;
      }

      return result;

    } catch (error) {
      this.handleFailure(context, error);
      throw error;
    }
  }

  /**
   * Gets the current state of the circuit breaker.
   * 
   * @returns Circuit breaker state
   */
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime
    };
  }

  /**
   * Handles a failure in the circuit breaker.
   * 
   * @param context - Context for error reporting
   * @param error - The error that occurred
   * @private
   */
  private handleFailure(context: string, error: any): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    this.logger.warn({
      context,
      error,
      failureCount: this.failureCount,
      threshold: this.threshold
    }, 'Circuit breaker failure recorded');

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      this.nextRetryTime = new Date(Date.now() + this.timeoutMs);
      
      this.logger.error({
        context,
        failureCount: this.failureCount,
        threshold: this.threshold,
        nextRetryTime: this.nextRetryTime.toISOString()
      }, 'Circuit breaker opened due to failure threshold');
    }
  }

  /**
   * Manually resets the circuit breaker to closed state.
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
    
    this.logger.info('Circuit breaker manually reset');
  }

  /**
   * Gets the current failure count.
   * 
   * @returns Current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Checks if the circuit breaker is currently open.
   * 
   * @returns True if circuit breaker is open
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Checks if the circuit breaker is currently closed.
   * 
   * @returns True if circuit breaker is closed
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Checks if the circuit breaker is currently half-open.
   * 
   * @returns True if circuit breaker is half-open
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open';
  }
}
