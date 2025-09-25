import type { BBox } from '../schemas/viewport.js';

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
export function computeScopeKey(
  cityId: string,
  bbox: BBox,
  opts?: { precision?: number; schemaVersion?: string; zoom?: number }
): string {
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
  return parts.join('|');
}
