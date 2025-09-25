import { describe, it, expect } from 'vitest';
import { TrainsFrameSchema, ScopedTrainsFrameSchema } from '../schemas/frames.js';

describe('frames schemas', () => {
  it('validates trains frame and rejects extra fields', () => {
    const frame = {
      cityId: 'nyc',
      at: '2024-01-01T00:00:00Z',
      vehicles: [
        { id: 'veh-1', coordinate: { lat: 0, lng: 0 }, updatedAt: '2024-01-01T00:00:00Z' },
      ],
    };
    expect(TrainsFrameSchema.safeParse(frame).success).toBe(true);
    expect(TrainsFrameSchema.safeParse({ ...frame, extra: true }).success).toBe(false);
  });

  it('validates scoped trains frame', () => {
    const scoped = {
      scopeId: 'scope-1',
      bbox: { south: 40, west: -74.5, north: 41, east: -73 },
      cityId: 'nyc',
      at: '2024-01-01T00:00:00Z',
      vehicles: [
        { id: 'veh-1', coordinate: { lat: 0, lng: 0 }, updatedAt: '2024-01-01T00:00:00Z' },
      ],
    };
    expect(ScopedTrainsFrameSchema.safeParse(scoped).success).toBe(true);
  });

  it('accepts optional checksum and rejects invalid vehicle entries', () => {
    const withChecksum = {
      cityId: 'nyc',
      at: '2024-01-01T00:00:00Z',
      checksum: 'abc123',
      vehicles: [
        { id: 'veh-1', coordinate: { lat: 0, lng: 0 }, updatedAt: '2024-01-01T00:00:00Z' },
      ],
    };
    expect(TrainsFrameSchema.safeParse(withChecksum).success).toBe(true);

    const bad = {
      ...withChecksum,
      vehicles: [
        { id: 'veh-1', coordinate: { lat: 999, lng: 0 }, updatedAt: '2024-01-01T00:00:00Z' },
      ],
    };
    expect(TrainsFrameSchema.safeParse(bad).success).toBe(false);
  });
});
