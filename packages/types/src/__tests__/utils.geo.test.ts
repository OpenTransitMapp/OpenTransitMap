import { describe, it, expect } from 'vitest';
import { clampCoordinate, clampToWebMercator } from '../utils/scope.js';

describe('geo utils', () => {
  it('clampCoordinate clamps lat and lng to Web Mercator bounds', () => {
    const c1 = clampCoordinate(100, 200);
    expect(c1.lat).toBeCloseTo(85.05113, 5);
    expect(c1.lng).toBe(180);

    const c2 = clampCoordinate(-100, -200);
    expect(c2.lat).toBeCloseTo(-85.05113, 5);
    expect(c2.lng).toBe(-180);

    const c3 = clampCoordinate(40.7, -74.0);
    expect(c3.lat).toBeCloseTo(40.7, 10);
    expect(c3.lng).toBeCloseTo(-74.0, 10);
  });

  it('clampToWebMercator clamps bboxes consistently', () => {
    const b = clampToWebMercator({ south: -100, west: -181, north: 100, east: 181 });
    expect(b.south).toBeCloseTo(-85.05113, 5);
    expect(b.north).toBeCloseTo(85.05113, 5);
    expect(b.west).toBe(-180);
    expect(b.east).toBe(180);
  });
});

