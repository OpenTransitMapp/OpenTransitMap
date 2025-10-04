import type { BBox, ScopeId } from '../schemas/viewport.js';
import { ScopeIdSchema } from '../schemas/viewport.js';

/**
 * Clamps a zoom level to valid integer values for Web Mercator tiles.
 * 
 * @param zoom - Optional zoom level to clamp
 * @returns Clamped integer zoom level between 0 and 22, or undefined if input is undefined
 * @example
 * clampZoom(15.7) // returns 16
 * clampZoom(-1)   // returns 0
 * clampZoom(25)   // returns 22
 * clampZoom()     // returns undefined
 */
export function clampZoom(zoom?: number): number | undefined {
  if (zoom == null) return undefined;
  const z = Math.round(zoom);
  return Math.min(Math.max(z, 0), 22);
}

/**
 * Quantize a bbox to a fixed precision to stabilize scope keys and cache entries.
 * Ensures south<=north and west<=east remain satisfied.
 */
export function quantizeBBox(bbox: BBox, precision = 1e-6): BBox {
  const q = (v: number) => Math.round(v / precision) * precision;
  const south = q(bbox.south);
  const west = q(bbox.west);
  const north = q(bbox.north);
  const east = q(bbox.east);
  if (north < south) throw new Error('quantizeBBox: north < south after quantization');
  if (east < west) throw new Error('quantizeBBox: east < west after quantization');
  return { south, west, north, east };
}

/**
 * Produces a deterministic, human-readable scope identifier string for viewport caching and deduplication.
 * The scope ID combines city, bounding box, and schema version into a single string that uniquely 
 * identifies a viewport area.
 * 
 * @remarks
 * - Not intended for cryptographic purposes
 * - Backends may hash this string if needed
 * - Coordinates are quantized to ensure stable keys
 * - Format: v{version}|{cityId}|{south}|{west}|{north}|{east}
 * 
 * @param cityId - Identifier for the city/transit system
 * @param bbox - Bounding box coordinates (in degrees)
 * @param opts - Optional parameters
 * @param opts.precision - Coordinate quantization precision (default: 1e-6 ≈ 0.1m)
 * @param opts.schemaVersion - Schema version string (default: "1")
 * @param opts.zoom - Optional zoom level (currently unused)
 * @returns A branded ScopeId string that uniquely identifies this viewport
 * @throws {Error} If bbox coordinates become invalid after quantization
 * 
 * @example
 * computeScopeId("nyc", {south: 40.7, west: -74, north: 40.8, east: -73.9})
 * // returns "v1|nyc|40.700000|-74.000000|40.800000|-73.900000"
 */
export function computeScopeId(
  cityId: string,
  bbox: BBox,
  opts?: { precision?: number; schemaVersion?: string; zoom?: number }
): ScopeId {
  const precision = opts?.precision ?? 1e-6;
  const schemaVersion = opts?.schemaVersion ?? '1';
  const q = quantizeBBox(bbox, precision);
  // Canonical serialization with fixed decimals based on precision magnitude
  const decimals = Math.max(0, Math.ceil(Math.abs(Math.log10(precision))));
  const fmt = (n: number) => n.toFixed(decimals);
  const parts = [
    `v${schemaVersion}`,
    cityId,
    fmt(q.south),
    fmt(q.west),
    fmt(q.north),
    fmt(q.east),
  ];
  // Ensure it conforms to ScopeId shape at runtime and return typed value
  return ScopeIdSchema.parse(parts.join('|'));
}

// (computeScopeKey removed; use computeScopeId instead)

/**
 * Clamps a bounding box to the valid Web Mercator projection domain (EPSG:3857).
 * This ensures coordinates are valid for web map tiles and projections.
 * 
 * @remarks
 * - Latitude is clamped to ±85.05113° (Web Mercator limit)
 * - Longitude is clamped to ±180°
 * - Does not reorder coordinates; call after ordering and before quantization
 * - The specific latitude limit comes from the Web Mercator projection math:
 *   85.05113° = atan(sinh(π)) * 180/π
 * 
 * @param bbox - Bounding box to clamp
 * @returns New bounding box with coordinates clamped to valid ranges
 * 
 * @example
 * clampToWebMercator({
 *   south: -90, west: -200,
 *   north: 90, east: 200
 * })
 * // returns {
 * //   south: -85.05113, west: -180,
 * //   north: 85.05113, east: 180
 * // }
 */
export function clampToWebMercator(bbox: BBox): BBox {
  const MAX_LAT = 85.05113;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const south = clamp(bbox.south, -MAX_LAT, MAX_LAT);
  const north = clamp(bbox.north, -MAX_LAT, MAX_LAT);
  const west = clamp(bbox.west, -180, 180);
  const east = clamp(bbox.east, -180, 180);
  return { south, west, north, east };
}

/**
 * Clamps a single coordinate pair to the valid Web Mercator projection domain.
 * This is a convenience function for clamping individual points rather than bounding boxes.
 * 
 * @param lat - Latitude in degrees
 * @param lng - Longitude in degrees
 * @returns Object with clamped lat/lng values
 * 
 * @example
 * clampCoordinate(90, 200)
 * // returns { lat: 85.05113, lng: 180 }
 * 
 * @see clampToWebMercator for bounding box clamping
 */
export function clampCoordinate(lat: number, lng: number): { lat: number; lng: number } {
  const MAX_LAT = 85.05113;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  return {
    lat: clamp(lat, -MAX_LAT, MAX_LAT),
    lng: clamp(lng, -180, 180),
  };
}
