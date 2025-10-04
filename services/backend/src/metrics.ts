import client from 'prom-client';
import { metricsLogger } from './logger.js';

interface MetricsOptions {
  prefix?: string;
}

/**
 * Core metrics for the backend service.
 * Provides HTTP and business metrics using Prometheus client.
 * 
 * @remarks
 * All metrics are prefixed (default: 'opentransit_') and follow OpenTelemetry naming conventions.
 * Includes:
 * - HTTP metrics (duration, counts, errors)
 * - Business metrics (scopes, frames, vehicles)
 * - Node.js runtime metrics
 * 
 * @example
 * ```ts
 * // Record HTTP metrics
 * metrics.observeHttpRequest('GET', '/api/v1/trains', 200, 0.123);
 * 
 * // Track business metrics
 * metrics.recordScopeCreation('nyc');
 * metrics.setActiveVehicles('nyc', 'in_service', 42);
 * ```
 */
export class Metrics {
  /** HTTP request duration histogram */
  private httpRequestDuration: client.Histogram;
  /** Total HTTP requests counter */
  private httpRequestTotal: client.Counter;
  /** HTTP request errors counter */
  private httpRequestErrors: client.Counter;
  /** Scope creation counter */
  private scopeCreationTotal: client.Counter;
  /** Frame update duration histogram */
  private frameUpdateDuration: client.Histogram;
  /** Active scopes gauge */
  private activeScopes: client.Gauge;
  /** Active vehicles gauge */
  private activeVehicles: client.Gauge;

  public readonly prefix: string;

  constructor(options: MetricsOptions = {}) {
    this.prefix = options.prefix ?? 'opentransit_';

    // Initialize HTTP metrics
    this.httpRequestDuration = new client.Histogram({
      name: `${this.prefix}http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    this.httpRequestTotal = new client.Counter({
      name: `${this.prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestErrors = new client.Counter({
      name: `${this.prefix}http_request_errors_total`,
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type'],
    });

    // Initialize business metrics
    this.scopeCreationTotal = new client.Counter({
      name: `${this.prefix}scope_creation_total`,
      help: 'Total number of viewport scopes created',
      labelNames: ['city_id'],
    });

    this.frameUpdateDuration = new client.Histogram({
      name: `${this.prefix}frame_update_duration_seconds`,
      help: 'Duration of frame updates in seconds',
      labelNames: ['city_id'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    this.activeScopes = new client.Gauge({
      name: `${this.prefix}active_scopes`,
      help: 'Number of active viewport scopes',
      labelNames: ['city_id'],
    });

    this.activeVehicles = new client.Gauge({
      name: `${this.prefix}active_vehicles`,
      help: 'Number of active vehicles being tracked',
      labelNames: ['city_id', 'status'],
    });

    // Enable default Node.js metrics
    client.collectDefaultMetrics({
      prefix: `${this.prefix}nodejs_`,
    });

    metricsLogger.info('Metrics initialized');
  }

  /**
   * Records HTTP request duration and increments request counter.
   * 
   * @param method - HTTP method (GET, POST, etc.)
   * @param route - Request route/path
   * @param statusCode - Response status code
   * @param duration - Request duration in seconds
   */
  public observeHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    this.httpRequestTotal.inc({ method, route, status_code: statusCode });
  }

  /**
   * Records an HTTP request error.
   * 
   * @param method - HTTP method of the failed request
   * @param route - Route that generated the error
   * @param errorType - Type/category of error
   */
  public recordHttpError(method: string, route: string, errorType: string) {
    this.httpRequestErrors.inc({ method, route, error_type: errorType });
  }

  /**
   * Increments the counter for viewport scope creation.
   * 
   * @param cityId - City identifier the scope belongs to
   */
  public recordScopeCreation(cityId: string) {
    this.scopeCreationTotal.inc({ city_id: cityId });
  }

  /**
   * Records the duration of a frame update operation.
   * 
   * @param cityId - City identifier the frame belongs to
   * @param duration - Time taken to update the frame in seconds
   */
  public observeFrameUpdate(cityId: string, duration: number) {
    this.frameUpdateDuration.observe({ city_id: cityId }, duration);
  }

  /**
   * Updates the gauge showing number of active scopes.
   * 
   * @param cityId - City identifier to update count for
   * @param count - Current number of active scopes
   */
  public setActiveScopes(cityId: string, count: number) {
    this.activeScopes.set({ city_id: cityId }, count);
  }

  /**
   * Updates the gauge showing number of active vehicles by status.
   * 
   * @param cityId - City identifier to update count for
   * @param status - Vehicle status (e.g., 'in_service', 'out_of_service')
   * @param count - Current number of vehicles with this status
   */
  public setActiveVehicles(cityId: string, status: string, count: number) {
    this.activeVehicles.set({ city_id: cityId, status }, count);
  }

  /**
   * Gets the current metrics in Prometheus exposition format.
   * Used by the /metrics endpoint to expose metrics to scrapers.
   * 
   * @returns Prometheus-formatted metrics string
   */
  public async getMetrics(): Promise<string> {
    return client.register.metrics();
  }
}

// Export the class and create a default instance
export type { MetricsOptions };
// Default instance will be created in app.ts where we have the logger