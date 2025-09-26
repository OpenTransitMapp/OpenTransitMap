/// <reference path="../types/swagger-ui-express.d.ts" />
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { getOpenApiDocument, type ApiMajorVersion } from '../openapi.js';

type DocsDeps = {
  getOpenApiDocument: typeof getOpenApiDocument;
  swaggerUi: {
    serve: import('express').RequestHandler[];
    setup: (...args: any[]) => import('express').RequestHandler;
  };
  supportedVersions?: ReadonlyArray<ApiMajorVersion>;
  defaultVersion?: ApiMajorVersion;
};

export function createDocsRouter(deps: DocsDeps = {
  getOpenApiDocument,
  swaggerUi,
  supportedVersions: ['v1'],
  defaultVersion: 'v1',
}) {
  const router = Router();
  const SUPPORTED_VERSIONS: ReadonlyArray<ApiMajorVersion> = deps.supportedVersions ?? ['v1'];
  const DEFAULT_VERSION: ApiMajorVersion = deps.defaultVersion ?? 'v1';

  // Default OpenAPI (latest)
  router.get('/openapi.json', (_req, res) => {
    try {
      const doc = deps.getOpenApiDocument(DEFAULT_VERSION);
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
      const doc = deps.getOpenApiDocument(version);
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: 'OpenAPI generation failed', details: String(err?.message ?? err) });
    }
  });

  // Swagger UI with version dropdown; defaults to latest
  router.use(
    '/docs',
    deps.swaggerUi.serve,
    (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
      try {
        const urls = SUPPORTED_VERSIONS.map((v) => ({ url: `/openapi/${v}.json`, name: v.toUpperCase() }));
        const opts = { explorer: true, swaggerOptions: { urls, url: `/openapi/${DEFAULT_VERSION}.json` } };
        return (deps.swaggerUi.setup(undefined, opts) as any)(req, res, next);
      } catch (err) {
        res.status(500).send(`OpenAPI generation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  return router;
}

// Default router for application use
export default createDocsRouter();
