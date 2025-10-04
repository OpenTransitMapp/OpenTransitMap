import { Metrics } from './metrics.js';
import { InMemoryStore } from './store.js';

/**
 * Core service instances for the application.
 * These are singletons that should be used throughout the app.
 */

// Metrics is configurable and needs DI for testing
export const metrics = new Metrics({ 
  prefix: process.env.METRICS_PREFIX ?? 'opentransit_'
});

// Store depends on metrics for instrumentation
export const store = new InMemoryStore({ 
  metrics,
  defaultTtlMs: process.env.STORE_TTL_MS ? parseInt(process.env.STORE_TTL_MS, 10) : undefined
});
