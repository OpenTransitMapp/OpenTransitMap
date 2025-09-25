import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  NonEmptyStringSchema,
  IdSchema,
  IsoDateTimeStringSchema,
  LatitudeSchema,
  LongitudeSchema,
  CoordinateSchema,
  HttpUrlSchema,
} from '../schemas/common.js';

describe('property-based: common schemas', () => {
  it('NonEmptyString accepts any non-empty, non-whitespace-only string', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), (s) => {
        const ok = NonEmptyStringSchema.safeParse(s).success;
        expect(ok).toBe(true);
      }),
    );
  });

  it('Id accepts any non-empty, non-whitespace-only string', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), (s) => {
        const ok = IdSchema.safeParse(s).success;
        expect(ok).toBe(true);
      }),
    );
  });

  it('IsoDateTime accepts toISOString() only for years >= 1800 and <= 9999', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1800-01-01T00:00:00.000Z'), max: new Date('9999-12-31T23:59:59.999Z') }),
        (d) => {
          const s = d.toISOString();
          const ok = IsoDateTimeStringSchema.safeParse(s).success;
          expect(ok).toBe(true);
        },
      ),
    );
  });

  it('Latitude accepts [-90, 90] and rejects outside', () => {
    fc.assert(
      fc.property(fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(LatitudeSchema.safeParse(n).success).toBe(true);
      }),
    );
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ max: -90.0000001, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 90.0000001, noNaN: true, noDefaultInfinity: true }),
        ),
        (n) => {
          expect(LatitudeSchema.safeParse(n).success).toBe(false);
        },
      ),
    );
  });

  it('Longitude accepts [-180, 180] and rejects outside', () => {
    fc.assert(
      fc.property(fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(LongitudeSchema.safeParse(n).success).toBe(true);
      }),
    );
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ max: -180.0000001, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 180.0000001, noNaN: true, noDefaultInfinity: true }),
        ),
        (n) => {
          expect(LongitudeSchema.safeParse(n).success).toBe(false);
        },
      ),
    );
  });

  it('Coordinate accepts any pair of valid lat/lng', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (lat, lng) => {
          expect(CoordinateSchema.safeParse({ lat, lng }).success).toBe(true);
        },
      ),
    );
  });

  it('Url accepts arbitrary valid http/https URLs', () => {
    const httpUrlArb = fc.oneof(
      fc.domain().map((d) => `http://${d}`),
      fc.domain().map((d) => `https://${d}`),
    );
    fc.assert(
      fc.property(httpUrlArb, (u) => {
        expect(HttpUrlSchema.safeParse(u).success).toBe(true);
      }),
    );
  });

  it('Url rejects non-http(s) schemes (e.g., ftp)', () => {
    const nonHttpUrlArb = fc.domain().map((d) => `ftp://${d}`);
    fc.assert(
      fc.property(nonHttpUrlArb, (u) => {
        expect(HttpUrlSchema.safeParse(u).success).toBe(false);
      }),
    );
  });
});
