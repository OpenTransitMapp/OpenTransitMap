import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultFrameComputer } from '../components/frame-computer.js';
import { createMockLogger } from '../../../__tests__/test-utils.js';
import type { VehiclePosition } from '@open-transit-map/types';

describe('DefaultFrameComputer', () => {
  let computer: DefaultFrameComputer;
  let mockLogger: any;
  let mockStore: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockStore = {
      setFrame: vi.fn(),
      forEachActiveScope: vi.fn()
    };
    computer = new DefaultFrameComputer(mockStore, mockLogger);
  });

  describe('computeFrames', () => {
    const cityId = 'test-city';
      const vehicles: VehiclePosition[] = [
        {
          id: 'vehicle-1',
          coordinate: { lat: 40.75, lng: -74.0 },
          updatedAt: '2023-01-01T00:00:00Z'
        },
        {
          id: 'vehicle-2',
          coordinate: { lat: 40.55, lng: -74.0 },
          updatedAt: '2023-01-01T01:00:00Z'
        },
        {
          id: 'vehicle-3',
          coordinate: { lat: 40.75, lng: -73.95 },
          updatedAt: '2023-01-01T02:00:00Z'
        }
      ];

    it('should compute frames for active scopes', async () => {
      const scopes = [
        {
          id: 'scope-1',
          cityId,
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        },
        {
          id: 'scope-2',
          cityId,
          bbox: { north: 40.6, south: 40.5, east: -73.9, west: -74.1 }
        }
      ];

      mockStore.forEachActiveScope.mockImplementation((callback: (scope: any) => void) => {
        scopes.forEach(callback);
      });

      const result = await computer.computeFrames(cityId, vehicles, () => true);

      expect(result.scopesProcessed).toBe(2);
      expect(result.vehiclesIncluded).toBe(3); // vehicle-1 and vehicle-3 in scope-1, vehicle-2 in scope-2
      expect(result.errors).toHaveLength(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);

      expect(mockStore.setFrame).toHaveBeenCalledTimes(2);
      expect(mockStore.setFrame).toHaveBeenCalledWith('scope-1', expect.objectContaining({
        scopeId: 'scope-1',
        bbox: scopes[0].bbox,
        cityId,
        vehicles: expect.arrayContaining([
          expect.objectContaining({ id: 'vehicle-1' }),
          expect.objectContaining({ id: 'vehicle-3' })
        ])
      }));
      expect(mockStore.setFrame).toHaveBeenCalledWith('scope-2', expect.objectContaining({
        scopeId: 'scope-2',
        bbox: scopes[1].bbox,
        cityId,
        vehicles: expect.arrayContaining([
          expect.objectContaining({ id: 'vehicle-2' })
        ])
      }));
    });

    it('should filter scopes by city and scope filter', async () => {
      const scopes = [
        {
          id: 'scope-1',
          cityId: 'test-city',
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        },
        {
          id: 'scope-2',
          cityId: 'other-city',
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        },
        {
          id: 'scope-3',
          cityId: 'test-city',
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        }
      ];

      mockStore.forEachActiveScope.mockImplementation((callback: (scope: any) => void) => {
        scopes.forEach(callback);
      });

      // Filter to only include scope-1
      const scopeFilter = (scope: any) => scope.id === 'scope-1';

      const result = await computer.computeFrames(cityId, vehicles, scopeFilter);

      expect(result.scopesProcessed).toBe(1);
      expect(mockStore.setFrame).toHaveBeenCalledTimes(1);
      expect(mockStore.setFrame).toHaveBeenCalledWith('scope-1', expect.any(Object));
    });

    it('should handle empty vehicle list', async () => {
      const scopes = [
        {
          id: 'scope-1',
          cityId,
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        }
      ];

      mockStore.forEachActiveScope.mockImplementation((callback: (scope: any) => void) => {
        scopes.forEach(callback);
      });

      const result = await computer.computeFrames(cityId, [], () => true);

      expect(result.scopesProcessed).toBe(1);
      expect(result.vehiclesIncluded).toBe(0);
      expect(mockStore.setFrame).toHaveBeenCalledWith('scope-1', expect.objectContaining({
        vehicles: []
      }));
    });

    it('should handle no active scopes', async () => {
      mockStore.forEachActiveScope.mockImplementation((_callback: (scope: any) => void) => {});

      const result = await computer.computeFrames(cityId, vehicles, () => true);

      expect(result.scopesProcessed).toBe(0);
      expect(result.vehiclesIncluded).toBe(0);
      expect(mockStore.setFrame).not.toHaveBeenCalled();
    });

    it('should handle scope processing errors gracefully', async () => {
      const scopes = [
        {
          id: 'scope-1',
          cityId,
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        },
        {
          id: 'scope-2',
          cityId,
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        }
      ];

      mockStore.forEachActiveScope.mockImplementation((callback: (scope: any) => void) => {
        scopes.forEach(callback);
      });

      // Make setFrame throw for scope-2
      mockStore.setFrame
        .mockImplementationOnce(() => {}) // scope-1 succeeds
        .mockImplementationOnce(() => { throw new Error('Store error'); }); // scope-2 fails

      const result = await computer.computeFrames(cityId, vehicles, () => true);

      expect(result.scopesProcessed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to compute frame for scope scope-2');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          scopeId: 'scope-2',
          error: expect.any(Error)
        }),
        expect.stringContaining('Failed to compute frame for scope scope-2')
      );
    });

    it('should handle overall computation errors', async () => {
      mockStore.forEachActiveScope.mockImplementation((_callback: (scope: any) => void) => {
        throw new Error('Store iteration error');
      });

      const result = await computer.computeFrames(cityId, vehicles, () => true);

      expect(result.scopesProcessed).toBe(0);
      expect(result.vehiclesIncluded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Frame computation failed for city test-city');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          error: expect.any(Error)
        }),
        expect.stringContaining('Frame computation failed for city test-city')
      );
    });

    it('should log debug information during computation', async () => {
      const scopes = [
        {
          id: 'scope-1',
          cityId,
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        }
      ];

      mockStore.forEachActiveScope.mockImplementation((callback: (scope: any) => void) => {
        scopes.forEach(callback);
      });

      await computer.computeFrames(cityId, vehicles, () => true);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          totalVehicles: vehicles.length
        }),
        'Starting frame computation'
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          activeScopes: 1
        }),
        'Found active scopes for frame computation'
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          scopeId: 'scope-1',
          vehiclesInScope: expect.any(Number),
          bbox: scopes[0].bbox
        }),
        'Frame computed for scope'
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          scopesProcessed: 1,
          vehiclesIncluded: expect.any(Number),
          processingTimeMs: expect.any(Number)
        }),
        'Frame computation completed'
      );
    });

    it('should filter vehicles correctly by bounding box', async () => {
      const scopes = [
        {
          id: 'scope-1',
          cityId,
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 } // Only includes vehicle-1 and vehicle-3
        }
      ];

      mockStore.forEachActiveScope.mockImplementation((callback: (scope: any) => void) => {
        scopes.forEach(callback);
      });

      await computer.computeFrames(cityId, vehicles, () => true);

      expect(mockStore.setFrame).toHaveBeenCalledWith('scope-1', expect.objectContaining({
        vehicles: expect.arrayContaining([
          expect.objectContaining({ id: 'vehicle-1' }),
          expect.objectContaining({ id: 'vehicle-3' })
        ])
      }));

      // Should not include vehicle-2 (outside bbox)
      const frameCall = mockStore.setFrame.mock.calls[0][1];
      expect(frameCall.vehicles).not.toContainEqual(expect.objectContaining({ id: 'vehicle-2' }));
    });

    it('should include timestamp in frame data', async () => {
      const scopes = [
        {
          id: 'scope-1',
          cityId,
          bbox: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
        }
      ];

      mockStore.forEachActiveScope.mockImplementation((callback: (scope: any) => void) => {
        scopes.forEach(callback);
      });

      const beforeTime = new Date();
      await computer.computeFrames(cityId, vehicles, () => true);
      const afterTime = new Date();

      expect(mockStore.setFrame).toHaveBeenCalledWith('scope-1', expect.objectContaining({
        at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        scopeId: 'scope-1',
        bbox: scopes[0].bbox,
        cityId,
        vehicles: expect.any(Array)
      }));

      const frameCall = mockStore.setFrame.mock.calls[0][1];
      const frameTime = new Date(frameCall.at);
      expect(frameTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(frameTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });
});