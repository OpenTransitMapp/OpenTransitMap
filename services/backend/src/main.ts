import { app } from './app.js';
import { InMemoryEventBus } from './pipeline/eventbus.js';
import { Processor } from './pipeline/processor.js';
import { DevFeeder } from './pipeline/dev-feeder.js';
import { store } from './services.js';

const port = process.env.PORT || 8080;
const server = app.listen(port, () => console.log(`Backend running on :${port}`));

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  try {
    proc?.stop();
    feeder?.stop();
  } catch (err) {
    // Log the error if stopping fails, but continue shutdown
    console.error('Error during pipeline shutdown:', err);
  }
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

// Optional dev pipeline wiring (no external dependencies)
let proc: Processor | undefined;
let feeder: DevFeeder | undefined;

if (process.env.ENABLE_DEV_PIPELINE === '1' || process.env.NODE_ENV === 'development') {
  const bus = new InMemoryEventBus();
  proc = new Processor({ bus, store });
  proc.start();

  if (process.env.ENABLE_DEV_FEEDER !== '0') {
    feeder = new DevFeeder({ bus, cityId: process.env.DEV_CITY_ID ?? 'nyc' });
    feeder.start();
  }
}
