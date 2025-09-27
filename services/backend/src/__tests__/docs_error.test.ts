import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDocsRouter } from '../../src/routes/docs.js';
import { getOpenApiDocument } from '../../src/openapi.js';

const passThroughServe = [(_req: any, _res: any, next: any) => next()];
const noopSetup = () => (_req: any, _res: any, next: any) => next();

describe('Docs router error paths (via DI)', () => {
  it('returns 500 JSON when OpenAPI generation fails', async () => {
    const app1 = express();
    const throwingDeps = {
      getOpenApiDocument: (() => {
        throw new Error('boom');
      }) as typeof getOpenApiDocument,
      swaggerUi: { serve: passThroughServe, setup: noopSetup },
      supportedVersions: ['v1'] as const,
      defaultVersion: 'v1' as const,
    };
    app1.use(createDocsRouter(throwingDeps));

    const r1 = await request(app1).get('/openapi.json');
    expect(r1.status).toBe(500);
    expect(r1.body.ok).toBe(false);

    const r2 = await request(app1).get('/openapi/v1.json');
    expect(r2.status).toBe(500);
    expect(r2.body.ok).toBe(false);
  });

  it('returns 500 text when Swagger UI setup throws', async () => {
    const app2 = express();
    const deps = {
      getOpenApiDocument,
      swaggerUi: {
        serve: passThroughServe,
        setup: () => {
          throw new Error('UI setup fail');
        },
      },
      supportedVersions: ['v1'] as const,
      defaultVersion: 'v1' as const,
    };
    app2.use(createDocsRouter(deps));

    const r = await request(app2).get('/docs');
    expect(r.status).toBe(500);
    expect(String(r.text || '')).toMatch(/OpenAPI generation failed/i);
  });
});

