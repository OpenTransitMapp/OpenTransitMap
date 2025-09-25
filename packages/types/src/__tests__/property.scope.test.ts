import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { quantizeBBox, clampZoom, computeScopeId } from '../utils/scope.js';

describe('property-based: scope utils', () => {
  it('quantizeBBox preserves ordering north>=south and east>=west for random inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1e-8, max: 1e-2, noNaN: true, noDefaultInfinity: true }),
        (a, b, c, d, prec) => {
          const south = Math.min(a, b);
          const north = Math.max(a, b);
          const west = Math.min(c, d);
          const east = Math.max(c, d);
          const q = quantizeBBox({ south, west, north, east }, prec);
          expect(q.north).toBeGreaterThanOrEqual(q.south);
          expect(q.east).toBeGreaterThanOrEqual(q.west);
        },
      ),
    );
  });

  it('computeScopeId is stable under small variations below precision and ignores zoom', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(1e-6, 1e-5, 1e-4, 1e-3),
        fc.integer({ min: 0, max: 22 }),
        fc.integer({ min: 0, max: 22 }),
        (cityId, a, b, c, d, precision, z1, z2) => {
          const south = Math.min(a, b);
          const north = Math.max(a, b);
          const west = Math.min(c, d);
          const east = Math.max(c, d);
          const base = { south, west, north, east };
          const tiny = precision / 1000; // well below precision to avoid boundary rounding
          const varied = { south: south + tiny, west, north, east };
          const k1 = computeScopeId(cityId, base, { precision, zoom: z1 });
          const k2 = computeScopeId(cityId, varied as any, { precision, zoom: z2 });
          expect(k1).toBe(k2);
        },
      ),
    );
  });

  it('clampZoom outputs integers within [0,22] or undefined', () => {
    fc.assert(
      fc.property(fc.option(fc.double({ noNaN: true, noDefaultInfinity: true })), (z) => {
        const out = clampZoom(z as any);
        if (z == null) {
          expect(out).toBeUndefined();
        } else {
          expect(Number.isInteger(out as number)).toBe(true);
          expect((out as number) >= 0 && (out as number) <= 22).toBe(true);
        }
      }),
    );
  });
});
