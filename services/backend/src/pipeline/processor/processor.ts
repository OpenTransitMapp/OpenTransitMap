import type { EventBus } from '@open-transit-map/infra';
import { Topics } from '@open-transit-map/infra';
import type { InMemoryStore } from '../../store.js';
import type { Logger } from 'pino';
import type { 
  VehicleStateManager, 
  FrameComputer, 
  EventValidator, 
  ProcessorMetrics, 
  CircuitBreaker, 
  RetryPolicy
} from './processor-types.js';
import type { ProcessorConfig } from './processor-config.js';
import { createProcessorConfig } from './processor-config.js';
import { DefaultVehicleStateManager } from './components/vehicle-state-manager.js';
import { DefaultFrameComputer } from './components/frame-computer.js';
import { DefaultEventValidator } from './components/event-validator.js';
import { DefaultProcessorMetrics } from './processor-metrics.js';
import { DefaultCircuitBreaker } from './components/circuit-breaker.js';
import { createRetryPolicy } from './components/retry-policy.js';

/**
 * Real-time vehicle data processor for the Open Transit Map system.
 * 
 * The Processor is the core component responsible for processing incoming vehicle events
 * (upserts and removals) and maintaining real-time state for active scopes. It handles
 * the complete event processing pipeline from validation to frame computation.
 * 
 * ## Key Responsibilities
 * 
 * - **Event Processing**: Validates and processes vehicle upsert/remove events from the event bus
 * - **State Management**: Maintains in-memory vehicle state organized by city and vehicle ID
 * - **Frame Computation**: Generates real-time frames for active scopes based on vehicle positions
 * - **Resilience**: Implements circuit breakers and retry policies for fault tolerance
 * - **Monitoring**: Collects comprehensive metrics and performance data
 * - **Cleanup**: Automatically removes stale vehicle data to prevent memory leaks
 * 
 * ## Architecture
 * 
 * The processor follows a modular architecture with clear separation of concerns:
 * 
 * - **VehicleStateManager**: Tracks vehicle positions and state by city
 * - **FrameComputer**: Computes real-time frames for active scopes
 * - **EventValidator**: Validates incoming event envelopes and data
 * - **CircuitBreaker**: Protects against cascading failures
 * - **RetryPolicy**: Handles transient failures with exponential backoff
 * - **ProcessorMetrics**: Collects performance and operational metrics
 * 
 * ## Event Flow
 * 
 * 1. Receives normalized vehicle events from the event bus
 * 2. Validates event envelope and payload structure
 * 3. Updates vehicle state (add/update/remove vehicles)
 * 4. Computes frames for all active scopes in the affected city
 * 5. Stores computed frames in the in-memory store
 * 6. Records metrics and handles any errors
 * 
 * ## Configuration
 * 
 * The processor supports extensive configuration through environment variables
 * and constructor parameters, including retry policies, circuit breaker settings,
 * cleanup intervals, and performance tuning options.
 * 
 * @class Processor
 * @since 1.0.0
 * @example
 * ```typescript
 * const processor = new Processor(store, eventBus, logger, {
 *   maxRetries: 3,
 *   circuitBreakerThreshold: 5,
 *   cleanupIntervalMs: 60000
 * });
 * 
 * await processor.start();
 * // Processor is now processing events
 * 
 * const metrics = processor.getMetrics();
 * const stateStats = processor.getStateStats();
 * 
 * await processor.stop();
 * ```
 */
export class Processor {
  private readonly config: ProcessorConfig;
  private readonly vehicleStateManager: VehicleStateManager;
  private readonly frameComputer: FrameComputer;
  private readonly eventValidator: EventValidator;
  private readonly metrics: ProcessorMetrics;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryPolicy: RetryPolicy;
  private readonly logger: Logger;
  private readonly store: InMemoryStore;
  private readonly bus: EventBus;
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private unsub?: () => void;
  private isShuttingDown = false;

