import type { ProcessorMetrics, VehicleStateStats, ProcessorMetricsSummary } from './processor-types.js';
import type { Logger } from 'pino';

/**
 * Default implementation of processor metrics.
 * 
 * Collects and logs metrics about processor performance and state.
 * Can be extended to integrate with external monitoring systems.
 * 
 * @class DefaultProcessorMetrics
 * @implements {ProcessorMetrics}
 * @since 1.0.0
 */
export class DefaultProcessorMetrics implements ProcessorMetrics {
  private readonly logger: Logger;
  private readonly enableMetrics: boolean;

  // Counters
  private eventsProcessed = 0;
  private eventsProcessedSuccess = 0;
  private eventsProcessedError = 0;
  private frameComputations = 0;
  private totalProcessingTimeMs = 0;
  private totalFrameComputationTimeMs = 0;

  // Error tracking
  private errorCounts = new Map<string, number>();

  // State tracking
  private lastStateStats?: VehicleStateStats;
  private lastStateStatsTime?: Date;

  /**
   * Creates a new processor metrics collector.
   * 
   * @param logger - Logger for metrics events
   * @param enableMetrics - Whether to enable metrics collection
   */
  constructor(logger: Logger, enableMetrics: boolean = true) {
    this.logger = logger;
    this.enableMetrics = enableMetrics;
  }

  /**
   * Records a processed event.
   * 
   * @param eventType - Type of event processed
   * @param success - Whether processing was successful
   * @param processingTimeMs - Processing time in milliseconds
   */
  recordEventProcessed(eventType: string, success: boolean, processingTimeMs: number): void {
    if (!this.enableMetrics) return;

    this.eventsProcessed++;
    this.totalProcessingTimeMs += processingTimeMs;

    if (success) {
      this.eventsProcessedSuccess++;
    } else {
      this.eventsProcessedError++;
    }

    this.logger.debug({
      eventType,
      success,
      processingTimeMs,
      totalEvents: this.eventsProcessed,
      successRate: this.getSuccessRate()
    }, 'Event processed');
  }

  /**
   * Records a frame computation.
   * 
   * @param cityId - City identifier
   * @param scopesProcessed - Number of scopes processed
   * @param vehiclesIncluded - Number of vehicles included
   * @param processingTimeMs - Processing time in milliseconds
   */
  recordFrameComputation(cityId: string, scopesProcessed: number, vehiclesIncluded: number, processingTimeMs: number): void {
    if (!this.enableMetrics) return;

    this.frameComputations++;
    this.totalFrameComputationTimeMs += processingTimeMs;

    this.logger.debug({
      cityId,
      scopesProcessed,
      vehiclesIncluded,
      processingTimeMs,
      totalFrameComputations: this.frameComputations,
      averageFrameComputationTime: this.getAverageFrameComputationTime()
    }, 'Frame computation completed');
  }

  /**
   * Records an error.
   * 
   * @param errorType - Type of error
   * @param context - Error context
   */
  recordError(errorType: string, context: Record<string, any>): void {
    if (!this.enableMetrics) return;

    const currentCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, currentCount + 1);

    this.logger.warn({
      errorType,
      errorCount: currentCount + 1,
      context
    }, 'Error recorded');
  }

  /**
   * Records state statistics.
   * 
   * @param stats - State statistics
   */
  recordStateStats(stats: VehicleStateStats): void {
    if (!this.enableMetrics) return;

    this.lastStateStats = stats;
    this.lastStateStatsTime = new Date();

    this.logger.debug({
      ...stats,
      timestamp: this.lastStateStatsTime.toISOString()
    }, 'State statistics recorded');
  }

  /**
   * Gets the current success rate.
   * 
   * @returns Success rate as a percentage
   */
  getSuccessRate(): number {
    if (this.eventsProcessed === 0) return 0;
    return (this.eventsProcessedSuccess / this.eventsProcessed) * 100;
  }

  /**
   * Gets the average processing time per event.
   * 
   * @returns Average processing time in milliseconds
   */
  getAverageProcessingTime(): number {
    if (this.eventsProcessed === 0) return 0;
    return this.totalProcessingTimeMs / this.eventsProcessed;
  }

  /**
   * Gets the average frame computation time.
   * 
   * @returns Average frame computation time in milliseconds
   */
  getAverageFrameComputationTime(): number {
    if (this.frameComputations === 0) return 0;
    return this.totalFrameComputationTimeMs / this.frameComputations;
  }

  /**
   * Gets error counts by type.
   * 
   * @returns Map of error type to count
   */
  getErrorCounts(): Map<string, number> {
    return new Map(this.errorCounts);
  }

  /**
   * Gets the last recorded state statistics.
   * 
   * @returns Last state statistics or undefined
   */
  getLastStateStats(): VehicleStateStats | undefined {
    return this.lastStateStats;
  }

  /**
   * Gets the timestamp of the last state statistics.
   * 
   * @returns Last state statistics timestamp or undefined
   */
  getLastStateStatsTime(): Date | undefined {
    return this.lastStateStatsTime;
  }

  /**
   * Gets a summary of all metrics.
   * 
   * @returns Metrics summary
   */
  getSummary(): ProcessorMetricsSummary {
    return {
      eventsProcessed: this.eventsProcessed,
      eventsProcessedSuccess: this.eventsProcessedSuccess,
      eventsProcessedError: this.eventsProcessedError,
      successRate: this.getSuccessRate(),
      averageProcessingTime: this.getAverageProcessingTime(),
      frameComputations: this.frameComputations,
      averageFrameComputationTime: this.getAverageFrameComputationTime(),
      errorCounts: Object.fromEntries(this.errorCounts),
      lastStateStats: this.lastStateStats,
      lastStateStatsTime: this.lastStateStatsTime
    };
  }

  /**
   * Resets all metrics.
   */
  reset(): void {
    this.eventsProcessed = 0;
    this.eventsProcessedSuccess = 0;
    this.eventsProcessedError = 0;
    this.frameComputations = 0;
    this.totalProcessingTimeMs = 0;
    this.totalFrameComputationTimeMs = 0;
    this.errorCounts.clear();
    this.lastStateStats = undefined;
    this.lastStateStatsTime = undefined;

    this.logger.info('Processor metrics reset');
  }
}

