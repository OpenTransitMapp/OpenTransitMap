import { z } from 'zod';

/**
 * Common primitives shared across schemas (IDs, coordinates, timestamps).
 *
 * Conventions
 * - Schemas are suffixed with `Schema` and used for runtime validation.
 * - Types are derived via `z.infer<typeof ...>` and exported next to the schema.
 * - Where helpful, we use Zod "brand" to add nominal typing (e.g., `Id`).
 */

/** Non-empty string (trim not applied). Useful for labels, names, codes. */
export const NonEmptyStringSchema = z
  .string()
  .min(1)
  .describe('Non-empty UTF-8 string (no trimming applied)');
/** Type of {@link NonEmptyStringSchema}. */
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;

/**
 * Opaque identifier (string) branded as `Id`.
 * Use for stable keys like route, stop, trip, vehicle IDs. Do not encode semantics.
 */
export const IdSchema = NonEmptyStringSchema.brand('Id').describe(
  'Opaque identifier string (stable key; no semantics)'
);
/** Type of {@link IdSchema}. */
export type Id = z.infer<typeof IdSchema>;

/**
 * ISO 8601/RFC 3339 datetime string. Validated via Date.parse (approximate).
 * Prefer UTC timestamps. Example: `2024-01-01T12:34:56Z`.
 */
export const IsoDateTimeStringSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: 'Invalid ISO8601 timestamp',
  })
  .brand('IsoDateTimeString')
  .describe('ISO 8601 / RFC 3339 datetime string (prefer UTC)');
/** Type of {@link IsoDateTimeStringSchema}. */
export type IsoDateTimeString = z.infer<typeof IsoDateTimeStringSchema>;

/** Absolute URL string (e.g., https://example.com), branded as `Url`. */
export const UrlSchema = z
  .string()
  .url()
  .brand('Url')
  .describe('Absolute HTTP/HTTPS URL');
/** Type of {@link UrlSchema}. */
export type Url = z.infer<typeof UrlSchema>;

/** Latitude (degrees) in [-90, 90], branded as `Latitude`. */
export const LatitudeSchema = z
  .number()
  .gte(-90)
  .lte(90)
  .brand('Latitude')
  .describe('Latitude in degrees [-90, 90]');
/** Type of {@link LatitudeSchema}. */
export type Latitude = z.infer<typeof LatitudeSchema>;

/** Longitude (degrees) in [-180, 180], branded as `Longitude`. */
export const LongitudeSchema = z
  .number()
  .gte(-180)
  .lte(180)
  .brand('Longitude')
  .describe('Longitude in degrees [-180, 180]');
/** Type of {@link LongitudeSchema}. */
export type Longitude = z.infer<typeof LongitudeSchema>;

/** Geographic coordinate pair (lat/lng). */
export const CoordinateSchema = z
  .object({
    lat: LatitudeSchema.describe('Latitude component'),
    lng: LongitudeSchema.describe('Longitude component'),
  })
  .strict()
  .describe('Geographic coordinate pair (lat/lng)');
/** Type of {@link CoordinateSchema}. */
export type Coordinate = z.infer<typeof CoordinateSchema>;
