import type { ScopeDefinition, ScopedTrainsFrame, ScopeId } from '@open-transit-map/types';
import { storeLogger } from './logger.js';
import type { Metrics } from './metrics.js';

/**
 * Options for configuring the in-memory store.
 * 
 * @property metrics - Metrics instance for collecting Prometheus metrics.
 * @property defaultTtlMs - Optional default time-to-live (TTL) in milliseconds for scopes and frames.
 */
interface StoreOptions {
  /** Metrics instance for collecting Prometheus metrics */
  metrics: Metrics;
  /** Optional default time-to-live (TTL) in milliseconds for scopes and frames */
  defaultTtlMs?: number; // Defaults to 2 minutes (120000 ms) if not provided
}

/**
 * Simple in-memory storage for transit scopes and frames with TTL-based expiration.
 * 
 * This store maintains two primary data structures:
 * 1. Viewport scopes - representing areas being monitored
 * 2. Train frames - containing vehicle positions within scopes
 * 
 * @remarks
 * This is a temporary solution and doesn't focus on thread safety.
 * Metrics may not always see the most up-to-date data, which is acceptable.
 * 
 * @example
 * ```typescript
 * // Create a viewport scope
 * store.upsertScope('nyc_midtown', {
 *   id: 'nyc_midtown',
 *   cityId: 'nyc',
 *   bbox: { south: 40.7, west: -74, north: 40.8, east: -73.9 }
 * });
 * 
 * // Update vehicle positions
 * store.setFrame('nyc_midtown', {
 *   scopeId: 'nyc_midtown',
 *   vehicles: [{ id: 'bus_123', status: 'in_service' }]
 * });
 * ```
 */
class InMemoryStore {
  /** Map storing scope definitions with their TTL expiration timestamps */
  private scopes = new Map<ScopeId, ScopeDefinition & { ttl: number }>();
  
  /** Map storing train frames with their TTL expiration timestamps */
  private frames = new Map<ScopeId, ScopedTrainsFrame & { ttl: number }>();

  private readonly metrics: Metrics;
  public readonly defaultTtlMs: number;

  public static readonly DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes

  constructor(options: StoreOptions) {
    this.metrics = options.metrics;
    this.defaultTtlMs = options.defaultTtlMs ?? InMemoryStore.DEFAULT_TTL_MS;
    storeLogger.info({ defaultTtlMs: this.defaultTtlMs }, 'InMemoryStore initialized');
  }

  /**
   * Updates active scopes metric by counting non-expired scopes by city.
   */
  private updateActiveScopesMetric() {
    const cityCounts = new Map<string, number>();
    
    for (const [, scope] of this.scopes) {
      if (scope.ttl >= Date.now()) {
        cityCounts.set(scope.cityId, (cityCounts.get(scope.cityId) || 0) + 1);
      }
    }

    for (const [cityId, count] of cityCounts) {
      this.metrics.setActiveScopes(cityId, count);
    }
  }

  /**
   * Updates active vehicles metric by counting non-expired vehicles by city and status.
   */
  private updateActiveVehiclesMetric() {
    const cityStatusCounts = new Map<string, Map<string, number>>();
    
    for (const [scopeId, frame] of this.frames) {
      if (frame.ttl < Date.now()) continue;
      
      const scope = this.scopes.get(scopeId);
      if (!scope || scope.ttl < Date.now()) continue;
      
      const counts = cityStatusCounts.get(scope.cityId) || new Map();
      
      for (const vehicle of frame.vehicles) {
        const status = vehicle.status || 'unknown';
        counts.set(status, (counts.get(status) || 0) + 1);
      }
      
      cityStatusCounts.set(scope.cityId, counts);
    }

    for (const [cityId, statusCounts] of cityStatusCounts) {
      for (const [status, count] of statusCounts) {
        this.metrics.setActiveVehicles(cityId, status, count);
      }
    }
  }

