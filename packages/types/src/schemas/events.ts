import { z } from 'zod';
import { IdSchema, IsoDateTimeStringSchema, NonEmptyStringSchema } from './common.js';
import { CityIdSchema, ScopeIdSchema } from './viewport.js';
import { VehiclePositionSchema } from './transit.js';

/**
 * Schema version string used in event envelopes for backward compatibility.
 * This allows the system to handle multiple versions of event schemas during upgrades.
 * 
 * @remarks
 * - Version is incremented only for breaking changes
 * - Consumers can branch behavior based on version
 * - Current version is "1"
 * 
 * @example
 * {
 *   schemaVersion: "1",
 *   data: { ... }
 * }
 */
export const SchemaVersionSchema = z.literal('1').describe('Schema/envelope version. Increment when breaking event contracts to allow consumers to branch.');
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

/**
 * Event that instructs the system to insert or update a vehicle's state.
 * This is the primary event type for maintaining real-time vehicle positions.
 * 
 * @remarks
 * - Used for both initial inserts and subsequent updates
 * - Timestamp indicates when the event was ingested, not vehicle position time
 * - Vehicle position time is in the payload's updatedAt field
 * 
 * @example
 * {
 *   kind: "vehicle.upsert",
 *   at: "2024-09-27T15:30:00Z",
 *   cityId: "nyc",
 *   payload: {
 *     id: "bus_123",
 *     coordinate: { lat: 40.75, lng: -73.98 },
 *     updatedAt: "2024-09-27T15:29:55Z",
 *     routeId: "M15",
 *     status: "in_service"
 *   },
 *   source: "mta_bus_feed"
 * }
 */
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

/**
 * Event that instructs the system to remove a vehicle from the current state.
 * Used when vehicles go out of service or are no longer being tracked.
 * 
 * @remarks
 * - Removes are explicit events, not just timeouts
 * - System may also remove vehicles after extended periods without updates
 * - Removal is idempotent - removing a non-existent vehicle is not an error
 * 
 * @example
 * {
 *   kind: "vehicle.remove",
 *   at: "2024-09-27T23:00:00Z",
 *   cityId: "nyc",
 *   payload: { id: "bus_123" },
 *   source: "mta_bus_feed"
 * }
 */
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

/**
 * Union type of all possible transit events.
 * This is the core event type used throughout the real-time ingestion pipeline.
 * 
 * @remarks
 * - Currently supports vehicle.upsert and vehicle.remove
 * - Events are processed in order within each city
 * - Events may be batched for efficiency
 * 
 * @see VehicleUpsertEvent
 * @see VehicleRemoveEvent
 */
export const TransitEventSchema = z.union([VehicleUpsertEventSchema, VehicleRemoveEventSchema]).describe('Canonical ingest event for vehicle state changes (upsert/remove).');
export type TransitEvent = z.infer<typeof TransitEventSchema>;

/**
 * Envelope type for events in the Valkey Streams transport.
 * Wraps transit events with version information for compatibility.
 * 
 * @remarks
 * - Provides schema versioning for backward compatibility
 * - Allows for future extension of envelope metadata
 * - Required for all events in the stream
 * 
 * @example
 * {
 *   schemaVersion: "1",
 *   data: {
 *     kind: "vehicle.upsert",
 *     at: "2024-09-27T15:30:00Z",
 *     cityId: "nyc",
 *     payload: { ... },
 *     source: "mta_bus_feed"
 *   }
 * }
 */
export const EventEnvelopeSchema = z
  .object({
    schemaVersion: SchemaVersionSchema.describe('Envelope version tag for compatibility.'),
    data: TransitEventSchema.describe('Event payload.'),
  })
  .strict()
  .describe('Event envelope carrying a canonical transit event and a version tag for evolution.');
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/**
 * Represents the difference between two consecutive frames within a scope.
 * Used to efficiently communicate state changes to clients without sending full frames.
 * 
 * @remarks
 * - More bandwidth-efficient than full frame updates
 * - Allows clients to maintain synchronized state
 * - Includes both additions/updates and removals
 * - Order matters: apply removes before upserts
 * 
 * @example
 * {
 *   scopeId: "v1|nyc|40.7|-74.0|40.8|-73.9",
 *   at: "2024-09-27T15:30:00Z",
 *   cityId: "nyc",
 *   upserts: [
 *     {
 *       id: "bus_123",
 *       coordinate: { lat: 40.75, lng: -73.98 },
 *       updatedAt: "2024-09-27T15:29:55Z"
 *     }
 *   ],
 *   removes: ["bus_456"]
 * }
 */
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
