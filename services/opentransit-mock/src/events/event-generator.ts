import type { EventEnvelope, VehicleUpsertEvent, VehicleRemoveEvent } from '@open-transit-map/types';
import { EventEnvelopeSchema } from '@open-transit-map/types';
import type { Config } from '../config/index.js';
import type { Coordinate } from '../simulator/movement-patterns.js';

/**
 * Returns the current time as an ISO 8601 string (UTC).
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Builds and validates a synthetic vehicle.upsert event envelope.
 * 
 * @param vehicleId - Vehicle identifier
 * @param at - Timestamp for the event
 * @param coordinate - Vehicle position
 * @param config - Configuration object
 * @returns Validated event envelope
 */
export function makeVehicleUpsertPayload(
  vehicleId: number, 
  at: string, 
  coordinate: Coordinate, 
  config: Config
): EventEnvelope {
  const evt: VehicleUpsertEvent = {
    kind: 'vehicle.upsert',
    at,
    cityId: config.cityId,
    source: 'opentransit-mock',
    payload: {
      id: `mock_${vehicleId + 1}`,
      coordinate,
      updatedAt: at,
      status: 'in_service',
    },
  };
  const env: EventEnvelope = { schemaVersion: '1', data: evt };
  return EventEnvelopeSchema.parse(env);
}

/**
 * Builds and validates a synthetic vehicle.remove event envelope.
 * 
 * @param vehicleId - Vehicle identifier
 * @param at - Timestamp for the event
 * @param config - Configuration object
 * @returns Validated event envelope
 */
export function makeVehicleRemovePayload(
  vehicleId: number, 
  at: string, 
  config: Config
): EventEnvelope {
  const evt: VehicleRemoveEvent = {
    kind: 'vehicle.remove',
    at,
    cityId: config.cityId,
    source: 'opentransit-mock',
    payload: {
      id: `mock_${vehicleId + 1}`,
    },
  };
  const env: EventEnvelope = { schemaVersion: '1', data: evt };
  return EventEnvelopeSchema.parse(env);
}
