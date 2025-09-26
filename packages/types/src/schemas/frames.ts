import { z } from 'zod';
import { CityIdSchema, ScopeIdSchema, BBoxSchema } from './viewport.js';
import { IsoDateTimeStringSchema } from './common.js';
import { VehiclePositionSchema } from './transit.js';

/**
 * Full network snapshot at a timestamp.
 * vehicles may be an array for stable order or a record keyed by id; we start with array for simplicity.
 */
export const TrainsFrameSchema = z
  .object({
    cityId: CityIdSchema.describe('City identifier for which this snapshot was generated'),
    at: IsoDateTimeStringSchema.describe('Snapshot timestamp (ISO 8601, UTC). Indicates when the positions were sampled/assembled.'),
    checksum: z
      .string()
      .optional()
      .describe('Optional content hash for cache integrity and change detection (algorithm unspecified; for opaque comparison only).'),
    vehicles: z
      .array(VehiclePositionSchema)
      .describe('All in‑service vehicles across the entire city at the snapshot time.'),
  })
  .strict()
  .describe('Authoritative city‑wide snapshot of vehicles at a specific time.')
  .meta({
    id: 'TrainsFrame',
    example: {
      cityId: 'nyc',
      at: '2024-09-25T12:34:56Z',
      vehicles: [],
    },
  });
export type TrainsFrame = z.infer<typeof TrainsFrameSchema>;

/** Frame filtered to a normalized viewport scope. */
export const ScopedTrainsFrameSchema = z
  .object({
    scopeId: ScopeIdSchema.describe('Viewport scope key this frame is scoped to'),
    bbox: BBoxSchema.describe('Canonical bounding box for the scope'),
    cityId: CityIdSchema.describe('City identifier'),
    at: IsoDateTimeStringSchema.describe('Snapshot timestamp (ISO 8601, UTC)'),
    checksum: z.string().optional().describe('Optional content hash for this scoped frame'),
    vehicles: z
      .array(VehiclePositionSchema)
      .describe('Vehicles whose current positions intersect the scope bounding box at the snapshot time.'),
  })
  .strict()
  .describe('Viewport‑scoped snapshot with scope metadata.')
  .meta({
    id: 'ScopedTrainsFrame',
    example: {
      scopeId: 'scope_nyc_abc123',
      bbox: { south: 40.70, west: -74.02, north: 40.78, east: -73.94, zoom: 12 },
      cityId: 'nyc',
      at: '2024-09-25T12:34:56Z',
      vehicles: [],
    },
  });
export type ScopedTrainsFrame = z.infer<typeof ScopedTrainsFrameSchema>;
