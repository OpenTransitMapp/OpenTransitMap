import { z } from 'zod';
import { NonEmptyStringSchema, IsoDateTimeStringSchema } from './common.js';

/** City identifier (e.g., `nyc`, `tokyo`). */
export const CityIdSchema = NonEmptyStringSchema
  .describe('City or operating area identifier. Stable key used to group resources that belong to the same transit service area (e.g., "nyc", "tokyo"). Short, lowercase, URL‑safe; not necessarily a legal name.')
  .meta({ id: 'CityId', example: 'nyc' });
export type CityId = z.infer<typeof CityIdSchema>;

/** Scope identifier (opaque string). */
export const ScopeIdSchema = z
  .string()
  .min(1)
  .describe('Minted viewport scope identifier. Opaque, stable key representing a normalized bounding box within a specific city; may be client‑supplied via `externalScopeKey` or server‑generated from city + bbox. No embedded semantics beyond identity.')
  .meta({ id: 'ScopeId', example: 'scope_nyc_abc123' });
export type ScopeId = z.infer<typeof ScopeIdSchema>;

/** Bounding box request. */
export const BBoxSchema = z
  .object({
    south: z.number().gte(-90).lte(90).describe('South latitude in degrees (WGS84)'),
    west: z.number().gte(-180).lte(180).describe('West longitude in degrees (WGS84)'),
    north: z.number().gte(-90).lte(90).describe('North latitude in degrees (WGS84) — must be ≥ south'),
    east: z.number().gte(-180).lte(180).describe('East longitude in degrees (WGS84) — must be ≥ west'),
    zoom: z
      .number()
      .int()
      .gte(0)
      .lte(22)
      .optional()
      .describe('Optional zoom hint for clients (0..22); not used for identity'),
  })
  .refine((b) => b.north >= b.south, { message: 'north must be >= south', path: ['north'] })
  .refine((b) => b.east >= b.west, { message: 'east must be >= west', path: ['east'] })
  .strict()
  .describe('Geographic bounding box (WGS84). Defines the rectangular viewport of interest; server clamps/quantizes as needed for consistency and key stability.')
  .meta({
    id: 'BBox',
    example: { south: 40.70, west: -74.02, north: 40.78, east: -73.94, zoom: 12 },
  });
export type BBox = z.infer<typeof BBoxSchema>;

/** Viewport request body for scope provisioning. */
export const ViewportRequestSchema = z
  .object({
    cityId: CityIdSchema.describe('City identifier to scope within'),
    bbox: BBoxSchema.describe('Requested viewport bounds; will be normalized to a canonical bbox for identity'),
    externalScopeKey: z
      .string()
      .min(1)
      .max(256)
      .optional()
      .describe('Optional client‑provided idempotency key. If provided, the server will reuse the same scope for identical requests to avoid duplication.'),
  })
  .strict()
  .describe('Request payload to mint a viewport scope. The server normalizes the bbox (clamp + quantize) and returns a stable scope identifier with an initial, possibly empty, frame.')
  .meta({
    id: 'ViewportRequest',
    example: {
      cityId: 'nyc',
      bbox: { south: 40.70, west: -74.02, north: 40.78, east: -73.94, zoom: 12 },
      externalScopeKey: 'viewport:nyc:midtown-v1',
    },
  });
export type ViewportRequest = z.infer<typeof ViewportRequestSchema>;

/** Normalized, stored scope definition. */
export const ScopeDefinitionSchema = z
  .object({
    id: ScopeIdSchema.describe('Stable, minted identifier of the scope'),
    cityId: CityIdSchema.describe('City this scope belongs to'),
    // store as bbox; tiles can be derived as needed
    bbox: BBoxSchema.describe('Canonical, normalized bounding box for this scope'),
    createdAt: IsoDateTimeStringSchema.describe('Server timestamp when the scope was minted'),
  })
  .strict()
  .describe('Stored, normalized scope definition. Represents a canonical, deduplicated viewport used to filter frames and streams.')
  .meta({ id: 'ScopeDefinition' });
export type ScopeDefinition = z.infer<typeof ScopeDefinitionSchema>;
