import express from 'express';
import client from 'prom-client';

const app = express();
client.collectDefaultMetrics();

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Backend running on :${port}`));
