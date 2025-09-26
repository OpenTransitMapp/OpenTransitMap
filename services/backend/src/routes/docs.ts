/// <reference path="../types/swagger-ui-express.d.ts" />
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { getOpenApiDocument, type ApiMajorVersion } from '../openapi.js';

const router = Router();
const SUPPORTED_VERSIONS: ApiMajorVersion[] = ['v1'];
const DEFAULT_VERSION: ApiMajorVersion = 'v1';

// Default OpenAPI (latest)
router.get('/openapi.json', (_req, res) => {
  try {
    const doc = getOpenApiDocument(DEFAULT_VERSION);
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: 'OpenAPI generation failed', details: String(err?.message ?? err) });
  }
});

// Versioned OpenAPI
router.get('/openapi/:version.json', (req, res) => {
  try {
    const version = String(req.params.version) as ApiMajorVersion;
    if (!SUPPORTED_VERSIONS.includes(version)) {
      return res.status(404).json({ ok: false, error: `Unknown API version: ${version}` });
    }
    const doc = getOpenApiDocument(version);
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: 'OpenAPI generation failed', details: String(err?.message ?? err) });
  }
});

// Swagger UI with version dropdown; defaults to latest
router.use(
  '/docs',
  swaggerUi.serve,
  (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    try {
      const urls = SUPPORTED_VERSIONS.map((v) => ({ url: `/openapi/${v}.json`, name: v.toUpperCase() }));
      const opts = { explorer: true, swaggerOptions: { urls, url: `/openapi/${DEFAULT_VERSION}.json` } };
      return (swaggerUi.setup(undefined, opts) as any)(req, res, next);
    } catch (err) {
      res.status(500).send(`OpenAPI generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
);

export default router;
