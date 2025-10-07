import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { ScopedTrainsFrame } from '@open-transit-map/types';
import { createScopesRouter } from '../routes/scopes.js';
import { InMemoryStore } from '../store.js';
import express from 'express';
import { createErrorHandler } from '../errors.js';
import { vi } from 'vitest';
import { createMockStore } from './test-utils.js';

describe('Scopes Router', () => {
  const base = '/api/v1';

  // Mock dependencies
  let mockStore: InMemoryStore;
  let app: express.Express;

  beforeEach(() => {
    mockStore = createMockStore();

    // Create test app with mocked dependencies
    app = express();
    app.use(express.json());
    app.use(base, createScopesRouter({ store: mockStore }));
    app.use(createErrorHandler());
  });

  describe('POST /trains/scopes', () => {
    const validRequest = {
      cityId: 'nyc',
      bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 },
    };

    it('should create a new scope and return a scoped frame with 201 status when no existing scope is found', async () => {
      // Ensure no existing frame so route creates a new one
      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send(validRequest)
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.scopeId).toEqual(expect.any(String));
      expect(res.body.frame).toMatchObject({
        scopeId: res.body.scopeId,
        cityId: validRequest.cityId,
        vehicles: [],
      });
      expect(mockStore.upsertScope).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cityId: validRequest.cityId,
          bbox: expect.objectContaining({
            south: expect.closeTo(validRequest.bbox.south, 5),
            west: expect.closeTo(validRequest.bbox.west, 5),
            north: expect.closeTo(validRequest.bbox.north, 5),
            east: expect.closeTo(validRequest.bbox.east, 5),
          }),
        })
      );
      expect(mockStore.setFrame).toHaveBeenCalled();
    });

    it('should return existing scope with 200 status when externalScopeKey is provided and scope already exists', async () => {
      const key = 'custom-scope-key';
      const frame: ScopedTrainsFrame = {
        scopeId: key,
        cityId: validRequest.cityId,
        bbox: validRequest.bbox,
        at: new Date().toISOString(),
        vehicles: [],
      };

      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(frame);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({ ...validRequest, externalScopeKey: key })
        .expect(200);

      expect(res.body.scopeId).toBe(key);
      expect(mockStore.upsertScope).toHaveBeenCalledWith(
        key,
        expect.any(Object)
      );
    });

    it('rejects invalid bbox (north < south) with 400', async () => {
      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({ 
          cityId: 'nyc', 
          bbox: { south: 1, west: 0, north: 0, east: 1 } 
        })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid viewport request/);
      expect(mockStore.upsertScope).not.toHaveBeenCalled();
    });

    it('rejects missing cityId with 400', async () => {
      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({ 
          bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 } 
        })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid viewport request/);
      expect(mockStore.upsertScope).not.toHaveBeenCalled();
    });

    it('rejects missing bbox with 400', async () => {
      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({ 
          cityId: 'nyc'
        })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid viewport request/);
      expect(mockStore.upsertScope).not.toHaveBeenCalled();
    });

    it('rejects invalid bbox coordinates (out of range) with 400', async () => {
      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({ 
          cityId: 'nyc', 
          bbox: { south: -91, west: -181, north: 91, east: 181, zoom: 12 } 
        })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid viewport request/);
      expect(mockStore.upsertScope).not.toHaveBeenCalled();
    });

    it('rejects invalid bbox types with 400', async () => {
      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({ 
          cityId: 'nyc', 
          bbox: { south: 'invalid', west: null, north: true, east: [], zoom: 12 } 
        })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid viewport request/);
      expect(mockStore.upsertScope).not.toHaveBeenCalled();
    });
  });

  describe('GET /trains/scopes (list)', () => {
    it('returns active scopes array', async () => {
      const scopeA = {
        id: 'v1|nyc|40.7000|-74.0200|40.7600|-73.9600',
        cityId: 'nyc',
        bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 },
        createdAt: new Date().toISOString(),
      };
      const scopeB = {
        id: 'v1|sf|37.7000|-122.5200|37.8200|-122.3600',
        cityId: 'sf',
        bbox: { south: 37.7, west: -122.52, north: 37.82, east: -122.36, zoom: 12 },
        createdAt: new Date().toISOString(),
      };

      (mockStore.forEachActiveScope as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce((cb: (s: any) => void) => {
        cb(scopeA); cb(scopeB);
      });

      const res = await request(app)
        .get(`${base}/trains/scopes`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.scopes)).toBe(true);
      expect(res.body.scopes).toEqual([scopeA, scopeB]);
    });

    it('returns empty array when no scopes', async () => {
      (mockStore.forEachActiveScope as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce((_cb: (s: any) => void) => {});
      const res = await request(app)
        .get(`${base}/trains/scopes`)
        .expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.scopes).toEqual([]);
    });
  });

  describe('GET /trains', () => {
    it('returns 404 for unknown scope', async () => {
      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const res = await request(app)
        .get(`${base}/trains`)
        .query({ scope: 'unknown-scope' })
        .expect(404);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Scope not found/);
    });

    it('returns 400 for missing scope parameter', async () => {
      const res = await request(app)
        .get(`${base}/trains`)
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid scope parameter/);
    });

    it('returns 400 for empty scope parameter', async () => {
      const res = await request(app)
        .get(`${base}/trains`)
        .query({ scope: '' })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid scope parameter/);
    });

    it('returns 400 for empty scope parameter', async () => {
      const res = await request(app)
        .get(`${base}/trains`)
        .query({ scope: '' })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid scope parameter/);
    });


    it('fetches previously provisioned scope', async () => {
      const scopeId = 'test-scope';
      const frame: ScopedTrainsFrame = {
        scopeId,
        cityId: 'nyc',
        bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96 },
        at: new Date().toISOString(),
        vehicles: [],
      };

      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(frame);

      const res = await request(app)
        .get(`${base}/trains`)
        .query({ scope: scopeId })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.frame).toEqual(frame);
      expect(mockStore.getFrame).toHaveBeenCalledWith(scopeId);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles very small bbox correctly', async () => {
      const smallBbox = {
        cityId: 'nyc',
        bbox: { south: 40.7, west: -74.02, north: 40.7001, east: -73.9999, zoom: 12 }
      };

      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send(smallBbox)
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.scopeId).toEqual(expect.any(String));
    });

    it('handles bbox at Web Mercator boundaries', async () => {
      const boundaryBbox = {
        cityId: 'nyc',
        bbox: { south: -85.05, west: -180, north: 85.05, east: 180, zoom: 12 }
      };

      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send(boundaryBbox)
        .expect(201);

      expect(res.body.ok).toBe(true);
    });

    it('handles very long cityId strings', async () => {
      const longCityId = 'a'.repeat(1000);
      const requestData = {
        cityId: longCityId,
        bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 }
      };

      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send(requestData)
        .expect(201);

      expect(res.body.ok).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('handles store errors gracefully', async () => {
      const error = new Error('Store operation failed');
      (mockStore.upsertScope as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw error;
      });

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({
          cityId: 'nyc',
          bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 }
        })
        .expect(500);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Internal Server Error/);
    });

    it('handles frame retrieval errors gracefully', async () => {
      const error = new Error('Frame retrieval failed');
      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw error;
      });

      const res = await request(app)
        .get(`${base}/trains`)
        .query({ scope: 'test-scope' })
        .expect(500);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Internal Server Error/);
    });

    it('handles invalid scope parameter format', async () => {
      const res = await request(app)
        .get(`${base}/trains`)
        .query({ scope: '' })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid scope parameter/);
    });
  });

  describe('Idempotency and State Management', () => {
    it('returns existing frame when scope already exists', async () => {
      // The scope ID will be computed from the bbox, so we need to mock the frame with the computed ID
      const computedScopeId = 'v1|nyc|40.7000|-74.0200|40.7600|-73.9600';
      const existingFrame: ScopedTrainsFrame = {
        scopeId: computedScopeId,
        cityId: 'nyc',
        bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96 },
        at: new Date().toISOString(),
        vehicles: [{ 
          id: 'bus_1', 
          status: 'in_service',
          coordinate: { lat: 40.75, lng: -73.95 },
          updatedAt: new Date().toISOString()
        }],
      };

      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(existingFrame);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({
          cityId: 'nyc',
          bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 }
        })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.scopeId).toBe(computedScopeId);
      expect(res.body.frame).toEqual(existingFrame);
      expect(mockStore.upsertScope).toHaveBeenCalled();
      expect(mockStore.setFrame).not.toHaveBeenCalled();
    });

    it('creates new frame when scope does not exist', async () => {
      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({
          cityId: 'nyc',
          bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 }
        })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.scopeId).toEqual(expect.any(String));
      expect(res.body.frame.vehicles).toEqual([]);
      expect(mockStore.upsertScope).toHaveBeenCalled();
      expect(mockStore.setFrame).toHaveBeenCalled();
    });

    it('handles external scope key with special characters', async () => {
      const specialKey = 'scope-with-special-chars_123!@#';
      const frame: ScopedTrainsFrame = {
        scopeId: specialKey,
        cityId: 'nyc',
        bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96 },
        at: new Date().toISOString(),
        vehicles: [],
      };

      (mockStore.getFrame as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(frame);

      const res = await request(app)
        .post(`${base}/trains/scopes`)
        .send({ 
          cityId: 'nyc',
          bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 },
          externalScopeKey: specialKey 
        })
        .expect(200);

      expect(res.body.scopeId).toBe(specialKey);
      expect(mockStore.upsertScope).toHaveBeenCalledWith(specialKey, expect.any(Object));
    });
  });
});