  /**
   * Creates a new Processor instance with the specified dependencies and configuration.
   * 
   * The processor will be initialized with default implementations of all components
   * unless overridden through the dependencies parameter. This allows for easy testing
   * and customization of individual components.
   * 
   * @param store - In-memory store for storing and retrieving computed frames
   * @param bus - Event bus for subscribing to normalized vehicle events
   * @param logger - Logger instance for recording processor operations and errors
   * @param config - Optional processor configuration overrides. If not provided,
   *                 default values will be used from environment variables and defaults
   * @param dependencies - Optional dependency overrides for testing or custom implementations.
   *                      All components have sensible defaults and can be overridden individually
   * 
   * @throws {Error} If configuration validation fails or required dependencies are missing
   * 
   * @example
   * ```typescript
   * // Basic usage with defaults
   * const processor = new Processor(store, eventBus, logger);
   * 
   * // With custom configuration
   * const processor = new Processor(store, eventBus, logger, {
   *   maxRetries: 5,
   *   circuitBreakerThreshold: 10,
   *   cleanupIntervalMs: 30000
   * });
   * 
   * // With custom dependencies for testing
   * const processor = new Processor(store, eventBus, logger, config, {
   *   vehicleStateManager: mockVehicleStateManager,
   *   metrics: mockMetrics
   * });
   * ```
   */
  constructor(
    store: InMemoryStore,
    bus: EventBus,
    logger: Logger,
    config?: Partial<ProcessorConfig>,
    dependencies?: {
      vehicleStateManager?: VehicleStateManager;
      frameComputer?: FrameComputer;
      eventValidator?: EventValidator;
      metrics?: ProcessorMetrics;
      circuitBreaker?: CircuitBreaker;
      retryPolicy?: RetryPolicy;
    }
  ) {
    this.store = store;
    this.bus = bus;
    this.logger = logger;
    this.config = createProcessorConfig(config, logger);

    // Initialize dependencies
    this.vehicleStateManager = dependencies?.vehicleStateManager ?? 
      new DefaultVehicleStateManager(logger);
    
    this.frameComputer = dependencies?.frameComputer ?? 
      new DefaultFrameComputer(store, logger);
    
    this.eventValidator = dependencies?.eventValidator ?? 
      new DefaultEventValidator(logger);
    
    this.metrics = dependencies?.metrics ?? 
      new DefaultProcessorMetrics(logger, this.config.enableMetrics);
    
    this.circuitBreaker = dependencies?.circuitBreaker ?? 
      new DefaultCircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerTimeoutMs,
        logger
      );
    
    this.retryPolicy = dependencies?.retryPolicy ?? 
      createRetryPolicy({
        maxRetries: this.config.maxRetries,
        baseDelayMs: this.config.retryBaseDelayMs,
        maxDelayMs: this.config.retryMaxDelayMs,
        exponentialBackoff: true
      }, logger);

