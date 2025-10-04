import type { Metrics } from '../metrics.js';
import type { InMemoryStore } from '../store.js';
import { vi } from 'vitest';

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
  } as unknown as InMemoryStore;
}
