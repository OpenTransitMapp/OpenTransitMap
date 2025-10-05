/**
 * Processor module exports.
 * 
 * This module contains the refactored processor implementation with improved
 * architecture, error handling, and observability.
 * 
 * @since 1.0.0
 */

// Main processor class
export { Processor } from './processor.js';

// Configuration
export { 
  createProcessorConfig, 
  validateProcessorConfig,
  ProcessorConfigSchema,
  type ProcessorConfig 
} from './processor-config.js';

// Types and interfaces
export type {
  VehicleStateManager,
  VehicleStateStats,
  FrameComputer,
  FrameComputationResult,
  EventValidator,
  EventValidationResult,
  ProcessorMetrics,
  ProcessorMetricsSummary,
  CircuitBreaker,
  CircuitBreakerState,
  RetryPolicy,
  RetryConfig,
  FrameStore
} from './processor-types.js';

// Component implementations
export { DefaultVehicleStateManager } from './components/vehicle-state-manager.js';
export { DefaultFrameComputer } from './components/frame-computer.js';
export { DefaultEventValidator } from './components/event-validator.js';
export { DefaultProcessorMetrics } from './processor-metrics.js';
export { DefaultCircuitBreaker } from './components/circuit-breaker.js';
export { createRetryPolicy } from './components/retry-policy.js';
