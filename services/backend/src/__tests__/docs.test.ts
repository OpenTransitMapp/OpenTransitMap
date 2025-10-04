import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDocsRouter } from '../routes/docs.js';

describe('Docs router', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(createDocsRouter());
  });

  describe('OpenAPI JSON endpoint', () => {
    it('serves OpenAPI JSON with correct content type', async () => {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('returns valid OpenAPI 3.1.0 spec', async () => {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.1.0');
      expect(res.body.info).toBeDefined();
      expect(res.body.paths).toBeDefined();
    });

    it('includes API paths for scopes endpoints', async () => {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.paths['/api/v1/trains/scopes']).toBeDefined();
      expect(res.body.paths['/api/v1/trains']).toBeDefined();
    });

    it('includes health and metrics endpoints', async () => {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.paths['/healthz']).toBeDefined();
      expect(res.body.paths['/metrics']).toBeDefined();
    });
  });

  describe('Redirect behavior', () => {
    it('legacy /docs/v1 serves Swagger UI (SPA behavior)', async () => {
      const res = await request(app).get('/docs/v1?param=value');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('Swagger UI', () => {
    it('serves Swagger UI at /docs (with redirect)', async () => {
      const res = await request(app).get('/docs');
      expect(res.status).toBe(301); // Redirect to /docs/
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('includes swagger-ui in HTML content', async () => {
      const res = await request(app).get('/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });

    it('serves Swagger UI assets', async () => {
      const res = await request(app).get('/docs/swagger-ui.css');
      expect(res.status).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('serves Swagger UI for non-existent endpoints (SPA behavior)', async () => {
      const res = await request(app).get('/docs/nonexistent');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('swagger-ui');
    });

    it('serves Swagger UI for invalid API version (SPA behavior)', async () => {
      const res = await request(app).get('/docs/v2/openapi.json');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('HTTP methods', () => {
    it('handles GET requests to OpenAPI JSON', async () => {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
    });

    it('rejects POST requests to OpenAPI JSON', async () => {
      const res = await request(app).post('/openapi.json');
      expect(res.status).toBe(404);
    });

    it('handles HEAD requests to OpenAPI JSON', async () => {
      const res = await request(app).head('/openapi.json');
      expect(res.status).toBe(200);
    });
  });

});
