import express from 'express';
import { createScopesRouter } from './routes/scopes.js';
import { createDocsRouter } from './routes/docs.js';
import { createErrorHandler } from './errors.js';
import { logger, httpLogger, metricsLogger } from './logger.js';
import type { Metrics } from './metrics.js';
import type { InMemoryStore } from './store.js';

interface AppDeps {
  metrics: Metrics;
  store: InMemoryStore;
}

/**
 * Creates and configures the Express application instance.
 * Uses dependency injection for configurable services (metrics, store).
 * 
 * @param deps - Core service dependencies (metrics, store)
 * @returns Configured Express application
 */
export function createApp(deps: AppDeps) {
  const app = express();

  // Request logging (must be first to capture all requests)
  app.use(httpLogger);

  // JSON body parsing (explicit limit)
  app.use(express.json({ limit: '100kb' }));

  // HTTP timing metrics
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      try {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1e9; // seconds
        const route = (req as any).route?.path || req.path || req.url;
        deps.metrics.observeHttpRequest(req.method, route, res.statusCode, duration);
      } catch {
        // best-effort metrics; ignore failures
      }
    });
    next();
  });

  app.get('/healthz', (_req, res) => {
    const time = new Date().toISOString();
    logger.info({ time }, 'Health check');
    res.json({ ok: true, service: 'backend', time });
  });

  app.get('/metrics', async (_req, res) => {
    metricsLogger.info('Metrics requested');
    res.set('Content-Type', 'text/plain');
    res.end(await deps.metrics.getMetrics());
  });

  // API routes (versioned)
  app.use('/api/v1', createScopesRouter({ 
    store: deps.store 
  }));

  // API documentation (OpenAPI) – generated from Zod/route contracts
  app.use(createDocsRouter());

  // Errors
  app.use(createErrorHandler());

  return app;
}

// Import core services for the default instance
import { metrics, store } from './services.js';

// Create default app instance with production services
export const app = createApp({ metrics, store });