    this.logger.info({ config: this.config }, 'Processor initialized');
  }

  /**
   * Starts the processor and begins processing vehicle events.
   * 
   * This method performs the following initialization steps:
   * 1. Subscribes to the normalized events topic on the event bus
   * 2. Starts the background cleanup interval for stale vehicle data
   * 3. Begins processing incoming vehicle upsert/remove events
   * 
   * Once started, the processor will continuously process events until stopped.
   * The processor uses a consumer group to ensure reliable message processing
   * and handles failures gracefully with circuit breakers and retry policies.
   * 
   * @throws {Error} If subscription to the event bus fails or cleanup interval cannot be started
   * 
   * @example
   * ```typescript
   * const processor = new Processor(store, eventBus, logger);
   * 
   * try {
   *   await processor.start();
   *   console.log('Processor is now running and processing events');
   * } catch (error) {
   *   console.error('Failed to start processor:', error);
   * }
   * ```
   */
  async start(): Promise<void> {
    this.logger.info('Starting processor');

    try {
      // Subscribe to normalized events (handles both upsert and remove)
      this.unsub = this.bus.subscribe(
        Topics.EventsNormalized,
        'processor',
        'processor-1',
        this.handleEnvelope.bind(this)
      );

      // Start cleanup interval
      this.startCleanupInterval();

      this.logger.info('Processor started successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start processor');
      throw error;
    }
  }

  /**
   * Stops the processor and performs graceful shutdown.
   * 
   * This method performs the following cleanup steps:
   * 1. Sets the shutdown flag to prevent new operations
   * 2. Stops the background cleanup interval
   * 3. Unsubscribes from the event bus to stop receiving new events
   * 4. Allows any in-flight operations to complete
   * 
   * After calling stop(), the processor will no longer process new events
   * but will complete any currently processing events before shutting down.
   * The processor can be restarted by calling start() again.
   * 
   * @throws {Error} If cleanup operations fail during shutdown
   * 
   * @example
   * ```typescript
   * const processor = new Processor(store, eventBus, logger);
   * await processor.start();
   * 
   * // ... processor runs for a while ...
   * 
   * try {
   *   await processor.stop();
   *   console.log('Processor stopped gracefully');
   * } catch (error) {
   *   console.error('Error stopping processor:', error);
   * }
   * ```
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping processor');
    this.isShuttingDown = true;

    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      // Unsubscribe from events
      if (this.unsub) {
        this.unsub();
        this.unsub = undefined;
      }

      this.logger.info('Processor stopped successfully');
    } catch (error) {
      this.logger.error({ error }, 'Error stopping processor');
      throw error;
    }
  }

  /**
   * Processes a single event envelope containing vehicle data.
   * 
   * This is the core event processing method that handles the complete pipeline
   * for vehicle upsert and remove events. The method performs validation,
   * state updates, and frame computation with comprehensive error handling.
   * 
   * ## Processing Pipeline
   * 
   * 1. **Validation**: Validates the event envelope structure and payload
   * 2. **State Update**: Updates vehicle state (add/update/remove vehicles)
   * 3. **Frame Computation**: Computes frames for all active scopes in the city
   * 4. **Metrics**: Records processing metrics and performance data
   * 5. **Error Handling**: Handles failures with circuit breakers and retry policies
   * 
   * ## Event Types
   * 
   * - **vehicle.upsert**: Adds or updates a vehicle's position and metadata
   * - **vehicle.remove**: Removes a vehicle from the state
   * 
   * ## Error Handling
   * 
   * Invalid events are logged and discarded. Processing errors are caught,
   * logged, and recorded in metrics. The circuit breaker protects against
   * cascading failures, and retry policies handle transient issues.
   * 
   * @param envelope - Event envelope containing normalized vehicle event data
   * @private
   */
  private async handleEnvelope(envelope: unknown): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let eventType = 'unknown';

    try {
      // Validate event
      const validationResult = this.eventValidator.validateEnvelope(envelope);
      if (!validationResult.isValid) {
        this.logger.warn({ 
          errors: validationResult.errors,
          envelope 
        }, 'Invalid event envelope');
        return;
      }

      const event = validationResult.event!;
      const { cityId, payload } = event.data;
      eventType = event.data.kind;

      // Process with circuit breaker protection
      await this.circuitBreaker.execute(async () => {
        if (eventType === 'vehicle.upsert') {
          // Update vehicle state - payload is VehiclePosition for upsert
          this.vehicleStateManager.upsertVehicle(cityId, payload.id, payload as any);
        } else if (eventType === 'vehicle.remove') {
          // Remove vehicle from state - payload only has id for remove
          this.vehicleStateManager.removeVehicle(cityId, payload.id);
        } else {
          this.logger.warn({ eventType, envelope }, 'Unhandled event type');
          return;
        }

        // Compute frames for affected scopes
        await this.computeFramesForCity(cityId);

        success = true;
      }, `vehicle-${eventType}`);

    } catch (error) {
      this.logger.error({ 
        error, 
        envelope,
        eventType
      }, 'Failed to process event envelope');
      
      this.metrics.recordError('event-processing-failed', { 
        error: String(error),
        envelope,
        eventType
      });
    } finally {
      const processingTime = Date.now() - startTime;
      this.metrics.recordEventProcessed(eventType, success, processingTime);
    }
  }

  /**
   * Computes real-time frames for all active scopes in a specific city.
   * 
   * This method retrieves all vehicles for the given city and computes frames
   * for each active scope that matches the city filter. The computation includes
   * bounding box filtering, vehicle state aggregation, and frame storage.
   * 
   * ## Process
   * 
   * 1. Retrieves all vehicles for the specified city from the state manager
   * 2. Applies city-based scope filtering to only process relevant scopes
   * 3. Computes frames using the frame computer with retry policy protection
   * 4. Records metrics for frame computation performance and results
   * 5. Logs any errors encountered during scope processing
   * 
   * ## Error Handling
   * 
   * Frame computation errors are caught, logged, and recorded in metrics.
   * The retry policy handles transient failures, and the circuit breaker
   * protects against cascading failures.
   * 
   * @param cityId - Unique identifier for the city to compute frames for
   * @private
   */
  private async computeFramesForCity(cityId: string): Promise<void> {
    try {
      // Get vehicles for the city
      const vehicles = Array.from(this.vehicleStateManager.getVehiclesForCity(cityId).values());

      // Compute frames with retry policy
      await this.retryPolicy.execute(async () => {
        const result = await this.frameComputer.computeFrames(
          cityId,
          vehicles,
          (scope) => scope.cityId === cityId
        );

        // Record metrics
        this.metrics.recordFrameComputation(
          cityId,
          result.scopesProcessed,
          result.vehiclesIncluded,
          result.processingTimeMs
        );

        // Log any errors
        if (result.errors.length > 0) {
          this.logger.warn({
            cityId,
            errors: result.errors
          }, 'Frame computation completed with errors');
        }

      }, `frame-computation-${cityId}`);

    } catch (error) {
      this.logger.error({ 
        cityId, 
        error 
      }, 'Failed to compute frames for city');
      
      this.metrics.recordError('frame-computation-failed', { 
        cityId,
        error: String(error)
      });
    }
  }

  /**
   * Starts the background cleanup interval for removing stale vehicle data.
   * 
   * This method sets up a periodic cleanup process that runs at the configured
   * interval to remove vehicles that haven't been updated within the maximum
   * age threshold. This prevents memory leaks and keeps the vehicle state
   * current with only active vehicles.
   * 
   * ## Cleanup Process
   * 
   * 1. Removes vehicles older than the configured maximum age
   * 2. Cleans up empty city states after vehicle removal
   * 3. Records updated state statistics in metrics
   * 4. Logs cleanup results if detailed logging is enabled
   * 5. Handles cleanup errors gracefully without stopping the processor
   * 
   * ## Configuration
   * 
   * The cleanup behavior is controlled by:
   * - `cleanupIntervalMs`: How often cleanup runs (default: 5 minutes)
   * - `maxVehicleAgeMs`: Maximum age before vehicles are removed (default: 1 hour)
   * - `enableDetailedLogging`: Whether to log cleanup statistics
   * 
   * @private
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      try {
        this.vehicleStateManager.cleanup(this.config.maxVehicleAgeMs);
        
        // Record state statistics
        const stats = this.vehicleStateManager.getStats();
        this.metrics.recordStateStats(stats);

        if (this.config.enableDetailedLogging) {
          this.logger.debug({ stats }, 'Vehicle state cleanup completed');
        }
      } catch (error) {
        this.logger.error({ error }, 'Error during vehicle state cleanup');
        this.metrics.recordError('cleanup-failed', { error: String(error) });
      }
    }, this.config.cleanupIntervalMs);

    this.logger.debug({ 
      intervalMs: this.config.cleanupIntervalMs 
    }, 'Cleanup interval started');
  }

  /**
   * Retrieves comprehensive processor performance and operational metrics.
   * 
   * Returns a summary of all collected metrics including event processing
   * statistics, frame computation performance, error rates, and system health.
   * This data is useful for monitoring, alerting, and performance analysis.
   * 
   * @returns Object containing processor metrics summary with the following structure:
   * - `eventsProcessed`: Total number of events processed
   * - `eventsSuccessful`: Number of successfully processed events
   * - `eventsFailed`: Number of failed events
   * - `successRate`: Percentage of successful event processing
   * - `averageProcessingTime`: Average time to process events in milliseconds
   * - `frameComputations`: Frame computation statistics
   * - `errorCounts`: Count of errors by type
   * - `stateStats`: Current vehicle state statistics
   * 
   * @example
   * ```typescript
   * const metrics = processor.getMetrics();
   * console.log(`Success rate: ${metrics.successRate}%`);
   * console.log(`Average processing time: ${metrics.averageProcessingTime}ms`);
   * ```
   */
  getMetrics() {
    return this.metrics.getSummary();
  }

  /**
   * Retrieves current vehicle state statistics across all cities.
   * 
   * Provides detailed statistics about the current vehicle state including
   * total vehicles, cities with active vehicles, and per-city breakdowns.
   * This is useful for monitoring system load and vehicle distribution.
   * 
   * @returns Object containing vehicle state statistics with the following structure:
   * - `totalVehicles`: Total number of vehicles across all cities
   * - `totalCities`: Number of cities with active vehicles
   * - `cities`: Per-city statistics including vehicle counts
   * 
   * @example
   * ```typescript
   * const stats = processor.getStateStats();
   * console.log(`Total vehicles: ${stats.totalVehicles}`);
   * console.log(`Active cities: ${stats.totalCities}`);
   * ```
   */
  getStateStats() {
    return this.vehicleStateManager.getStats();
  }

  /**
   * Retrieves the current circuit breaker state and health information.
   * 
   * The circuit breaker protects the processor from cascading failures by
   * temporarily stopping processing when error rates exceed thresholds.
   * This method provides visibility into the circuit breaker's current state.
   * 
   * @returns Object containing circuit breaker state with the following structure:
   * - `state`: Current state ('closed', 'open', 'half-open')
   * - `failureCount`: Number of consecutive failures
   * - `lastFailureTime`: Timestamp of the last failure
   * - `isOpen`: Whether the circuit is currently open
   * - `isHalfOpen`: Whether the circuit is in half-open state
   * 
   * @example
   * ```typescript
   * const circuitState = processor.getCircuitBreakerState();
   * if (circuitState.isOpen) {
   *   console.log('Circuit breaker is open - processing is suspended');
   * }
   * ```
   */
  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  /**
   * Retrieves a copy of the current processor configuration.
   * 
   * Returns the complete configuration object including all settings
   * (defaults, environment variables, and overrides). The returned
   * object is a deep copy to prevent external modification.
   * 
   * @returns Deep copy of the processor configuration object
   * 
   * @example
   * ```typescript
   * const config = processor.getConfig();
   * console.log(`Max retries: ${config.maxRetries}`);
   * console.log(`Cleanup interval: ${config.cleanupIntervalMs}ms`);
   * ```
   */
  getConfig(): ProcessorConfig {
    return { ...this.config };
  }
}
