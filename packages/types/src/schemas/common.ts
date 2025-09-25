import { z } from 'zod';
import { IANA_TIMEZONES_SET } from './iana-timezones.js';

/**
 * Common primitives shared across schemas (IDs, coordinates, timestamps).
 *
 * Conventions
 * - Schemas are suffixed with `Schema` and used for runtime validation.
 * - Types are derived via `z.infer<typeof ...>` and exported next to the schema.
 * - Where helpful, we use Zod "brand" to add nominal typing (e.g., `Id`).
 */

/** Non-empty string. Used for labels, names, codes. */
export const NonEmptyStringSchema = z.string().trim().min(1, { message: "String cannot be empty" });

/** Type of {@link NonEmptyStringSchema}. */
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;

/**
 * Opaque identifier (string) branded as `Id`.
  * Use for stable keys like route, stop, trip, vehicle IDs. Do not encode semantics.
 */
export const IdSchema = NonEmptyStringSchema.describe('Opaque identifier string (stable key; no semantics)');
/** Type of {@link IdSchema}. */
export type Id = z.infer<typeof IdSchema>;

/**
 * ISO 8601 datetime string.
 * Prefer UTC timestamps. Example: `2024-01-01T12:34:56Z`.
 */
export const IsoDateTimeStringSchema = z
  .iso
  .datetime()
  .refine(
    (s) => {
      // Only check if string is valid ISO datetime (zod already does this)
      // Now check range
      // Accepts only UTC (ending in 'Z'), so Date.parse is safe
      const d = new Date(s);
      if (isNaN(d.getTime())) return false;
      // Check year range
      const min = new Date('1800-01-01T00:00:00.000Z');
      const max = new Date('9999-12-31T23:59:59.999Z');
      return d >= min && d <= max;
    },
    { message: 'Datetime must be between 1800-01-01T00:00:00.000Z and 9999-12-31T23:59:59.999Z' }
  )
  .describe('ISO 8601 / RFC 3339 datetime string, UTC only, No timezone offsets are allowed; arbitrary sub-second precision is supported.');
/** Type of {@link IsoDateTimeStringSchema}. */
export type IsoDateTimeString = z.infer<typeof IsoDateTimeStringSchema>;

/** Absolute URL string (e.g., https://example.com), branded as `Url`. */
export const HttpUrlSchema = z.url({ protocol: /^https?$/ }).describe('HTTP/HTTPS URLs');
/** Type of {@link HttpUrlSchema}. */
export type Url = z.infer<typeof HttpUrlSchema>;

/** Latitude (degrees) in [-90, 90], branded as `Latitude`. */
export const LatitudeSchema = z
  .number()
  .gte(-90)
  .lte(90)
  .describe('Latitude in degrees [-90, 90]. A measure of distance North (positive) or South (negative) of the Equator (zero degrees)');
/** Type of {@link LatitudeSchema}. */
export type Latitude = z.infer<typeof LatitudeSchema>;

/** Longitude (degrees) in [-180, 180], branded as `Longitude`. */
export const LongitudeSchema = z
  .number()
  .gte(-180)
  .lte(180)
  .describe('Longitude in degrees [-180, 180]. A measure of distance East (positive) or West (negative) of the Prime Meridian (zero degrees)');
/** Type of {@link LongitudeSchema}. */
export type Longitude = z.infer<typeof LongitudeSchema>;

/** Geographic coordinate pair (lat/lng). */
export const CoordinateSchema = z
  .object({
    lat: LatitudeSchema.describe('Latitude component'),
    lng: LongitudeSchema.describe('Longitude component'),
  })
  .strict()
  .describe('Geographic coordinate pair (lat/lng) that uniquely identify a point on the globe');
/** Type of {@link CoordinateSchema}. */
export type Coordinate = z.infer<typeof CoordinateSchema>;

/** IANA timezone identifier, e.g. `America/New_York`. */
export const IanaTimezoneSchema = z
  .string()
  .refine((tz) => IANA_TIMEZONES_SET.has(tz), 'Invalid IANA timezone')
  .describe('IANA timezone identifier (e.g., America/New_York)');
/** Type of {@link IanaTimezoneSchema}. */
export type IanaTimezone = z.infer<typeof IanaTimezoneSchema>;

/** CSS hex color #RGB, #RGBA, #RRGGBB, or #RRGGBBAA. 
 * See: https://developer.mozilla.org/en-US/docs/Web/CSS/hex-color for more details.
*/
export const ColorHexSchema = z
  .string()
  .refine((hex) => hex.startsWith('#'), 'Hex color must start with #')
  .refine(
    (hex) =>
      hex.length === 4 || // #RGB
      hex.length === 5 || // #RGBA
      hex.length === 7 || // #RRGGBB
      hex.length === 9,   // #RRGGBBAA
    'Hex color must be 4, 5, 7, or 9 characters'
  )
  .refine(
    (hex) => {
      // Remove the leading #
      const digits = hex.slice(1);
      // Valid lengths: 3, 4, 6, 8
      if (![3, 4, 6, 8].includes(digits.length)) return false;
      for (let i = 0; i < digits.length; i++) {
        const c = digits[i];
        const isHex =
          (c >= '0' && c <= '9') ||
          (c >= 'a' && c <= 'f') ||
          (c >= 'A' && c <= 'F');
        if (!isHex) return false;
      }
      return true;
    },
    'Hex color must only contain valid hex digits after #'
  )
  .describe('CSS hex color: #RGB, #RGBA, #RRGGBB, or #RRGGBBAA (no regex, only valid hex digits, case-insensitive)');
/** Type of {@link ColorHexSchema}. */
export type ColorHex = z.infer<typeof ColorHexSchema>;
