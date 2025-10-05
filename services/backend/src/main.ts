import { app } from './app.js';
import { InMemoryEventBus } from '@open-transit-map/infra';
import { createValkeyStreamsBus } from '@open-transit-map/infra';
import { createRedis, IoRedisClient, RedisMetrics } from '@open-transit-map/infra';
import { pipelineEventBusLogger, pipelineLogger, pipelineValkeyBusLogger } from './logger.js';
import { Processor } from './pipeline/processor/processor.js';
import { store } from './services.js';

async function main() {
  const port = process.env.PORT || 8080;
  const server = app.listen(port, () => console.log(`Backend running on :${port}`));

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down...`);
    try {
      proc?.stop();
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

  // Pipeline wiring (Valkey by default)
  let proc: Processor | undefined;
  const EVENT_BUS = process.env.EVENT_BUS ?? 'valkey';

  if (EVENT_BUS === 'valkey') {
    const url = process.env.VALKEY_URL ?? 'redis://127.0.0.1:6379';
    const maxLen = Number(process.env.VALKEY_STREAM_MAXLEN ?? '10000');
    const raw = createRedis(url);
    const client = new IoRedisClient(raw, {
      logger: pipelineValkeyBusLogger,
      metrics: new RedisMetrics('valkey'),
      defaultRead: { blockMs: 5000, count: 100 },
    });
    const bus = createValkeyStreamsBus(client, { maxLen }, pipelineValkeyBusLogger);
    proc = new Processor(store, bus, pipelineLogger);
    await proc.start();
  } else {
    // Fallback: in-memory bus (primarily for unit tests)
    const bus = new InMemoryEventBus(pipelineEventBusLogger);
    proc = new Processor(store, bus, pipelineLogger);
    await proc.start();
  }
}

main().catch(console.error);
