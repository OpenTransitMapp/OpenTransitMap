import express from 'express';
import client from 'prom-client';
import scopesRouter from './routes/scopes.js';
import docsRouter from './routes/docs.js';
import { errorHandler } from './errors.js';

/**
 * Main Express application instance for the OpenTransitMap backend.
 * This module sets up middleware, routes, and error handling but does not start the server.
 * 
 * Features:
 * - JSON request parsing
 * - Prometheus metrics collection
 * - Health check endpoint
 * - OpenAPI documentation
 * - Versioned API routes
 * - Global error handling
 * 
 * @remarks
 * The application is configured but not started here. Server startup happens in main.ts.
 * This separation allows for easier testing and deployment flexibility.
 */
export const app = express();

// JSON body parsing
app.use(express.json());

// Metrics
client.collectDefaultMetrics();

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// API routes (versioned)
app.use('/api/v1', scopesRouter);

// API documentation (OpenAPI) – generated from Zod/route contracts
app.use(docsRouter);

// Errors
app.use(errorHandler);
