import { z } from 'zod';
import { IdSchema, NonEmptyStringSchema } from './common.js';

/** City identifier (e.g., `nyc`, `tokyo`). */
export const CityIdSchema = NonEmptyStringSchema.brand('CityId').describe('City/operating area identifier');
export type CityId = z.infer<typeof CityIdSchema>;

/** Opaque, minted identifier for a viewport scope. */
export const ScopeIdSchema = IdSchema.brand('ScopeId').describe('Minted viewport scope identifier');
export type ScopeId = z.infer<typeof ScopeIdSchema>;

/** Slippy tile "z/x/y" string. */
export const SlippyTileSchema = z
  .string()
  .regex(/^\d+\/\d+\/\d+$/, 'Expected slippy tile string "z/x/y"')
  .describe('Slippy tile identifier (z/x/y)');
export type SlippyTile = z.infer<typeof SlippyTileSchema>;

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
    tiles: z.array(SlippyTileSchema).nonempty().optional(),
    bbox: BBoxSchema.optional(),
  })
  .refine((v) => !!v.tiles !== !!v.bbox, {
    message: 'Provide exactly one of "tiles" or "bbox"',
    path: ['tiles'],
  })
  .describe('Request payload to mint a viewport scope');
export type ViewportRequest = z.infer<typeof ViewportRequestSchema>;

/** Normalized, stored scope definition. */
export const ScopeDefinitionSchema = z
  .object({
    id: ScopeIdSchema,
    cityId: CityIdSchema,
    // store as bbox; tiles can be derived as needed
    bbox: BBoxSchema,
    createdAt: z
      .string()
      .describe('ISO timestamp when the scope was minted'),
  })
  .strict()
  .describe('Stored, normalized scope definition');
export type ScopeDefinition = z.infer<typeof ScopeDefinitionSchema>;
