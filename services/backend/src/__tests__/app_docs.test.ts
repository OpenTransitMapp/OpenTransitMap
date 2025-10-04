import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createMockMetrics, createMockStore } from './test-utils.js';

describe('App Integration', () => {
  // Create test app instance with mocked dependencies
  const app = createApp({
    metrics: createMockMetrics(),
    store: createMockStore(),
  });

  describe('Health Check', () => {
    it('GET /healthz returns ok payload', async () => {
      const res = await request(app).get('/healthz').expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.service).toBe('backend');
      expect(typeof res.body.time).toBe('string');
      // basic ISO timestamp sanity check
      expect(() => new Date(res.body.time)).not.toThrow();
    });
  });

  describe('Metrics Endpoint', () => {
    it('GET /metrics exposes Prometheus metrics', async () => {
      const res = await request(app).get('/metrics').expect(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('test_metric');
    });
  });

  describe('OpenAPI Documentation', () => {
    it('GET /docs serves Swagger UI', async () => {
      const res = await request(app).get('/docs/').expect(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('swagger-ui');
    });

    it('GET /openapi.json returns valid OpenAPI spec', async () => {
      const res = await request(app).get('/openapi.json').expect(200);
      expect(res.body.openapi).toBe('3.1.0');
      expect(res.body.paths).toBeDefined();
      expect(res.body.paths['/api/v1/trains/scopes']).toBeDefined();
    });
  });

  describe('Metrics Middleware Error Handling', () => {
    it('handles metrics collection errors gracefully', async () => {
      // Create a mock metrics that throws an error
      const errorMetrics = {
        observeHttpRequest: () => {
          throw new Error('Metrics collection failed');
        },
        getMetrics: async () => 'test_metrics',
      };

      const errorApp = createApp({
        metrics: errorMetrics as any,
        store: createMockStore(),
      });

      // This should not throw an error even if metrics collection fails
      const res = await request(errorApp).get('/healthz').expect(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
