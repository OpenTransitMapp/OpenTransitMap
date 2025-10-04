import type { EventBus } from './eventbus.js';
import { Topics } from './topics.js';
import type { VehicleUpsertEvent, EventEnvelope, Coordinate } from '@open-transit-map/types';
import { pipelineFeederLogger } from '../logger.js';

/**
 * Dev-only synthetic event publisher for local testing.
 *
 * Publishes `vehicle.upsert` events on {@link Topics.EventsNormalized}
 * at a fixed interval, simulating vehicles moving in a small loop so
 * the processor can generate scoped frames without any external feeds.
 *
 * @remarks
 * - Intended for development and demos only; not suitable for production.
 * - Guarded by environment flags in `src/main.ts`.
 * - Uses an in-memory event bus by default.
 */
export class DevFeeder {
  private timer?: ReturnType<typeof setInterval>;

  /**
   * Creates a new DevFeeder.
   *
   * @param deps - Dependencies and runtime options
   * @param deps.bus - Event bus to publish synthetic events on
   * @param deps.cityId - City identifier (default: `nyc`)
   * @param deps.vehicles - Number of vehicles to simulate (1..1000; default: 12)
   * @param deps.intervalMs - Publish interval in milliseconds (200..10000; default: 1000)
   */
  constructor(private readonly deps: { bus: EventBus; cityId?: string; vehicles?: number; intervalMs?: number }) {}

  /**
   * Starts publishing synthetic `vehicle.upsert` events on an interval.
   * Calling this method multiple times is safe (subsequent calls are ignored).
   */
  start() {
    if (this.timer) return;
    const cityId = this.deps.cityId ?? 'nyc';
    const vehicleCount = Math.max(1, Math.min(1000, this.deps.vehicles ?? 12));
    const intervalMs = Math.max(200, Math.min(10_000, this.deps.intervalMs ?? 1000));
    pipelineFeederLogger.info({ cityId, vehicleCount, intervalMs }, 'DevFeeder starting');

    // Create initial positions in a small bbox in Manhattan-like coords
    const center: Coordinate = { lat: 40.75, lng: -73.98 };
    const radius = 0.02; // ~2km
    const positions: Coordinate[] = Array.from({ length: vehicleCount }).map((_, i) => ({
      lat: center.lat + (Math.sin(i) * radius) / 2,
      lng: center.lng + (Math.cos(i) * radius) / 2,
    }));

    let tick = 0;
    this.timer = setInterval(async () => {
      for (let i = 0; i < vehicleCount; i++) {
        // Move each point a bit around a circle
        const t = Date.now() / 5000 + i;
        positions[i] = {
          lat: center.lat + Math.sin(t) * radius,
          lng: center.lng + Math.cos(t) * radius,
        };

        const evt: VehicleUpsertEvent = {
          kind: 'vehicle.upsert',
          at: new Date().toISOString(),
          cityId,
          source: 'dev-feeder',
          payload: {
            id: `dev_${i + 1}`,
            coordinate: positions[i],
            updatedAt: new Date().toISOString(),
            status: 'in_service',
          },
        };

        const env: EventEnvelope = { schemaVersion: '1', data: evt };
        await this.deps.bus.publish(Topics.EventsNormalized, env);
      }
      tick++;
      if (tick % 30 === 0) {
        pipelineFeederLogger.debug({ cityId, vehicleCount, tick }, 'DevFeeder published batch');
      }
    }, intervalMs);
  }

  /**
   * Stops publishing events and clears the timer if running.
   * It is safe to call this method even if the feeder is not started.
   */
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    pipelineFeederLogger.info('DevFeeder stopped');
  }
}
