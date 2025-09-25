import { z } from 'zod';
import { IdSchema, NonEmptyStringSchema, IsoDateTimeStringSchema } from './common.js';

/** City identifier (e.g., `nyc`, `tokyo`). */
export const CityIdSchema = NonEmptyStringSchema.brand('CityId').describe('City/operating area identifier');
export type CityId = z.infer<typeof CityIdSchema>;

/** Opaque, minted identifier for a viewport scope. */
export const ScopeIdSchema = IdSchema.brand('ScopeId').describe('Minted viewport scope identifier');
export type ScopeId = z.infer<typeof ScopeIdSchema>;

/** Bounding box request. */
export const BBoxSchema = z
  .object({
    south: z.number().gte(-90).lte(90).describe('South latitude'),
    west: z.number().gte(-180).lte(180).describe('West longitude'),
    north: z.number().gte(-90).lte(90).describe('North latitude'),
    east: z.number().gte(-180).lte(180).describe('East longitude'),
    zoom: z.number().int().gte(0).lte(22).optional().describe('Optional zoom hint'),
  })
  .refine((b) => b.north >= b.south, { message: 'north must be >= south', path: ['north'] })
  .refine((b) => b.east >= b.west, { message: 'east must be >= west', path: ['east'] })
  .describe('Geographic bounding box (WGS84)');
export type BBox = z.infer<typeof BBoxSchema>;

/** Viewport request body for scope provisioning. */
export const ViewportRequestSchema = z
  .object({
    cityId: CityIdSchema,
    bbox: BBoxSchema,
    externalScopeKey: z
      .string()
      .min(1)
      .max(256)
      .optional()
      .describe('Optional client-provided idempotency key for scope provisioning'),
  })
  .describe('Request payload to mint a viewport scope (bbox-only)');
export type ViewportRequest = z.infer<typeof ViewportRequestSchema>;

/** Normalized, stored scope definition. */
export const ScopeDefinitionSchema = z
  .object({
    id: ScopeIdSchema,
    cityId: CityIdSchema,
    // store as bbox; tiles can be derived as needed
    bbox: BBoxSchema,
    createdAt: IsoDateTimeStringSchema.describe('ISO timestamp when the scope was minted'),
  })
  .strict()
  .describe('Stored, normalized scope definition');
export type ScopeDefinition = z.infer<typeof ScopeDefinitionSchema>;
