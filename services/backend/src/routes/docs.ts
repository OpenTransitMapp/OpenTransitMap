import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { createOpenApiDocument } from '../openapi.js';

/**
 * Creates the API documentation router.
 * Serves OpenAPI documentation and Swagger UI.
 */
export function createDocsRouter() {
  const router = Router();
  const doc = createOpenApiDocument();
  // Normalize CJS/ESM interop just in case
  const ui: any = (swaggerUi as any)?.serve ? swaggerUi : (swaggerUi as any).default ?? swaggerUi;

  // Single unversioned OpenAPI JSON
  router.get('/openapi.json', (_, res) => {
    res.json(doc);
  });

  // Single unversioned Swagger UI at /docs
  // Use recommended signature (serve + setup) to avoid ESM/CJS quirks
  router.use('/docs', ui.serve, ui.setup(doc));

  return router;
}
