import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultVehicleStateManager } from '../components/vehicle-state-manager.js';
import { createMockLogger } from '../../../__tests__/test-utils.js';
import type { VehiclePosition, BBox } from '@open-transit-map/types';

describe('DefaultVehicleStateManager', () => {
  let manager: DefaultVehicleStateManager;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    manager = new DefaultVehicleStateManager(mockLogger);
  });

  describe('upsertVehicle', () => {
    it('should add a new vehicle to a city when no vehicles exist for that city', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position);

      const vehicles = manager.getVehiclesForCity(cityId);
      expect(vehicles.size).toBe(1);
      expect(vehicles.get(vehicleId)).toEqual(position);
    });

    it('should update an existing vehicle when the same vehicle ID is added again', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position1: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };
      const position2: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7589, lng: -73.9851 },
        updatedAt: '2023-01-01T01:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position1);
      manager.upsertVehicle(cityId, vehicleId, position2);

      const vehicles = manager.getVehiclesForCity(cityId);
      expect(vehicles.size).toBe(1);
      expect(vehicles.get(vehicleId)).toEqual(position2);
    });

    it('should handle multiple vehicles in the same city', () => {
      const cityId = 'test-city';
      const vehicles = [
        { id: 'vehicle-1', coordinate: { lat: 40.7128, lng: -74.0060 }, updatedAt: '2023-01-01T00:00:00Z' },
        { id: 'vehicle-2', coordinate: { lat: 40.7589, lng: -73.9851 }, updatedAt: '2023-01-01T01:00:00Z' },
        { id: 'vehicle-3', coordinate: { lat: 40.6892, lng: -74.0445 }, updatedAt: '2023-01-01T02:00:00Z' }
      ];

      vehicles.forEach(vehicle => {
        manager.upsertVehicle(cityId, vehicle.id, vehicle);
      });

      const cityVehicles = manager.getVehiclesForCity(cityId);
      expect(cityVehicles.size).toBe(3);
      vehicles.forEach(vehicle => {
        expect(cityVehicles.get(vehicle.id)).toEqual(vehicle);
      });
    });

    it('should handle multiple cities', () => {
      const cities = [
        { id: 'city-1', vehicles: ['vehicle-1', 'vehicle-2'] },
        { id: 'city-2', vehicles: ['vehicle-3', 'vehicle-4', 'vehicle-5'] }
      ];

      cities.forEach(city => {
        city.vehicles.forEach(vehicleId => {
          const position: VehiclePosition = {
            id: vehicleId,
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z'
          };
          manager.upsertVehicle(city.id, vehicleId, position);
        });
      });

      expect(manager.getVehiclesForCity('city-1').size).toBe(2);
      expect(manager.getVehiclesForCity('city-2').size).toBe(3);
    });

    it('should log debug information for new vehicles', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          vehicleId,
          wasUpdate: false,
          totalVehicles: 1
        }),
        'Vehicle position added'
      );
    });

    it('should log debug information for updated vehicles', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position1: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };
      const position2: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7589, lng: -73.9851 },
        updatedAt: '2023-01-01T01:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position1);
      manager.upsertVehicle(cityId, vehicleId, position2);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          vehicleId,
          wasUpdate: true,
          totalVehicles: 1
        }),
        'Vehicle position updated'
      );
    });
  });

  describe('removeVehicle', () => {
    it('should remove a vehicle from a city when the vehicle exists', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position);
      expect(manager.getVehiclesForCity(cityId).size).toBe(1);

      manager.removeVehicle(cityId, vehicleId);
      expect(manager.getVehiclesForCity(cityId).size).toBe(0);
    });

    it('should log a warning when attempting to remove a vehicle that does not exist', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';

      // First add a vehicle to create the city state
      const position: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };
      manager.upsertVehicle(cityId, vehicleId, position);
      
      // Remove the vehicle
      manager.removeVehicle(cityId, vehicleId);
      
      // Try to remove the same vehicle again
      manager.removeVehicle(cityId, vehicleId);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cityId, vehicleId },
        'Attempted to remove vehicle from non-existent city'
      );
    });

    it('should log a warning when attempting to remove a vehicle from a city that does not exist', () => {
      const cityId = 'non-existent-city';
      const vehicleId = 'vehicle-1';

      manager.removeVehicle(cityId, vehicleId);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cityId, vehicleId },
        'Attempted to remove vehicle from non-existent city'
      );
    });

    it('should clean up empty city state after removal', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position);
      manager.removeVehicle(cityId, vehicleId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { cityId },
        'Removed empty city state'
      );
    });

    it('should log debug information for successful removal', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position);
      manager.removeVehicle(cityId, vehicleId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId,
          vehicleId,
          remainingVehicles: 0
        }),
        'Vehicle removed from state'
      );
    });
  });

  describe('getVehiclesForCity', () => {
    it('should return empty map for non-existent city', () => {
      const vehicles = manager.getVehiclesForCity('non-existent-city');
      expect(vehicles).toBeInstanceOf(Map);
      expect(vehicles.size).toBe(0);
    });

    it('should return vehicles without timestamp data', () => {
      const cityId = 'test-city';
      const vehicleId = 'vehicle-1';
      const position: VehiclePosition = {
        id: vehicleId,
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: '2023-01-01T00:00:00Z'
      };

      manager.upsertVehicle(cityId, vehicleId, position);
      const vehicles = manager.getVehiclesForCity(cityId);

      expect(vehicles.get(vehicleId)).toEqual(position);
      expect(vehicles.get(vehicleId)).not.toHaveProperty('lastUpdated');
    });
  });

  describe('getVehiclesInBbox', () => {
    const bbox: BBox = {
      north: 40.8,
      south: 40.7,
      east: -73.9,
      west: -74.1
    };

    it('should return empty array for non-existent city', () => {
      const vehicles = manager.getVehiclesInBbox('non-existent-city', bbox);
      expect(vehicles).toEqual([]);
    });

    it('should filter vehicles within bounding box', () => {
      const cityId = 'test-city';
      const vehicles = [
        { id: 'vehicle-1', coordinate: { lat: 40.75, lng: -74.0 }, updatedAt: '2023-01-01T00:00:00Z' }, // Inside
        { id: 'vehicle-2', coordinate: { lat: 40.65, lng: -74.0 }, updatedAt: '2023-01-01T01:00:00Z' }, // Outside (south)
        { id: 'vehicle-3', coordinate: { lat: 40.75, lng: -73.95 }, updatedAt: '2023-01-01T02:00:00Z' }, // Inside
        { id: 'vehicle-4', coordinate: { lat: 40.75, lng: -74.2 }, updatedAt: '2023-01-01T03:00:00Z' }  // Outside (west)
      ];

      vehicles.forEach(vehicle => {
        manager.upsertVehicle(cityId, vehicle.id, vehicle);
      });

      const filteredVehicles = manager.getVehiclesInBbox(cityId, bbox);
      expect(filteredVehicles).toHaveLength(2);
      expect(filteredVehicles.map(v => v.id)).toContain('vehicle-1');
      expect(filteredVehicles.map(v => v.id)).toContain('vehicle-3');
    });

    it('should handle edge cases for bounding box', () => {
      const cityId = 'test-city';
      const edgeBbox: BBox = {
        north: 40.8,
        south: 40.7,
        east: -73.9,
        west: -74.1
      };

      const vehicles = [
        { id: 'vehicle-1', coordinate: { lat: 40.8, lng: -74.0 }, updatedAt: '2023-01-01T00:00:00Z' }, // On north edge
        { id: 'vehicle-2', coordinate: { lat: 40.7, lng: -74.0 }, updatedAt: '2023-01-01T01:00:00Z' }, // On south edge
        { id: 'vehicle-3', coordinate: { lat: 40.75, lng: -73.9 }, updatedAt: '2023-01-01T02:00:00Z' }, // On east edge
        { id: 'vehicle-4', coordinate: { lat: 40.75, lng: -74.1 }, updatedAt: '2023-01-01T03:00:00Z' }  // On west edge
      ];

      vehicles.forEach(vehicle => {
        manager.upsertVehicle(cityId, vehicle.id, vehicle);
      });

      const filteredVehicles = manager.getVehiclesInBbox(cityId, edgeBbox);
      expect(filteredVehicles).toHaveLength(4);
    });
  });

  describe('cleanup', () => {
    it('should remove old vehicles based on age', () => {
      const cityId = 'test-city';
      const now = Date.now();
      const oldTime = new Date(now - 2 * 60 * 60 * 1000); // 2 hours ago
      const recentTime = new Date(now - 30 * 60 * 1000); // 30 minutes ago

      const oldPosition: VehiclePosition = {
        id: 'old-vehicle',
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: oldTime.toISOString()
      };
      const recentPosition: VehiclePosition = {
        id: 'recent-vehicle',
        coordinate: { lat: 40.7589, lng: -73.9851 },
        updatedAt: recentTime.toISOString()
      };

      manager.upsertVehicle(cityId, 'old-vehicle', oldPosition);
      manager.upsertVehicle(cityId, 'recent-vehicle', recentPosition);

      // Clean up vehicles older than 1 hour
      manager.cleanup(60 * 60 * 1000);

      const vehicles = manager.getVehiclesForCity(cityId);
      expect(vehicles.size).toBe(1);
      expect(vehicles.has('recent-vehicle')).toBe(true);
      expect(vehicles.has('old-vehicle')).toBe(false);
    });

    it('should clean up empty cities after cleanup', () => {
      const cityId = 'test-city';
      const now = Date.now();
      const oldTime = new Date(now - 2 * 60 * 60 * 1000);

      const oldPosition: VehiclePosition = {
        id: 'old-vehicle',
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: oldTime.toISOString()
      };

      manager.upsertVehicle(cityId, 'old-vehicle', oldPosition);
      manager.cleanup(60 * 60 * 1000); // 1 hour

      const vehicles = manager.getVehiclesForCity(cityId);
      expect(vehicles.size).toBe(0);
    });

    it('should log cleanup statistics', () => {
      const cityId = 'test-city';
      const now = Date.now();
      const oldTime = new Date(now - 2 * 60 * 60 * 1000);

      const oldPosition: VehiclePosition = {
        id: 'old-vehicle',
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: oldTime.toISOString()
      };

      manager.upsertVehicle(cityId, 'old-vehicle', oldPosition);
      manager.cleanup(60 * 60 * 1000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRemoved: 1,
          citiesCleaned: 1,
          maxAgeMs: 60 * 60 * 1000,
          remainingCities: 0
        }),
        'Vehicle state cleanup completed'
      );
    });

    it('should not log when no cleanup is needed', () => {
      const cityId = 'test-city';
      const now = Date.now();
      const recentTime = new Date(now - 30 * 60 * 1000);

      const recentPosition: VehiclePosition = {
        id: 'recent-vehicle',
        coordinate: { lat: 40.7128, lng: -74.0060 },
        updatedAt: recentTime.toISOString()
      };

      manager.upsertVehicle(cityId, 'recent-vehicle', recentPosition);
      
      // Clear any previous logger calls
      mockLogger.info.mockClear();
      
      manager.cleanup(60 * 60 * 1000);

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return empty stats for empty state', () => {
      const stats = manager.getStats();
      expect(stats).toEqual({
        totalCities: 0,
        totalVehicles: 0,
        vehiclesPerCity: {},
        estimatedMemoryBytes: 0
      });
    });

    it('should return correct statistics for single city', () => {
      const cityId = 'test-city';
      const vehicles = ['vehicle-1', 'vehicle-2', 'vehicle-3'];

      vehicles.forEach(vehicleId => {
        const position: VehiclePosition = {
          id: vehicleId,
          coordinate: { lat: 40.7128, lng: -74.0060 },
          updatedAt: '2023-01-01T00:00:00Z'
        };
        manager.upsertVehicle(cityId, vehicleId, position);
      });

      const stats = manager.getStats();
      expect(stats.totalCities).toBe(1);
      expect(stats.totalVehicles).toBe(3);
      expect(stats.vehiclesPerCity[cityId]).toBe(3);
      expect(stats.estimatedMemoryBytes).toBeGreaterThan(0);
    });

    it('should return correct statistics for multiple cities', () => {
      const cities = [
        { id: 'city-1', vehicleCount: 2 },
        { id: 'city-2', vehicleCount: 3 },
        { id: 'city-3', vehicleCount: 1 }
      ];

      cities.forEach(city => {
        for (let i = 0; i < city.vehicleCount; i++) {
          const position: VehiclePosition = {
            id: `vehicle-${i}`,
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z'
          };
          manager.upsertVehicle(city.id, `vehicle-${i}`, position);
        }
      });

      const stats = manager.getStats();
      expect(stats.totalCities).toBe(3);
      expect(stats.totalVehicles).toBe(6);
      expect(stats.vehiclesPerCity['city-1']).toBe(2);
      expect(stats.vehiclesPerCity['city-2']).toBe(3);
      expect(stats.vehiclesPerCity['city-3']).toBe(1);
    });
  });
});