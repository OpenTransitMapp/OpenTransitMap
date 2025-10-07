import type { VehiclePosition, BBox } from '@open-transit-map/types';
import type { VehicleStateManager, VehicleStateStats } from '../processor-types.js';
import type { Logger } from 'pino';

/**
 * Vehicle position with timestamp for age tracking.
 * 
 * @interface TimestampedVehiclePosition
 * @since 1.0.0
 */
interface TimestampedVehiclePosition extends VehiclePosition {
  /** Timestamp when the position was last updated */
  lastUpdated: Date;
}

/**
 * Default implementation of vehicle state management.
 * 
 * Maintains in-memory state of vehicle positions organized by city.
 * Includes age tracking for cleanup and memory management.
 * 
 * @class DefaultVehicleStateManager
 * @implements {VehicleStateManager}
 * @since 1.0.0
 */
export class DefaultVehicleStateManager implements VehicleStateManager {
  // cityId -> Map<vehicleId, TimestampedVehiclePosition>
  private readonly state = new Map<string, Map<string, TimestampedVehiclePosition>>();
  private readonly logger: Logger;

  /**
   * Creates a new vehicle state manager.
   * 
   * @param logger - Logger for state management events
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Adds or updates a vehicle position.
   * 
   * @param cityId - City identifier
   * @param vehicleId - Vehicle identifier
   * @param position - Vehicle position data
   */
  upsertVehicle(cityId: string, vehicleId: string, position: VehiclePosition): void {
    const timestampedPosition: TimestampedVehiclePosition = {
      ...position,
      lastUpdated: new Date(position.updatedAt)
    };

    let cityState = this.state.get(cityId);
    if (!cityState) {
      cityState = new Map<string, TimestampedVehiclePosition>();
      this.state.set(cityId, cityState);
    }

    const wasUpdate = cityState.has(vehicleId);
    cityState.set(vehicleId, timestampedPosition);

    this.logger.debug({
      cityId,
      vehicleId,
      wasUpdate,
      totalVehicles: cityState.size
    }, wasUpdate ? 'Vehicle position updated' : 'Vehicle position added');
  }

  /**
   * Removes a vehicle from the state.
   * 
   * @param cityId - City identifier
   * @param vehicleId - Vehicle identifier
   */
  removeVehicle(cityId: string, vehicleId: string): void {
    const cityState = this.state.get(cityId);
    if (!cityState) {
      this.logger.warn({ cityId, vehicleId }, 'Attempted to remove vehicle from non-existent city');
      return;
    }

    const existed = cityState.delete(vehicleId);
    if (existed) {
      this.logger.debug({
        cityId,
        vehicleId,
        remainingVehicles: cityState.size
      }, 'Vehicle removed from state');
    } else {
      this.logger.warn({ cityId, vehicleId }, 'Attempted to remove non-existent vehicle');
    }

    // Clean up empty city state
    if (cityState.size === 0) {
      this.state.delete(cityId);
      this.logger.debug({ cityId }, 'Removed empty city state');
    }
  }

  /**
   * Gets all vehicles for a specific city.
   * 
   * @param cityId - City identifier
   * @returns Map of vehicle ID to position
   */
  getVehiclesForCity(cityId: string): Map<string, VehiclePosition> {
    const cityState = this.state.get(cityId);
    if (!cityState) {
      return new Map<string, VehiclePosition>();
    }

    const result = new Map<string, VehiclePosition>();
    for (const [vehicleId, timestampedPosition] of cityState) {
      const { lastUpdated, ...position } = timestampedPosition;
      result.set(vehicleId, position);
    }

    return result;
  }

  /**
   * Gets vehicles within a bounding box for a city.
   * 
   * @param cityId - City identifier
   * @param bbox - Bounding box to filter by
   * @returns Array of vehicle positions within the bbox
   */
  getVehiclesInBbox(cityId: string, bbox: BBox): VehiclePosition[] {
    const cityState = this.state.get(cityId);
    if (!cityState) {
      return [];
    }

    const vehicles: VehiclePosition[] = [];
    for (const timestampedPosition of cityState.values()) {
      const { lastUpdated, ...position } = timestampedPosition;
      if (this.isWithinBbox(position, bbox)) {
        vehicles.push(position);
      }
    }

    return vehicles;
  }

  /**
   * Cleans up old vehicle data.
   * 
   * @param maxAgeMs - Maximum age of data to keep
   */
  cleanup(maxAgeMs: number): void {
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    let totalRemoved = 0;
    let citiesCleaned = 0;

    for (const [cityId, cityState] of this.state) {
      let cityRemoved = 0;
      const toRemove: string[] = [];

      for (const [vehicleId, timestampedPosition] of cityState) {
        if (timestampedPosition.lastUpdated < cutoffTime) {
          toRemove.push(vehicleId);
        }
      }

      for (const vehicleId of toRemove) {
        cityState.delete(vehicleId);
        cityRemoved++;
      }

      if (cityRemoved > 0) {
        totalRemoved += cityRemoved;
        citiesCleaned++;

        // Clean up empty city state
        if (cityState.size === 0) {
          this.state.delete(cityId);
        }
      }
    }

    if (totalRemoved > 0) {
      this.logger.info({
        totalRemoved,
        citiesCleaned,
        maxAgeMs,
        remainingCities: this.state.size
      }, 'Vehicle state cleanup completed');
    }
  }

  /**
   * Gets statistics about the current state.
   * 
   * @returns State statistics
   */
  getStats(): VehicleStateStats {
    const vehiclesPerCity: Record<string, number> = {};
    let totalVehicles = 0;

    for (const [cityId, cityState] of this.state) {
      const count = cityState.size;
      vehiclesPerCity[cityId] = count;
      totalVehicles += count;
    }

    // Rough estimate of memory usage
    const estimatedMemoryBytes = this.estimateMemoryUsage();

    return {
      totalCities: this.state.size,
      totalVehicles,
      vehiclesPerCity,
      estimatedMemoryBytes
    };
  }

  /**
   * Checks if a vehicle position is within a bounding box.
   * 
   * @param position - Vehicle position
   * @param bbox - Bounding box
   * @returns True if within bbox
   * @private
   */
  private isWithinBbox(position: VehiclePosition, bbox: BBox): boolean {
    const { lat, lng } = position.coordinate;
    return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east;
  }

  /**
   * Estimates memory usage of the current state.
   * 
   * @returns Estimated memory usage in bytes
   * @private
   */
  private estimateMemoryUsage(): number {
    let totalBytes = 0;

    // Base Map overhead
    totalBytes += this.state.size * 100; // Rough estimate for Map overhead

    for (const cityState of this.state.values()) {
      // City Map overhead
      totalBytes += cityState.size * 50;

      for (const timestampedPosition of cityState.values()) {
        // Vehicle position data
        totalBytes += JSON.stringify(timestampedPosition).length * 2; // Rough estimate
        totalBytes += 24; // Date object overhead
      }
    }

    return totalBytes;
  }
}
