import type { InMemoryStore } from '../store.js';
import type { EventBus } from './eventbus.js';
import { Topics } from './topics.js';
import { VehicleUpsertEventSchema, VehicleRemoveEventSchema, EventEnvelopeSchema, type EventEnvelope } from '@open-transit-map/types';
import { pipelineProcessorLogger } from '../logger.js';

type VehiclePosition = import('@open-transit-map/types').VehiclePosition;
type BBox = import('@open-transit-map/types').BBox;

/**
 * Minimal event processor that maintains per‑city vehicle state and updates
 * scoped frames for active scopes.
 *
 * @remarks
 * - Subscribes to {@link Topics.EventsNormalized}
 * - On each upsert/remove, recomputes frames for the affected city’s active scopes
 * - State is in‑memory and ephemeral; suitable for dev/local testing
 */
export class Processor {
  private running = false;
  private unsub?: () => void;

  // cityId -> Map<vehicleId, VehiclePosition>
  private readonly state = new Map<string, Map<string, VehiclePosition>>();

  constructor(private readonly deps: { bus: EventBus; store: InMemoryStore }) {}

  /**
   * Starts the processor: subscribes to normalized vehicle events and updates scoped frames.
   * Safe to call multiple times (idempotent).
   */
  start() {
    if (this.running) return;
    this.running = true;
    // Subscribe to the normalized events topic; store unsubscribe function
    pipelineProcessorLogger.info({ topic: Topics.EventsNormalized }, 'Processor starting: subscribing to topic');
    this.unsub = this.deps.bus.subscribe<EventEnvelope>(
      Topics.EventsNormalized,
      'processor',      // consumer group
      'processor-1',    // consumer id
      async (envelope) => this.handleEnvelope(envelope)
    );
  }

  /**
   * Stops consuming events and releases resources.
   * Safe to call multiple times.
   */
  stop() {
    this.running = false;
    if (this.unsub) this.unsub();
    this.unsub = undefined;
    pipelineProcessorLogger.info('Processor stopped');
  }

  /**
   * Parses and handles a single event envelope.
   * Validates the envelope and delegates to upsert/remove handlers.
   */
  private async handleEnvelope(envelope: EventEnvelope) {
    // Validate envelope and specific event kinds defensively
    const e = EventEnvelopeSchema.parse(envelope);
    if (VehicleUpsertEventSchema.safeParse(e.data).success) {
      const evt = VehicleUpsertEventSchema.parse(e.data);
      pipelineProcessorLogger.debug({ kind: evt.kind, cityId: evt.cityId, id: evt.payload.id }, 'Upsert event');
      const city = evt.cityId;
      const byId = this.state.get(city) ?? new Map<string, VehiclePosition>();
      byId.set(evt.payload.id, evt.payload);
      this.state.set(city, byId);
      this.refreshScopes(city);
    } else if (VehicleRemoveEventSchema.safeParse(e.data).success) {
      const evt = VehicleRemoveEventSchema.parse(e.data);
      pipelineProcessorLogger.debug({ kind: evt.kind, cityId: evt.cityId, id: evt.payload.id }, 'Remove event');
      const city = evt.cityId;
      const byId = this.state.get(city) ?? new Map<string, VehiclePosition>();
      byId.delete(evt.payload.id);
      this.state.set(city, byId);
      this.refreshScopes(city);
    } else {
      pipelineProcessorLogger.warn({ envelope: e }, 'Unhandled event type');
    }
  }

  /**
   * Checks whether a vehicle position lies within a bounding box.
   */
  private within(b: BBox, p: VehiclePosition): boolean {
    const { lat, lng } = p.coordinate;
    return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
  }

  /**
   * Recomputes frames for all active scopes in the given city and writes them
   * to the store.
   *
   * @param cityId - City to refresh scoped frames for
   */
  private refreshScopes(cityId: string) {
    const byId = this.state.get(cityId) ?? new Map<string, VehiclePosition>();
    const now = new Date().toISOString();
    let scopesUpdated = 0;
    let vehiclesTotal = 0;
    this.deps.store.forEachActiveScope((scope) => {
      if (scope.cityId !== cityId) return;
      const vehicles = Array.from(byId.values()).filter((v) => this.within(scope.bbox, v));
      vehiclesTotal += vehicles.length;
      this.deps.store.setFrame(scope.id, {
        scopeId: scope.id,
        bbox: scope.bbox,
        cityId: scope.cityId,
        at: now,
        vehicles,
      });
      scopesUpdated += 1;
    });
    pipelineProcessorLogger.debug({ cityId, scopesUpdated, vehiclesTotal }, 'Refreshed scoped frames');
  }
}
