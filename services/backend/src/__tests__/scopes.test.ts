import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Scopes API (v1)', () => {
  const base = '/api/v1';

  it('provisions a scope and returns a scoped frame (201)', async () => {
    const res = await request(app)
      .post(`${base}/trains/scopes`)
      .send({
        cityId: 'nyc',
        bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 },
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(typeof res.body.scopeId).toBe('string');
    expect(res.body.frame).toBeTruthy();
    expect(res.body.frame.cityId).toBe('nyc');
    expect(res.body.frame.vehicles).toBeInstanceOf(Array);
  });

  it('uses externalScopeKey when provided', async () => {
    const key = 'custom-scope-key';
    const res = await request(app)
      .post(`${base}/trains/scopes`)
      .send({
        cityId: 'nyc',
        bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96 },
        externalScopeKey: key,
      })
      .expect(201);
    expect(res.body.scopeId).toBe(key);
  });

  it('rejects invalid bbox (north < south) with 400 and details', async () => {
    const res = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 1, west: 0, north: 0, east: 1 } })
      .expect(400);

    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid viewport request/);
    const details: Array<{ path: string; message: string }> = res.body.details || [];
    expect(details.some((d) => d.path.endsWith('bbox.north') && /north must be >= south/.test(d.message))).toBe(true);
  });

  it('rejects invalid bbox (east < west) with 400 and details', async () => {
    const res = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 1, north: 1, east: 0 } })
      .expect(400);
    expect(res.body.ok).toBe(false);
    const details: Array<{ path: string; message: string }> = res.body.details || [];
    expect(details.some((d) => d.path.endsWith('bbox.east') && /east must be >= west/.test(d.message))).toBe(true);
  });

  it('rejects invalid zoom (non-integer or out of range) with 400', async () => {
    await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, zoom: 22.5 } })
      .expect(400);

    await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, zoom: 23 } })
      .expect(400);
  });

  it('rejects empty/whitespace cityId with 400', async () => {
    const res = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: '   ', bbox: { south: 0, west: 0, north: 1, east: 1 } })
      .expect(400);
    expect(res.body.ok).toBe(false);
  });

  it('rejects unknown top-level properties due to strict schema', async () => {
    const res = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1 }, extra: true })
      .expect(400);
    expect(res.body.ok).toBe(false);
  });

  it('rejects unknown properties inside bbox due to strict schema', async () => {
    const res = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1, extra: true } })
      .expect(400);
    expect(res.body.ok).toBe(false);
  });

  it('enforces externalScopeKey length boundaries (1..256)', async () => {
    await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1 }, externalScopeKey: 'a' })
      .expect(201);

    await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1 }, externalScopeKey: 'x'.repeat(256) })
      .expect(201);

    await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 0, west: 0, north: 1, east: 1 }, externalScopeKey: 'y'.repeat(257) })
      .expect(400);
  });

  it('computes the same scopeId for identical bbox regardless of zoom hint', async () => {
    const body = { cityId: 'nyc', bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96 } };
    const a = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ ...body, bbox: { ...body.bbox, zoom: 5 } })
      .expect(201);
    const b = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ ...body, bbox: { ...body.bbox, zoom: 12 } })
      .expect(201);
    expect(a.body.scopeId).toBe(b.body.scopeId);
  });

  it('returns 400 when scope param missing', async () => {
    const res = await request(app).get(`${base}/trains`).expect(400);
    expect(res.body.ok).toBe(false);
  });

  it('returns 404 for unknown scope', async () => {
    const res = await request(app).get(`${base}/trains`).query({ scope: 'does-not-exist' }).expect(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Scope not found/);
  });

  it('fetches previously provisioned scope with 200', async () => {
    const create = await request(app)
      .post(`${base}/trains/scopes`)
      .send({ cityId: 'nyc', bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96 } })
      .expect(201);
    const scopeId = create.body.scopeId as string;

    const res = await request(app).get(`${base}/trains`).query({ scope: scopeId }).expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.frame.scopeId).toBe(scopeId);
  });
});
