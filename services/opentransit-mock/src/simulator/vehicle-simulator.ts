import type { Logger } from 'pino';
import type { IoRedisClient } from '@open-transit-map/infra';
import type { Config } from '../config/index.js';
import type { Coordinate } from './movement-patterns.js';
import { MovementPatterns } from './movement-patterns.js';
import { makeVehicleUpsertPayload, makeVehicleRemovePayload, nowIso } from '../events/event-generator.js';

/**
 * Metrics tracking for the vehicle simulator.
 */
export interface SimulatorMetrics {
  eventsPublished: number;
  eventsFailed: number;
  vehiclesActive: number;
  vehiclesRemoved: number;
  startTime: Date;
  lastPublishTime?: Date;
}

/**
 * Status information for the vehicle simulator.
 */
export interface SimulatorStatus {
  isRunning: boolean;
  activeVehicles: number;
  tick: number;
}

/**
 * Publishes synthetic vehicle events to a Valkey Stream with configurable patterns.
 * Supports multiple movement patterns and vehicle removal events.
 */
export class VehicleSimulator {
  private positions: Coordinate[];
  private activeVehicles: Set<number>;
  private tick: number = 0;
  private intervalId?: ReturnType<typeof setInterval>;
  private metrics: SimulatorMetrics;
  private isRunning: boolean = false;

  constructor(
    private client: IoRedisClient,
    private config: Config,
    private logger: Logger
  ) {
    this.positions = Array.from({ length: config.vehicles }).map((_, i) =>
      this.computeInitialPosition(i)
    );
    this.activeVehicles = new Set(Array.from({ length: config.vehicles }, (_, i) => i));
    this.metrics = {
      eventsPublished: 0,
      eventsFailed: 0,
      vehiclesActive: config.vehicles,
      vehiclesRemoved: 0,
      startTime: new Date()
    };
  }

  /**
   * Computes initial position for a vehicle based on movement pattern.
   */
  private computeInitialPosition(vehicleId: number): Coordinate {
    const t = vehicleId * 0.5;
    return this.computePosition(t, vehicleId);
  }

  /**
   * Computes position for a vehicle based on current time and movement pattern.
   */
  private computePosition(t: number, vehicleId: number): Coordinate {
    const pattern = MovementPatterns[this.config.movementPattern];
    const center = { lat: this.config.centerLat, lng: this.config.centerLng };
    return pattern(center, this.config.radius, t, vehicleId);
  }

  /** Starts the periodic publish loop. */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Simulator is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info({
      config: {
        vehicles: this.config.vehicles,
        intervalMs: this.config.intervalMs,
        movementPattern: this.config.movementPattern,
        vehicleRemovalProbability: this.config.vehicleRemovalProbability
      }
    }, 'Starting vehicle simulator');

    this.intervalId = setInterval(() => this.publishAll(), this.config.intervalMs);
  }

  /** Stops the simulator and cleans up resources. */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.logger.info({
      metrics: this.getMetrics()
    }, 'Vehicle simulator stopped');
  }

  /** Publishes one batch containing events for all active vehicles. */
  private async publishAll(): Promise<void> {
    const at = nowIso();
    const publishPromises: Promise<unknown>[] = [];
    const currentTime = Date.now() / 5000;

    for (const vehicleId of this.activeVehicles) {
      try {
        // Update position
        this.positions[vehicleId] = this.computePosition(currentTime, vehicleId);
        
        // Create upsert event
        const upsertEnv = makeVehicleUpsertPayload(vehicleId, at, this.positions[vehicleId], this.config);
        publishPromises.push(
          this.client.xaddJson(this.config.stream, upsertEnv, 10000) // Fixed trim length
            .then(() => {
              this.metrics.eventsPublished++;
            })
            .catch((error: Error) => {
              this.metrics.eventsFailed++;
              this.logger.error({ vehicleId, error }, 'Failed to publish vehicle upsert event');
            })
        );

        // Randomly remove vehicles based on probability
        if (Math.random() < this.config.vehicleRemovalProbability) {
          const removeEnv = makeVehicleRemovePayload(vehicleId, at, this.config);
          publishPromises.push(
            this.client.xaddJson(this.config.stream, removeEnv, 10000) // Fixed trim length
              .then(() => {
                this.activeVehicles.delete(vehicleId);
                this.metrics.vehiclesRemoved++;
                this.metrics.vehiclesActive = this.activeVehicles.size;
                this.metrics.eventsPublished++;
              })
              .catch((error: Error) => {
                this.metrics.eventsFailed++;
                this.logger.error({ vehicleId, error }, 'Failed to publish vehicle remove event');
              })
          );
        }
      } catch (error) {
        this.logger.error({ vehicleId, error }, 'Error processing vehicle');
      }
    }

    // Add new vehicles if we're below the target count
    while (this.activeVehicles.size < this.config.vehicles) {
      const newVehicleId = this.findNextAvailableVehicleId();
      this.activeVehicles.add(newVehicleId);
      this.positions[newVehicleId] = this.computeInitialPosition(newVehicleId);
      this.metrics.vehiclesActive = this.activeVehicles.size;
    }

    await Promise.all(publishPromises);
    this.metrics.lastPublishTime = new Date();
    this.tick++;

    // Log progress every 10 ticks
    if (this.tick % 10 === 0) {
      this.logger.info({
        tick: this.tick,
        activeVehicles: this.activeVehicles.size,
        eventsPublished: this.metrics.eventsPublished,
        eventsFailed: this.metrics.eventsFailed
      }, 'Simulator progress update');
    }
  }

  /**
   * Finds the next available vehicle ID for adding new vehicles.
   */
  private findNextAvailableVehicleId(): number {
    for (let i = 0; i < this.config.vehicles; i++) {
      if (!this.activeVehicles.has(i)) {
        return i;
      }
    }
    return this.config.vehicles; // This shouldn't happen due to the while loop condition
  }

  /**
   * Gets current simulator metrics.
   */
  getMetrics(): SimulatorMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets current simulator status.
   */
  getStatus(): SimulatorStatus {
    return {
      isRunning: this.isRunning,
      activeVehicles: this.activeVehicles.size,
      tick: this.tick
    };
  }
}
