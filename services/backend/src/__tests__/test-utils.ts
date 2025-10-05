import type { Metrics } from '../metrics.js';
import type { InMemoryStore } from '../store.js';
import type { EventBus } from '@open-transit-map/infra';
import { vi } from 'vitest';

/**
 * Creates a comprehensive mock logger that implements the full pino.Logger interface.
 * This is the standard mock logger used across all test files.
 */
export function createMockLogger(): any {
  const mockFn = vi.fn();
  
  return {
    debug: mockFn,
    info: mockFn,
    warn: mockFn,
    error: mockFn,
    trace: mockFn,
    fatal: mockFn,
    child: vi.fn((): any => createMockLogger()),
    level: 'info',
    silent: vi.fn(),
    // Additional pino methods that might be used
    bindings: vi.fn(() => ({})),
    flush: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
    levels: {
      labels: {},
      values: {}
    }
  } as any;
}

/**
 * Creates a mock metrics instance for testing.
 * We mock metrics because it's a core service that needs different behavior in tests.
 */
export function createMockMetrics(): Metrics {
  return {
    observeHttpRequest: vi.fn(),
    recordHttpError: vi.fn(),
    recordScopeCreation: vi.fn(),
    observeFrameUpdate: vi.fn(),
    setActiveScopes: vi.fn(),
    setActiveVehicles: vi.fn(),
    getMetrics: vi.fn().mockResolvedValue('test_metric'),
  } as unknown as Metrics;
}

/**
 * Creates a mock store instance for testing.
 * Used when we want to test route handlers without actual storage.
 */
export function createMockStore(): InMemoryStore {
  return {
    upsertScope: vi.fn(),
    getScope: vi.fn(),
    setFrame: vi.fn(),
    getFrame: vi.fn().mockImplementation(() => undefined),
    forEachActiveScope: vi.fn().mockImplementation((_cb: (s: any) => void) => {}),
    defaultTtlMs: 300000
  } as unknown as InMemoryStore;
}

/**
 * Creates a mock EventBus for testing.
 * Backend-specific mock for event bus functionality.
 */
export function createMockEventBus(): EventBus {
  return {
    subscribe: vi.fn(() => vi.fn()), // Returns unsubscribe function
    publish: vi.fn().mockResolvedValue(undefined)
  } as any;
}

/**
 * Creates a mock vehicle position for testing.
 * Backend-specific mock for vehicle data.
 */
export function createMockVehiclePosition(overrides: Partial<any> = {}) {
  return {
    id: 'vehicle-1',
    coordinate: { lat: 40.7128, lng: -74.0060 },
    updatedAt: '2023-01-01T00:00:00Z',
    tripId: 'trip-1',
    routeId: 'route-1',
    bearing: 90,
    speedMps: 10,
    status: 'in_service',
    ...overrides
  };
}

/**
 * Creates a mock event envelope for testing.
 * Backend-specific mock for event processing.
 */
export function createMockEventEnvelope(overrides: Partial<any> = {}) {
  return {
    kind: 'vehicle.upsert',
    payload: createMockVehiclePosition(),
    metadata: {
      source: 'test',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    ...overrides
  };
}

/**
 * Creates a mock viewport for testing.
 * Backend-specific mock for frame computation.
 */
export function createMockViewport(overrides: Partial<any> = {}) {
  return {
    north: 40.8,
    south: 40.7,
    east: -74.0,
    west: -74.1,
    ...overrides
  };
}
