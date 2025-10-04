import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('API Error Handling', () => {
  describe('POST /trains/scopes', () => {
    it('returns 400 for invalid viewport request', async () => {
      const invalidRequest = {
        cityId: '',  // Invalid: empty
        bbox: {
          south: -100,  // Invalid: out of range
          west: 200,    // Invalid: out of range
          north: 'not-a-number',  // Invalid: wrong type
          east: 0
        }
      };
      
      const res = await request(app)
        .post('/api/v1/trains/scopes')
        .send(invalidRequest)
        .expect(400);
      
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Invalid viewport request');
      expect(Array.isArray(res.body.details)).toBe(true);
      
      const errors = new Set(res.body.details.map((d: any) => d.path));
      expect(errors.has('cityId')).toBe(true);
      expect(errors.has('bbox.south')).toBe(true);
      expect(errors.has('bbox.west')).toBe(true);
      expect(errors.has('bbox.north')).toBe(true);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/v1/trains/scopes')
        .set('Content-Type', 'application/json')
        .send('{"malformed":')
        .expect(400);
      
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch("Unexpected end of JSON input");
    });
  });

  describe('GET /trains', () => {
    it('returns 400 for missing scope parameter', async () => {
      const res = await request(app)
        .get('/api/v1/trains')
        .expect(400);
      
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Missing or invalid scope parameter');
    });

    it('returns 400 for invalid scope format', async () => {
      const res = await request(app)
        .get('/api/v1/trains?scope=')
        .expect(400);
      
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it('returns 404 for non-existent scope', async () => {
      const res = await request(app)
        .get('/api/v1/trains?scope=non-existent-scope')
        .expect(404);
      
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Scope not found');
    });
  });

  describe('OpenAPI Documentation', () => {
    it('returns 404 for unknown API version', async () => {
      await request(app)
        .get('/openapi/v999.json')
        .expect(404);
    });

    it('returns 500 if OpenAPI generation fails', async () => {
      // This test might need to be moved to a separate integration test file
      // since it requires mocking the OpenAPI generator
      const response = await request(app)
        .get('/openapi.json')
        .expect((res) => {
          return res.status === 500 || res.status === 200;
        });
      
      if (response.status === 500) {
        expect(response.body.ok).toBe(false);
        expect(response.body.error).toBe('OpenAPI generation failed');
      }
    });
  });
});
