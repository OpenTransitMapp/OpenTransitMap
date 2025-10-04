import { app } from './app.js';

const port = process.env.PORT || 8080;
const server = app.listen(port, () => console.log(`Backend running on :${port}`));

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  server.close((err?: Error) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
