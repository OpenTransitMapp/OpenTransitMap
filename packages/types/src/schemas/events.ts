import { z } from 'zod';
import { IdSchema, IsoDateTimeStringSchema, NonEmptyStringSchema } from './common.js';
import { CityIdSchema, ScopeIdSchema } from './viewport.js';
import { VehiclePositionSchema } from './transit.js';

/** Schema version string, used in envelopes for evolution. */
export const SchemaVersionSchema = z.literal('1').describe('Schema/envelope version');
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

/** Upsert a vehicle to the current state. */
export const VehicleUpsertEventSchema = z
  .object({
    kind: z.literal('vehicle.upsert'),
    at: IsoDateTimeStringSchema.describe('Ingest timestamp'),
    cityId: CityIdSchema,
    payload: VehiclePositionSchema,
    source: NonEmptyStringSchema.describe('Provider/source identifier'),
  })
  .strict();
export type VehicleUpsertEvent = z.infer<typeof VehicleUpsertEventSchema>;

/** Remove a vehicle from the current state. */
export const VehicleRemoveEventSchema = z
  .object({
    kind: z.literal('vehicle.remove'),
    at: IsoDateTimeStringSchema,
    cityId: CityIdSchema,
    payload: z.object({ id: IdSchema }).strict(),
    source: NonEmptyStringSchema,
  })
  .strict();
export type VehicleRemoveEvent = z.infer<typeof VehicleRemoveEventSchema>;

export const TransitEventSchema = z.union([VehicleUpsertEventSchema, VehicleRemoveEventSchema]).describe('Canonical ingest event');
export type TransitEvent = z.infer<typeof TransitEventSchema>;

/** Envelope for stream transport (Valkey Streams). */
export const EventEnvelopeSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    data: TransitEventSchema,
  })
  .strict()
  .describe('Event envelope with version tag');
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/** Delta between frames for a scope. */
export const VehicleDeltaSchema = z
  .object({
    scopeId: ScopeIdSchema,
    at: IsoDateTimeStringSchema.describe('Frame timestamp'),
    cityId: CityIdSchema,
    upserts: z.array(VehiclePositionSchema),
    removes: z.array(IdSchema),
  })
  .strict();
export type VehicleDelta = z.infer<typeof VehicleDeltaSchema>;

