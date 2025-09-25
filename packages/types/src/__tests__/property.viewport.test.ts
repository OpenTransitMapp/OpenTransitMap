import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { BBoxSchema } from '../schemas/viewport.js';

describe('property-based: viewport schemas', () => {
  it('BBox accepts north>=south and east>=west with zoom within [0,22]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 0, max: 22 }),
        (a, b, c, d, zoom) => {
          const south = Math.min(a, b);
          const north = Math.max(a, b);
          const west = Math.min(c, d);
          const east = Math.max(c, d);
          const ok = BBoxSchema.safeParse({ south, west, north, east, zoom }).success;
          expect(ok).toBe(true);
        },
      ),
    );
  });

  // tiles are no longer accepted in the request; clients should send bbox directly
});
