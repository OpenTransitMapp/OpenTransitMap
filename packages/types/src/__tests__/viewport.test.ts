import { describe, it, expect } from 'vitest';
import { ViewportRequestSchema, ScopeDefinitionSchema, CityIdSchema } from '../schemas/viewport.js';
import { quantizeBBox, clampZoom, computeScopeKey, clampToWebMercator } from '../utils/scope.js';

describe('viewport schemas', () => {
  it.each([
    [{ cityId: 'nyc', bbox: { south: 40, west: -74.5, north: 41, east: -73, zoom: 10 } }, true],
    [{ cityId: 'nyc' }, false],
    [{ bbox: { south: 0, west: 0, north: 1, east: 1 } } as any, false],
  ])('viewport request %o -> %s', (payload, ok) => {
    expect(ViewportRequestSchema.safeParse(payload).success).toBe(ok);
  });

  it('accepts optional externalScopeKey for idempotent provisioning', () => {
    const payload = {
      cityId: 'nyc',
      bbox: { south: 40, west: -74.5, north: 41, east: -73, zoom: 10 },
      externalScopeKey: 'nyc|40.7|-74.02|40.76|-73.96|v1',
    };
    expect(ViewportRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('externalScopeKey min/max length boundaries', () => {
    const base = { cityId: 'nyc', bbox: { south: 40, west: -74.5, north: 41, east: -73 } };
    const min = { ...base, externalScopeKey: 'a' };
    const max = { ...base, externalScopeKey: 'x'.repeat(256) };
    const over = { ...base, externalScopeKey: 'y'.repeat(257) };
    expect(ViewportRequestSchema.safeParse(min).success).toBe(true);
    expect(ViewportRequestSchema.safeParse(max).success).toBe(true);
    expect(ViewportRequestSchema.safeParse(over as any).success).toBe(false);
  });

  it('rejects unknown properties due to strict schema', () => {
    const extra = {
      cityId: 'nyc',
      bbox: { south: 40, west: -74.5, north: 41, east: -73 },
      foo: 'bar',
    } as any;
    expect(ViewportRequestSchema.safeParse(extra).success).toBe(false);
  });

  it('emits helpful errors for bbox refinements', () => {
    const badNS = { cityId: 'nyc', bbox: { south: 1, west: 0, north: 0, east: 1 } };
    const res2 = ViewportRequestSchema.safeParse(badNS);
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.error.issues.some((i) => i.message.includes('north must be >= south'))).toBe(true);
      // ensure error is attached to the correct path
      expect(res2.error.issues.some((i) => i.path.join('.') === 'bbox.north')).toBe(true);
    }

    const badEW = { cityId: 'nyc', bbox: { south: 0, west: 1, north: 1, east: 0 } };
    const res3 = ViewportRequestSchema.safeParse(badEW);
    expect(res3.success).toBe(false);
    if (!res3.success) {
      expect(res3.error.issues.some((i) => i.message.includes('east must be >= west'))).toBe(true);
      expect(res3.error.issues.some((i) => i.path.join('.') === 'bbox.east')).toBe(true);
    }
  });

  it('rejects extra properties inside bbox (strict)', () => {
    const payload = { cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, extra: true } } as any;
    const r = ViewportRequestSchema.safeParse(payload);
    expect(r.success).toBe(false);
  });

  it('clamps bbox to Web Mercator bounds', () => {
    const bbox = { south: -100, west: -200, north: 100, east: 200 };
    const c = clampToWebMercator(bbox);
    expect(c.south).toBeCloseTo(-85.05113, 5);
    expect(c.north).toBeCloseTo(85.05113, 5);
    expect(c.west).toBe(-180);
    expect(c.east).toBe(180);
  });

  it('validates scope definition and createdAt timestamp', () => {
    const def = {
      id: 'scope-1',
      cityId: 'nyc',
      bbox: { south: 40, west: -74.5, north: 41, east: -73 },
      createdAt: '2024-01-01T00:00:00Z',
    };
    expect(ScopeDefinitionSchema.safeParse(def).success).toBe(true);
    expect(ScopeDefinitionSchema.safeParse({ ...def, createdAt: 'not-a-date' }).success).toBe(false);
  });

  it('quantizes bbox and clamps zoom; zoom not part of identity', () => {
    const bbox = { south: 40.700000123, west: -74.019999888, north: 40.760000444, east: -73.960000222 };
    const q = quantizeBBox(bbox, 1e-6);
    expect(q.south).toBeCloseTo(40.700000, 6);
    expect(q.west).toBeCloseTo(-74.020000, 6);
    expect(q.north).toBeCloseTo(40.760000, 6);
    expect(q.east).toBeCloseTo(-73.960000, 6);

    expect(clampZoom(undefined)).toBeUndefined();
    expect(clampZoom(12.4)).toBe(12);
    expect(clampZoom(-5)).toBe(0);
    expect(clampZoom(30)).toBe(22);

    const k1 = computeScopeKey('nyc', bbox, { precision: 1e-6, zoom: 12 });
    const k2 = computeScopeKey('nyc', { ...bbox, south: bbox.south + 1e-7 }, { precision: 1e-6, zoom: 5 });
    expect(k1).toBe(k2); // quantization makes the key stable; zoom excluded from identity
  });

  it.each([
    ['nyc', true],
    ['', false],
  ])('cityId %s -> %s', (value, ok) => {
    expect(CityIdSchema.safeParse(value as string).success).toBe(ok);
  });

  it.each([
    [{ cityId: 'nyc', bbox: { south: 1, west: 0, north: 0, east: 1 } }, false],
    [{ cityId: 'nyc', bbox: { south: 0, west: 1, north: 1, east: 0 } }, false],
    [{ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, zoom: 22 } }, true],
    [{ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, zoom: 23 } }, false],
    [{ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, zoom: -1 } }, false],
    [{ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, zoom: 3.5 } }, false],
  ])('bbox variant %o -> %s', (payload, ok) => {
    expect(ViewportRequestSchema.safeParse(payload).success).toBe(ok);
  });
});
