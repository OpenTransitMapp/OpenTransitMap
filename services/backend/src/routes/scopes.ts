import { Router } from 'express';
import {
  ViewportRequestSchema,
  ScopedTrainsFrameSchema,
  ScopeIdSchema,
} from '@open-transit-map/types';
import type { ViewportRequest, ScopedTrainsFrame, ScopeDefinition } from '@open-transit-map/types';
import { clampToWebMercator, quantizeBBox, computeScopeId } from '@open-transit-map/types';
import { badRequest, notFound, zodIssuesToPlain } from '../errors.js';
import { logger } from '../logger.js';
import type { InMemoryStore } from '../store.js';

interface ScopesRouterDeps {
  store: InMemoryStore;
}

/**
 * Creates the scopes router with injected dependencies.
 * 
 * @param deps - Router dependencies (store)
 * @returns Express router for scope management
 */
export function createScopesRouter(deps: ScopesRouterDeps): Router {
  const router = Router();

  /**
   * Parses and validates an incoming viewport request.
   * Following the principle "Parse, don't validate", this function turns untrusted input into a trusted domain object.
   * 
   * @param body - Raw request body to be parsed
   * @returns Validated ViewportRequest object
   * @throws {BadRequestError} If the request body fails validation, with detailed error information
   */
  function parseViewportRequest(body: unknown): ViewportRequest {
    const result = ViewportRequestSchema.safeParse(body);
    if (!result.success) {
      throw badRequest('Invalid viewport request', zodIssuesToPlain(result.error));
    }
    return result.data;
  }

  /**
   * POST /trains/scopes - Creates a new viewport scope for train tracking
   * 
   * This endpoint provisions a new viewport scope based on the provided bounding box.
   * It performs several normalization steps to ensure consistent scope identifiers:
   * 1. Validates the request body
   * 2. Clamps coordinates to Web Mercator bounds
   * 3. Quantizes the bounding box for stable keys
   * 4. Computes a deterministic scope ID
   * 5. Creates an initial empty frame
   * 
   * @route POST /trains/scopes
   * @param {ViewportRequest} req.body - Viewport request with cityId and bbox
   * @returns {ProvisionScopeResponse} 201 - New scope created with initial frame
   * @throws {BadRequestError} 400 - Invalid request body
   * 
   * @example
   * POST /trains/scopes
   * {
   *   "cityId": "nyc",
   *   "bbox": {
   *     "south": 40.70,
   *     "west": -74.02,
   *     "north": 40.78,
   *     "east": -73.94,
   *     "zoom": 12
   *   }
   * }
   */
  router.post('/trains/scopes', (req, res, next) => {
    try {
      const parsed = parseViewportRequest(req.body);
      // Normalization: clamp to Web Mercator bounds, quantize, compute key (zoom excluded)
      const clamped = clampToWebMercator(parsed.bbox);
      const precision = 1e-4; // ~11 meters
      const quantized = quantizeBBox(clamped, precision);
      const scopeId = parsed.externalScopeKey ?? computeScopeId(parsed.cityId, quantized, { precision });
      const createdAt = new Date().toISOString();
      const def: ScopeDefinition = {
        id: scopeId,
        cityId: parsed.cityId,
        bbox: quantized,
        createdAt,
      };

      logger.debug({ scopeId, cityId: parsed.cityId }, 'Creating new scope');
      
      // Persist with TTL
      deps.store.upsertScope(scopeId, def);

      // If a frame already exists for this scope (idempotent reuse), return it.
      const existing = deps.store.getFrame(scopeId);
      if (existing) {
        res.status(200).json({ ok: true, scopeId, frame: existing });
        return;
      }

      // Otherwise, build a minimal scoped frame (empty vehicles for now)
      const frame: ScopedTrainsFrame = {
        scopeId,
        bbox: quantized,
        cityId: parsed.cityId,
        at: createdAt,
        checksum: undefined,
        vehicles: [],
      };

      // Optionally validate output shape
      const out = ScopedTrainsFrameSchema.parse(frame);
      deps.store.setFrame(scopeId, out);
      res.status(201).json({ ok: true, scopeId, frame: out });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /trains - Retrieves the latest frame for a viewport scope
   * 
   * This endpoint returns the current state of all trains within a specific viewport scope.
   * The scope must have been previously created via POST /trains/scopes.
   * 
   * @route GET /trains
   * @param {string} req.query.scope - Scope identifier to fetch frame for
   * @returns {GetScopedTrainsResponse} 200 - Latest frame for the requested scope
   * @throws {BadRequestError} 400 - Missing or invalid scope parameter
   * @throws {NotFoundError} 404 - Scope not found or expired
   * 
   * @example
   * GET /trains?scope=v1|nyc|40.70|-74.02|40.78|-73.94
   */
  router.get('/trains', (req, res, next) => {
    try {
      const scopeParam = req.query.scope;
      if (typeof scopeParam !== 'string' || scopeParam.length === 0) {
        throw badRequest('Missing or invalid scope parameter');
      }
      // Parse to branded ScopeId
      const scopeIdResult = ScopeIdSchema.safeParse(scopeParam);
      if (!scopeIdResult.success) {
        throw badRequest('Missing or invalid scope parameter', zodIssuesToPlain(scopeIdResult.error));
      }
      const scopeId = scopeIdResult.data;
      logger.debug({ scopeId }, 'Fetching frame');
      
      const frame = deps.store.getFrame(scopeId);
      if (!frame) {
        throw notFound('Scope not found');
      }
      res.json({ ok: true, frame });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