  /**
   * Creates or updates a scope definition with TTL-based expiration.
   * 
   * @param id - Unique identifier for the scope
   * @param def - Scope definition containing bbox and other metadata
   * @param ttlMs - Optional custom TTL in milliseconds (defaults to store's defaultTtlMs)
   * 
   * @example
   * ```typescript
   * store.upsertScope('downtown', {
   *   id: 'downtown',
   *   cityId: 'nyc',
   *   bbox: { south: 40.7, west: -74, north: 40.8, east: -73.9 },
   *   createdAt: new Date().toISOString()
   * });
   * ```
   */
  upsertScope(id: ScopeId, def: ScopeDefinition, ttlMs: number = this.defaultTtlMs) {
    const ttl = Date.now() + ttlMs;
    const entry = { ...def, ttl };
    
    this.scopes.set(id, entry);
    storeLogger.info({ id, cityId: def.cityId, ttlMs }, 'Scope upserted');
    this.metrics.recordScopeCreation(def.cityId);
    this.updateActiveScopesMetric();
  }

  /**
   * Retrieves a scope definition by ID if it exists and hasn't expired
   * @param id - Unique identifier for the scope
   * @returns The scope definition if found and valid, undefined if not found or expired
   */
  getScope(id: ScopeId): ScopeDefinition | undefined {
    const entry = this.scopes.get(id);
    if (!entry) {
      storeLogger.debug({ id }, 'Scope not found');
      return undefined;
    }
    
    if (entry.ttl < Date.now()) {
      this.scopes.delete(id);
      storeLogger.info({ id, cityId: entry.cityId }, 'Scope expired');
      this.updateActiveScopesMetric();
      return undefined;
    }
    
    const { ttl, ...rest } = entry;
    return rest;
  }

  /**
   * Stores a train frame for a specific scope with TTL-based expiration.
   * 
   * @param id - Scope identifier the frame belongs to
   * @param frame - Train frame data containing vehicle positions
   * @param ttlMs - Optional custom TTL in milliseconds (defaults to store's defaultTtlMs)
   * 
   * @example
   * ```typescript
   * store.setFrame('downtown', {
   *   scopeId: 'downtown',
   *   cityId: 'nyc',
   *   vehicles: [
   *     { id: 'bus_123', status: 'in_service', coordinate: { lat: 40.75, lng: -73.98 } }
   *   ],
   *   at: new Date().toISOString()
   * });
   * ```
   */
  setFrame(id: ScopeId, frame: ScopedTrainsFrame, ttlMs: number = this.defaultTtlMs) {
    const startTime = process.hrtime();
    const ttl = Date.now() + ttlMs;
    const entry = { ...frame, ttl };

    this.frames.set(id, entry);

    // Record metrics
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    this.metrics.observeFrameUpdate(frame.cityId, duration);
    this.updateActiveVehiclesMetric();

    storeLogger.info({
      id,
      cityId: frame.cityId,
      vehicleCount: frame.vehicles.length,
      ttlMs
    }, 'Frame updated');
  }

  /**
   * Retrieves a train frame by scope ID if it exists and hasn't expired
   * @param id - Scope identifier for the frame
   * @returns The train frame if found and valid, undefined if not found or expired
   */
  getFrame(id: ScopeId): ScopedTrainsFrame | undefined {
    const entry = this.frames.get(id);
    if (!entry) {
      storeLogger.debug({ id }, 'Frame not found');
      return undefined;
    }

    if (entry.ttl < Date.now()) {
      this.frames.delete(id);
      storeLogger.info({ id, cityId: entry.cityId }, 'Frame expired');
      this.updateActiveVehiclesMetric();
      return undefined;
    }

    const { ttl, ...rest } = entry;
    const frame = rest as ScopedTrainsFrame;
    
    storeLogger.debug({
      id,
      cityId: entry.cityId,
      vehicleCount: entry.vehicles.length
    }, 'Frame retrieved');
    
    return frame;
  }
}

// Export the class only - instances should be created with DI
export { InMemoryStore };