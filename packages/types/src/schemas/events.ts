import { z } from 'zod';
import { IdSchema, IsoDateTimeStringSchema, NonEmptyStringSchema } from './common.js';
import { CityIdSchema, ScopeIdSchema } from './viewport.js';
import { VehiclePositionSchema } from './transit.js';

/** Schema version string, used in envelopes for evolution. */
export const SchemaVersionSchema = z.literal('1').describe('Schema/envelope version. Increment when breaking event contracts to allow consumers to branch.');
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

/** Upsert a vehicle to the current state. */
export const VehicleUpsertEventSchema = z
  .object({
    kind: z.literal('vehicle.upsert'),
    at: IsoDateTimeStringSchema.describe('Ingest timestamp (ISO 8601, UTC). When the event was received/produced.'),
    cityId: CityIdSchema.describe('City this event belongs to.'),
    payload: VehiclePositionSchema.describe('Vehicle snapshot to upsert into current state.'),
    source: NonEmptyStringSchema.describe('Provider/source identifier (e.g., feed or adapter name).'),
  })
  .strict()
  .describe('Event instructing the system to insert/update a vehicle in the current state.');
export type VehicleUpsertEvent = z.infer<typeof VehicleUpsertEventSchema>;

/** Remove a vehicle from the current state. */
export const VehicleRemoveEventSchema = z
  .object({
    kind: z.literal('vehicle.remove'),
    at: IsoDateTimeStringSchema.describe('Ingest timestamp (ISO 8601, UTC).'),
    cityId: CityIdSchema.describe('City this event belongs to.'),
    payload: z.object({ id: IdSchema.describe('Vehicle identifier to remove.') }).strict(),
    source: NonEmptyStringSchema.describe('Provider/source identifier.'),
  })
  .strict()
  .describe('Event instructing the system to remove a vehicle from the current state.');
export type VehicleRemoveEvent = z.infer<typeof VehicleRemoveEventSchema>;

export const TransitEventSchema = z.union([VehicleUpsertEventSchema, VehicleRemoveEventSchema]).describe('Canonical ingest event for vehicle state changes (upsert/remove).');
export type TransitEvent = z.infer<typeof TransitEventSchema>;

/** Envelope for stream transport (Valkey Streams). */
export const EventEnvelopeSchema = z
  .object({
    schemaVersion: SchemaVersionSchema.describe('Envelope version tag for compatibility.'),
    data: TransitEventSchema.describe('Event payload.'),
  })
  .strict()
  .describe('Event envelope carrying a canonical transit event and a version tag for evolution.');
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/** Delta between frames for a scope. */
export const VehicleDeltaSchema = z
  .object({
    scopeId: ScopeIdSchema.describe('Scope identifier the delta is scoped to.'),
    at: IsoDateTimeStringSchema.describe('Frame timestamp (ISO 8601, UTC).'),
    cityId: CityIdSchema.describe('City identifier.'),
    upserts: z.array(VehiclePositionSchema).describe('Vehicles to add/update within the scope.'),
    removes: z.array(IdSchema).describe('Vehicle identifiers to remove from the scope.'),
  })
  .strict()
  .describe('Delta representation between two scoped frames: upserts and removes.');
export type VehicleDelta = z.infer<typeof VehicleDeltaSchema>;
