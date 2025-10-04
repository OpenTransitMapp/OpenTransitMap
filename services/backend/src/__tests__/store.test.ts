import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryStore } from '../store.js';
import type { ScopeDefinition, ScopedTrainsFrame } from '@open-transit-map/types';
import { createMockMetrics } from './test-utils.js';
import { Metrics } from '../metrics.js';

describe('InMemoryStore', () => {
  // Test data
  const testScope: ScopeDefinition = {
    id: 'test-scope',
    cityId: 'nyc',
    bbox: { south: 40.7, west: -74, north: 40.8, east: -73.9 },
    createdAt: new Date().toISOString(),
  };

  const testFrame: ScopedTrainsFrame = {
    scopeId: testScope.id,
    cityId: testScope.cityId,
    bbox: testScope.bbox,
    at: new Date().toISOString(),
    vehicles: [
      { 
        id: 'bus_1', 
        status: 'in_service', 
        coordinate: { lat: 40.75, lng: -73.95 },
        updatedAt: new Date().toISOString()
      }
    ],
  };

  let mockMetrics: Metrics;
  let store: InMemoryStore;
  const defaultTtlMs = 1000;
  const pastTtlMs = defaultTtlMs + 100;

  beforeEach(() => {
    // Reset mocks before each test
    vi.useFakeTimers();
    mockMetrics = createMockMetrics();

    store = new InMemoryStore({ 
      metrics: mockMetrics,
      defaultTtlMs: defaultTtlMs
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Scope Management', () => {
    it('stores and retrieves scopes', () => {
      store.upsertScope(testScope.id, testScope);
      const retrieved = store.getScope(testScope.id);
      expect(retrieved).toEqual(testScope);
    });

    it('expires scopes after TTL', () => {
      store.upsertScope(testScope.id, testScope);
      vi.advanceTimersByTime(pastTtlMs); // Past TTL
      const retrieved = store.getScope(testScope.id);
      expect(retrieved).toBeUndefined();
    });

    it('records metrics on scope creation', () => {
      store.upsertScope(testScope.id, testScope);
      expect(mockMetrics.recordScopeCreation).toHaveBeenCalledWith(testScope.cityId);
    });
  });

  describe('Frame Management', () => {
    it('stores and retrieves frames', () => {
      store.setFrame(testFrame.scopeId, testFrame);
      const retrieved = store.getFrame(testFrame.scopeId);
      expect(retrieved).toEqual(testFrame);
    });

    it('expires frames after TTL', () => {
      store.setFrame(testFrame.scopeId, testFrame);
      vi.advanceTimersByTime(pastTtlMs); // Past TTL
      const retrieved = store.getFrame(testFrame.scopeId);
      expect(retrieved).toBeUndefined();
    });

    it('records frame update metrics', () => {
      store.setFrame(testFrame.scopeId, testFrame);
      expect(mockMetrics.observeFrameUpdate).toHaveBeenCalledWith(
        testFrame.cityId,
        expect.any(Number)
      );
    });
  });

  describe('Metrics Collection', () => {
    it('updates active scope counts on upsert', () => {
      store.upsertScope(testScope.id, testScope);
      expect(mockMetrics.setActiveScopes).toHaveBeenCalledWith(
        testScope.cityId,
        1
      );
    });

    it('updates active vehicle counts on frame set', () => {
      store.upsertScope(testScope.id, testScope);
      store.setFrame(testFrame.scopeId, testFrame);
      expect(mockMetrics.setActiveVehicles).toHaveBeenCalledWith(
        testFrame.cityId,
        'in_service',
        1
      );
    });

    it('metrics skips expired scopes', () => {
      store.upsertScope(testScope.id, testScope);
      vi.advanceTimersByTime(pastTtlMs); // Past TTL
      store.getScope(testScope.id); // This will trigger expiration
      expect(mockMetrics.setActiveScopes).not.toHaveBeenCalledWith(
        testScope.cityId,
        0
      );
    });
  });
});