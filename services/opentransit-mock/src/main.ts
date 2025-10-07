import { Redis } from 'ioredis';
import { createRedis, IoRedisClient, RedisMetrics } from '@open-transit-map/infra';
import { pino } from 'pino';
import { createConfig } from './config/index.js';
import { VehicleSimulator } from './simulator/index.js';
import { HealthServer } from './health/index.js';

/**
 * Application state for graceful shutdown.
 */
let simulator: VehicleSimulator | undefined;
let client: IoRedisClient | undefined;
let healthServer: HealthServer | undefined;

/**
 * Graceful shutdown handler.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  try {
    if (simulator) {
      await simulator.stop();
    }
    if (healthServer) {
      healthServer.stop();
    }
    if (client) {
      await client.quit();
    }
    console.log('Shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Sets up process signal handlers for graceful shutdown.
 */
function setupSignalHandlers(logger: any): void {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason: any) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    shutdown('unhandledRejection');
  });
}

/** Entrypoint: connects to Valkey and starts the simulator. */
async function main(): Promise<void> {
  // Create configuration
  const config = createConfig();
  
  // Create logger
  const logger = pino({
    level: config.logLevel,
    base: { service: 'opentransit-mock' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
    transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  });

  logger.info({ config }, 'Starting OpenTransit Mock service');

  try {
    // Connect to Valkey
    const raw: Redis = createRedis(config.valkeyUrl);
    raw.on('error', (error: Error) => {
      logger.error({ error }, 'Valkey connection error');
    });

    client = new IoRedisClient(raw, {
      logger: logger.child({ component: 'valkey-client' }),
      metrics: new RedisMetrics('valkey'),
      defaultRead: { blockMs: 5000, count: 100 },
    });

    await client.connect();
    logger.info({ valkeyUrl: config.valkeyUrl }, 'Connected to Valkey');

    // Create and start simulator
    simulator = new VehicleSimulator(client, config, logger.child({ component: 'simulator' }));
    await simulator.start();

    // Start health check server
    healthServer = new HealthServer(config.healthPort, logger.child({ component: 'health' }), simulator);
    healthServer.start();

    // Set up graceful shutdown
    setupSignalHandlers(logger);

    logger.info('OpenTransit Mock service started successfully');

  } catch (error) {
    logger.fatal({ error }, 'Failed to start OpenTransit Mock service');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
