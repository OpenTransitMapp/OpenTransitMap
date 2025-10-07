import type { VehiclePosition, BBox, EventEnvelope } from '@open-transit-map/types';

/**
 * Vehicle state management interface.
 * 
 * Handles storage and retrieval of vehicle positions by city.
 * 
 * @interface VehicleStateManager
 * @since 1.0.0
 */
export interface VehicleStateManager {
  /**
   * Adds or updates a vehicle position.
   * 
   * @param cityId - City identifier
   * @param vehicleId - Vehicle identifier
   * @param position - Vehicle position data
   */
  upsertVehicle(cityId: string, vehicleId: string, position: VehiclePosition): void;
  
  /**
   * Removes a vehicle from the state.
   * 
   * @param cityId - City identifier
   * @param vehicleId - Vehicle identifier
   */
  removeVehicle(cityId: string, vehicleId: string): void;
  
  /**
   * Gets all vehicles for a specific city.
   * 
   * @param cityId - City identifier
   * @returns Map of vehicle ID to position
   */
  getVehiclesForCity(cityId: string): Map<string, VehiclePosition>;
  
  /**
   * Gets vehicles within a bounding box for a city.
   * 
   * @param cityId - City identifier
   * @param bbox - Bounding box to filter by
   * @returns Array of vehicle positions within the bbox
   */
  getVehiclesInBbox(cityId: string, bbox: BBox): VehiclePosition[];
  
  /**
   * Cleans up old vehicle data.
   * 
   * @param maxAgeMs - Maximum age of data to keep
   */
  cleanup(maxAgeMs: number): void;
  
  /**
   * Gets statistics about the current state.
   * 
   * @returns State statistics
   */
  getStats(): VehicleStateStats;
}

/**
 * Statistics about vehicle state.
 * 
 * @interface VehicleStateStats
 * @since 1.0.0
 */
export interface VehicleStateStats {
  /** Total number of cities */
  totalCities: number;
  /** Total number of vehicles across all cities */
  totalVehicles: number;
  /** Number of vehicles per city */
  vehiclesPerCity: Record<string, number>;
  /** Memory usage estimate in bytes */
  estimatedMemoryBytes: number;
}

/**
 * Frame computation interface.
 * 
 * Handles computation of frames for scoped data.
 * 
 * @interface FrameComputer
 * @since 1.0.0
 */
export interface FrameComputer {
  /**
   * Computes frames for all active scopes in a city.
   * 
   * @param cityId - City identifier
   * @param vehicles - Available vehicles for the city
   * @param scopeFilter - Function to filter scopes
   * @returns Promise resolving to computation result
   */
  computeFrames(
    cityId: string,
    vehicles: VehiclePosition[],
    scopeFilter: (scope: any) => boolean
  ): Promise<FrameComputationResult>;
}

/**
 * Result of frame computation.
 * 
 * @interface FrameComputationResult
 * @since 1.0.0
 */
export interface FrameComputationResult {
  /** Number of scopes processed */
  scopesProcessed: number;
  /** Total number of vehicles included */
  vehiclesIncluded: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Any errors that occurred during processing */
  errors: string[];
}

/**
 * Event validation interface.
 * 
 * Handles validation of incoming events.
 * 
 * @interface EventValidator
 * @since 1.0.0
 */
export interface EventValidator {
  /**
   * Validates an event envelope.
   * 
   * @param envelope - Event envelope to validate
   * @returns Validation result
   */
  validateEnvelope(envelope: unknown): EventValidationResult;
}

/**
 * Result of event validation.
 * 
 * @interface EventValidationResult
 * @since 1.0.0
 */
export interface EventValidationResult {
  /** Whether the event is valid */
  isValid: boolean;
  /** Parsed event data if valid */
  event?: EventEnvelope;
  /** Validation errors if invalid */
  errors?: string[];
}

/**
 * Metrics collection interface.
 * 
 * Handles collection of processor metrics.
 * 
 * @interface ProcessorMetrics
 * @since 1.0.0
 */
