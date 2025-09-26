import { Router } from 'express';
import {
  ViewportRequestSchema,
  ScopedTrainsFrameSchema,
  ScopeIdSchema,
} from '@open-transit-map/types';
import type { ViewportRequest, ScopedTrainsFrame, ScopeDefinition } from '@open-transit-map/types';
import { clampToWebMercator, quantizeBBox, computeScopeId } from '@open-transit-map/types';
import { badRequest, notFound, zodIssuesToPlain } from '../errors.js';
import { store } from '../store.js';

const router = Router();

// Parse, don't validate: turn untrusted input into a trusted domain object or throw.
function parseViewportRequest(body: unknown): ViewportRequest {
  const result = ViewportRequestSchema.safeParse(body);
  if (!result.success) {
    throw badRequest('Invalid viewport request', zodIssuesToPlain(result.error));
  }
  return result.data;
}

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
    // Persist with TTL
    store.upsertScope(scopeId, def);

    // Build a minimal scoped frame (empty vehicles for now)
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
    store.setFrame(scopeId, out);
    res.status(201).json({ ok: true, scopeId, frame: out });
  } catch (err) {
    next(err);
  }
});

router.get('/trains', (req, res, next) => {
  try {
    const scopeParam = req.query.scope;
    if (typeof scopeParam !== 'string' || scopeParam.length === 0) {
      throw badRequest('Missing or invalid scope parameter');
    }
    // Parse to branded ScopeId
    const scopeId = ScopeIdSchema.parse(scopeParam);
    const frame = store.getFrame(scopeId);
    if (!frame) {
      throw notFound('Scope not found');
    }
    res.json({ ok: true, frame });
  } catch (err) {
    next(err);
  }
});

export default router;
