import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('App endpoints', () => {
  it('GET /healthz returns ok payload', async () => {
    const res = await request(app).get('/healthz').expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('backend');
    expect(typeof res.body.time).toBe('string');
    // basic ISO timestamp sanity check
    expect(() => new Date(res.body.time)).not.toThrow();
  });

  it('GET /metrics exposes Prometheus metrics', async () => {
    const res = await request(app).get('/metrics').expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    // v8 coverage env may vary, just ensure it looks like Prometheus exposition
    expect(res.text).toContain('#');
  });
});

describe('OpenAPI + Docs routes', () => {
  it('GET /openapi.json (latest) returns a valid document', async () => {
    const res = await request(app).get('/openapi.json').expect(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.paths).toBeDefined();
  });

  it('GET /openapi/v1.json returns a valid document', async () => {
    const res = await request(app).get('/openapi/v1.json').expect(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.paths).toBeDefined();
  });

  it('GET /openapi/v2.json returns 404 for unknown version', async () => {
    const res = await request(app).get('/openapi/v2.json').expect(404);
    expect(res.body.ok).toBe(false);
    expect(String(res.body.error || '')).toMatch(/Unknown API version/i);
  });

  it('GET /docs serves Swagger UI HTML', async () => {
    // swagger-ui-express redirects /docs -> /docs/
    const res = await request(app).get('/docs/').expect(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text.length).toBeGreaterThan(100);
  });
});