export interface ProcessorMetrics {
  /**
   * Records a processed event.
   * 
   * @param eventType - Type of event processed
   * @param success - Whether processing was successful
   * @param processingTimeMs - Processing time in milliseconds
   */
  recordEventProcessed(eventType: string, success: boolean, processingTimeMs: number): void;
  
  /**
   * Records a frame computation.
   * 
   * @param cityId - City identifier
   * @param scopesProcessed - Number of scopes processed
   * @param vehiclesIncluded - Number of vehicles included
   * @param processingTimeMs - Processing time in milliseconds
   */
  recordFrameComputation(cityId: string, scopesProcessed: number, vehiclesIncluded: number, processingTimeMs: number): void;
  
  /**
   * Records an error.
   * 
   * @param errorType - Type of error
   * @param context - Error context
   */
  recordError(errorType: string, context: Record<string, any>): void;
  
  /**
   * Records state statistics.
   * 
   * @param stats - State statistics
   */
  recordStateStats(stats: VehicleStateStats): void;
  
  /**
   * Gets a summary of all metrics.
   * 
   * @returns Metrics summary
   */
  getSummary(): ProcessorMetricsSummary;
}

/**
 * Summary of processor metrics.
 * 
 * @interface ProcessorMetricsSummary
 * @since 1.0.0
 */
export interface ProcessorMetricsSummary {
  /** Total events processed */
  eventsProcessed: number;
  /** Successfully processed events */
  eventsProcessedSuccess: number;
  /** Failed events */
  eventsProcessedError: number;
  /** Success rate percentage */
  successRate: number;
  /** Average processing time per event in milliseconds */
  averageProcessingTime: number;
  /** Total frame computations */
  frameComputations: number;
  /** Average frame computation time in milliseconds */
  averageFrameComputationTime: number;
  /** Error counts by type */
  errorCounts: Record<string, number>;
  /** Last state statistics */
  lastStateStats?: VehicleStateStats;
  /** Last state statistics timestamp */
  lastStateStatsTime?: Date;
}

/**
 * Circuit breaker interface.
 * 
 * Handles circuit breaker functionality for resilience.
 * 
 * @interface CircuitBreaker
 * @since 1.0.0
 */
export interface CircuitBreaker {
  /**
   * Executes a function with circuit breaker protection.
   * 
   * @param fn - Function to execute
   * @param context - Context for error reporting
   * @returns Promise resolving to function result
   */
  execute<T>(fn: () => Promise<T>, context: string): Promise<T>;
  
  /**
   * Gets the current state of the circuit breaker.
   * 
   * @returns Circuit breaker state
   */
  getState(): CircuitBreakerState;
}

/**
 * Circuit breaker state.
 * 
 * @interface CircuitBreakerState
 * @since 1.0.0
 */
export interface CircuitBreakerState {
  /** Current state: 'closed', 'open', or 'half-open' */
  state: 'closed' | 'open' | 'half-open';
  /** Number of consecutive failures */
  failureCount: number;
  /** Last failure timestamp */
  lastFailureTime?: Date;
  /** Next retry time if in open state */
  nextRetryTime?: Date;
}

/**
 * Retry policy interface.
 * 
 * Handles retry logic for failed operations.
 * 
 * @interface RetryPolicy
 * @since 1.0.0
 */
export interface RetryPolicy {
  /**
   * Executes a function with retry logic.
   * 
   * @param fn - Function to execute
   * @param context - Context for error reporting
   * @returns Promise resolving to function result
   */
  execute<T>(fn: () => Promise<T>, context: string): Promise<T>;
  
  /**
   * Gets the current retry configuration.
   * 
   * @returns Retry configuration
   */
  getConfig(): RetryConfig;
}

/**
 * Retry configuration.
 * 
 * @interface RetryConfig
 * @since 1.0.0
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

/**
 * Store interface for frame operations.
 * 
 * @interface FrameStore
 * @since 1.0.0
 */
export interface FrameStore {
  /**
   * Sets a frame for a scope.
   * 
   * @param scopeId - Scope identifier
   * @param frame - Frame data
   */
  setFrame(scopeId: string, frame: any): void;
  
  /**
   * Iterates over active scopes.
   * 
   * @param callback - Callback for each active scope
   */
  forEachActiveScope(callback: (scope: any) => void): void;
}
