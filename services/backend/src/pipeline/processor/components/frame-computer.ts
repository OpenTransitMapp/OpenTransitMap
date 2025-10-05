import type { VehiclePosition, BBox } from '@open-transit-map/types';
import type { FrameComputer, FrameComputationResult, FrameStore } from '../processor-types.js';
import type { Logger } from 'pino';

/**
 * Default implementation of frame computation.
 * 
 * Handles computation of frames for scoped data based on vehicle positions
 * and bounding box filters.
 * 
 * @class DefaultFrameComputer
 * @implements {FrameComputer}
 * @since 1.0.0
 */
export class DefaultFrameComputer implements FrameComputer {
  private readonly logger: Logger;
  private readonly store: FrameStore;

  /**
   * Creates a new frame computer.
   * 
   * @param store - Frame store for persistence
   * @param logger - Logger for computation events
   */
  constructor(store: FrameStore, logger: Logger) {
    this.store = store;
    this.logger = logger;
  }

  /**
   * Computes frames for all active scopes in a city.
   * 
   * @param cityId - City identifier
   * @param vehicles - Available vehicles for the city
   * @param scopeFilter - Function to filter scopes
   * @returns Promise resolving to computation result
   */
  async computeFrames(
    cityId: string,
    vehicles: VehiclePosition[],
    scopeFilter: (scope: any) => boolean
  ): Promise<FrameComputationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let scopesProcessed = 0;
    let vehiclesIncluded = 0;

    try {
      this.logger.debug({
        cityId,
        totalVehicles: vehicles.length
      }, 'Starting frame computation');

      // Get all active scopes for this city
      const activeScopes: any[] = [];
      this.store.forEachActiveScope((scope) => {
        if (scope.cityId === cityId && scopeFilter(scope)) {
          activeScopes.push(scope);
        }
      });

      this.logger.debug({
        cityId,
        activeScopes: activeScopes.length
      }, 'Found active scopes for frame computation');

      // Process each scope
      for (const scope of activeScopes) {
        try {
          const scopeVehicles = this.filterVehiclesInBbox(vehicles, scope.bbox);
          vehiclesIncluded += scopeVehicles.length;

          const frame = {
            scopeId: scope.id,
            bbox: scope.bbox,
            cityId: scope.cityId,
            at: new Date().toISOString(),
            vehicles: scopeVehicles
          };

          this.store.setFrame(scope.id, frame);
          scopesProcessed++;

          this.logger.debug({
            cityId,
            scopeId: scope.id,
            vehiclesInScope: scopeVehicles.length,
            bbox: scope.bbox
          }, 'Frame computed for scope');

        } catch (error) {
          const errorMessage = `Failed to compute frame for scope ${scope.id}: ${error}`;
          errors.push(errorMessage);
          this.logger.error({
            cityId,
            scopeId: scope.id,
            error
          }, errorMessage);
        }
      }

      const processingTimeMs = Date.now() - startTime;

      const result: FrameComputationResult = {
        scopesProcessed,
        vehiclesIncluded,
        processingTimeMs,
        errors
      };

      this.logger.debug({
        cityId,
        ...result
      }, 'Frame computation completed');

      return result;

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = `Frame computation failed for city ${cityId}: ${error}`;
      errors.push(errorMessage);

      this.logger.error({
        cityId,
        error,
        processingTimeMs
      }, errorMessage);

      return {
        scopesProcessed,
        vehiclesIncluded,
        processingTimeMs,
        errors
      };
    }
  }

  /**
   * Filters vehicles that are within a bounding box.
   * 
   * @param vehicles - Array of vehicle positions
   * @param bbox - Bounding box to filter by
   * @returns Array of vehicles within the bbox
   * @private
   */
  private filterVehiclesInBbox(vehicles: VehiclePosition[], bbox: BBox): VehiclePosition[] {
    return vehicles.filter(vehicle => this.isWithinBbox(vehicle, bbox));
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
}
