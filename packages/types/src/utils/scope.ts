import type { BBox, ScopeId } from '../schemas/viewport.js';
import { ScopeIdSchema } from '../schemas/viewport.js';

/** Clamp to integer zoom within [0,22]. Returns undefined if input is undefined. */
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
 * Produce a deterministic, human-readable scope key string for idempotency.
 * Not cryptographic. Backends may hash this string if needed.
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
 * Clamp a bbox to the valid Web Mercator domain (EPSG:3857):
 * latitude to ±85.05113°, longitude to ±180°.
 * Does not reorder; call after ordering and before quantization.
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

/** Clamp a single coordinate (lat,lng) to Web Mercator domain. */
export function clampCoordinate(lat: number, lng: number): { lat: number; lng: number } {
  const MAX_LAT = 85.05113;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  return {
    lat: clamp(lat, -MAX_LAT, MAX_LAT),
    lng: clamp(lng, -180, 180),
  };
}
