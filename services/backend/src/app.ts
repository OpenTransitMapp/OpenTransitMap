import express from 'express';
import client from 'prom-client';
import scopesRouter from './routes/scopes.js';
import docsRouter from './routes/docs.js';
import { errorHandler } from './errors.js';

// Create and configure the Express application (no listening here).
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
