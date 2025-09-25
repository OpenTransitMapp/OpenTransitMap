import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { VehiclePositionSchema } from '../schemas/transit.js';

describe('property-based: transit schemas', () => {
  it('VehiclePosition accepts valid random coordinates and timestamps', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.date(),
        fc.option(fc.double({ min: 0, max: 359.9999, noNaN: true, noDefaultInfinity: true })),
        fc.option(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })),
        (id, lat, lng, d, bearingOpt, speedOpt) => {
          const payload: any = {
            id,
            coordinate: { lat, lng },
            updatedAt: d.toISOString(),
          };
          if (bearingOpt != null) payload.bearing = bearingOpt;
          if (speedOpt != null) payload.speedMps = speedOpt;
          expect(VehiclePositionSchema.safeParse(payload).success).toBe(true);
        },
      ),
    );
  });
});

