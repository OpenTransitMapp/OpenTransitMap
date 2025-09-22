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
    cityId: CityIdSchema,
    at: IsoDateTimeStringSchema.describe('Frame timestamp (ISO 8601)'),
    checksum: z.string().optional().describe('Optional content hash for cache integrity'),
    vehicles: z.array(VehiclePositionSchema).describe('All in-service vehicles at timestamp'),
  })
  .strict()
  .describe('Authoritative snapshot of vehicles for a city');
export type TrainsFrame = z.infer<typeof TrainsFrameSchema>;

/** Frame filtered to a normalized viewport scope. */
export const ScopedTrainsFrameSchema = z
  .object({
    scopeId: ScopeIdSchema,
    bbox: BBoxSchema.describe('Normalized scope bounding box'),
    cityId: CityIdSchema,
    at: IsoDateTimeStringSchema,
    checksum: z.string().optional(),
    vehicles: z.array(VehiclePositionSchema),
  })
  .strict()
  .describe('Viewport-scoped snapshot with scope metadata');
export type ScopedTrainsFrame = z.infer<typeof ScopedTrainsFrameSchema>;
