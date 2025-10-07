import { Router } from 'express';
import {
  ViewportRequestSchema,
  ScopedTrainsFrameSchema,
  ScopeIdSchema,
  ScopeDefinitionSchema,
} from '@open-transit-map/types';
import type { ViewportRequest, ScopedTrainsFrame, ScopeDefinition } from '@open-transit-map/types';
import { clampToWebMercator, quantizeBBox, computeScopeId } from '@open-transit-map/types';
import { badRequest, notFound, zodIssuesToPlain } from '../errors.js';
import { logger } from '../logger.js';
import type { InMemoryStore } from '../store.js';

/**
 * Dependencies required by the scopes router.
 *
 * @remarks
 * - The router is framework-agnostic beyond Express and relies on a minimal
 *   storage interface for persistence and TTL semantics.
 */
interface ScopesRouterDeps {
  /** Backing store used to persist scope definitions and scoped frames. */
  store: InMemoryStore;
}

/**
 * Creates the scopes router with injected dependencies.
 *
 * @remarks
 * Endpoints:
 * - POST `/trains/scopes` — Provision a viewport scope (idempotent).
 * - GET  `/trains` — Fetch latest scoped frame by `scope` query param.
 * - GET  `/trains/scopes` — List active (non-expired) scopes (debug/tooling).
 *
 * All request/response shapes are validated with Zod using shared schemas from
 * `@open-transit-map/types` and are reflected in the generated OpenAPI document.
 * See ADR-0004 for the rationale behind scope provisioning and key stability.
 *
 * @param deps - Router dependencies (store)
 * @returns Express router for scope management
 */
export function createScopesRouter(deps: ScopesRouterDeps): Router {
  const router = Router();

  /**
   * Parses and validates an incoming viewport request.
   *
   * Following “Parse, don’t validate”, this converts untrusted JSON into a
   * typed {@link ViewportRequest} or throws a structured 400 error.
   *
   * @param body - Raw request body to parse.
   * @returns Validated {@link ViewportRequest}.
   * @throws {AppError} 400 BadRequest with Zod issues when validation fails.
   *
   * @see ViewportRequestSchema
   */
  function parseViewportRequest(body: unknown): ViewportRequest {
    const result = ViewportRequestSchema.safeParse(body);
    if (!result.success) {
      throw badRequest('Invalid viewport request', zodIssuesToPlain(result.error));
    }
    return result.data;
  }

  /**
   * Provision a viewport scope for train tracking.
   *
   * Normalization pipeline ensures stable scope identity:
   * 1) Clamp bbox to Web Mercator bounds; 2) Quantize coordinates (fixed precision);
   * 3) Compute deterministic `scopeId` (or honor `externalScopeKey`).
   * If a frame already exists for the computed key, returns 200 with the existing frame; otherwise 201 with a new empty frame.
   *
   * @route POST /trains/scopes
   * @param req.body - {@link ViewportRequest} with `cityId` and `bbox`.
   * @returns 200|201 JSON matching `ProvisionScopeResponseSchema`.
   * @throws 400 on invalid body (Zod issues), 500 on unexpected errors.
   *
   * @example
   * curl -sS -X POST /api/v1/trains/scopes \
   *   -H 'Content-Type: application/json' \
   *   -d '{"cityId":"nyc","bbox":{"south":40.70,"west":-74.02,"north":40.78,"east":-73.94,"zoom":12}}'
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
   * Fetch the latest scoped frame for a given scope.
   *
   * Requires a previously provisioned scope. The `scope` query string is
   * validated with {@link ScopeIdSchema} and returns the latest frame if present.
   *
   * @route GET /trains
   * @param req.query.scope - Scope identifier (string)
   * @returns 200 JSON matching `GetScopedTrainsResponseSchema`.
   * @throws 400 on missing/invalid `scope`, 404 when scope/frame not found.
   *
   * @example
   * curl -sS "/api/v1/trains?scope=v1|nyc|40.70|-74.02|40.78|-73.94"
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

  /**
   * List active (non‑expired) viewport scopes.
   *
   * Returns normalized {@link ScopeDefinition} objects that are currently in
   * the store. Intended for debugging and tooling; not optimized for frequent
   * client polling.
   *
   * @route GET /trains/scopes
   * @returns 200 JSON with `{ ok: true, scopes: ScopeDefinition[] }`.
   */
  router.get('/trains/scopes', (_req, res, next) => {
    try {
      const scopes: ScopeDefinition[] = [];
      deps.store.forEachActiveScope((s) => scopes.push(ScopeDefinitionSchema.parse(s)));
      res.json({ ok: true, scopes });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
