import { Redis } from 'ioredis';
import { createRedis, IoRedisClient, RedisMetrics } from '@open-transit-map/infra';
import { pino } from 'pino';
import type { EventEnvelope, VehicleUpsertEvent } from '@open-transit-map/types';
import { EventEnvelopeSchema } from '@open-transit-map/types';

/**
 * Runtime configuration for the mock event producer.
 */
type Config = {
  valkeyUrl: string;
  cityId: string;
  vehicles: number;
  intervalMs: number;
  stream: string;
  source: string;
  center: { lat: number; lng: number };
  radius: number;
  trimMaxLen: number;
};

const config: Config = {
  valkeyUrl: process.env.VALKEY_URL || 'redis://valkey:6379',
  cityId: process.env.CITY_ID || 'nyc',
  vehicles: Math.max(1, Math.min(1000, Number(process.env.VEHICLES || '12'))),
  intervalMs: Math.max(200, Math.min(10000, Number(process.env.INTERVAL_MS || '1000'))),
  stream: process.env.STREAM || 'events.normalized',
  source: 'opentransit-mock',
  center: { lat: 40.75, lng: -73.98 },
  radius: 0.02,
  trimMaxLen: 10000,
};

/** Simple geographic coordinate (WGS84 degrees). */
type Coordinate = { lat: number; lng: number };

/** Returns the current time as an ISO 8601 string (UTC). */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Computes a position on a circle around a center for a given angle/time step.
 */
function computePosition(center: Coordinate, radius: number, t: number): Coordinate {
  return {
    lat: center.lat + Math.sin(t) * radius,
    lng: center.lng + Math.cos(t) * radius,
  };
}

/**
 * Builds and validates a synthetic vehicle.upsert event envelope.
 */
function makeVehiclePayload(i: number, at: string, coordinate: Coordinate): EventEnvelope {
  const evt: VehicleUpsertEvent = {
    kind: 'vehicle.upsert',
    at,
    cityId: config.cityId,
    source: config.source,
    payload: {
      id: `mock_${i + 1}`,
      coordinate,
      updatedAt: at,
      status: 'in_service',
    },
  };
  const env: EventEnvelope = { schemaVersion: '1', data: evt };
  // Validate against shared schema to ensure contract correctness
  return EventEnvelopeSchema.parse(env);
}

/**
 * Publishes synthetic vehicle.upsert events to a Valkey Stream at a fixed cadence.
 * Maintains an in-memory set of positions that move along circular paths.
 */
class VehicleSimulator {
  private positions: Coordinate[];
  private tick: number = 0;

  constructor(
    private client: IoRedisClient,
    private config: Config
  ) {
    this.positions = Array.from({ length: config.vehicles }).map((_, i) =>
      computePosition(config.center, config.radius * 0.5, i)
    );
  }

  /** Starts the periodic publish loop. */
  async start() {
    setInterval(() => this.publishAll(), this.config.intervalMs);
  }

  /** Publishes one batch containing an upsert for each simulated vehicle. */
  private async publishAll() {
    const at = nowIso();
    const publishPromises: Promise<unknown>[] = [];
    for (let i = 0; i < this.config.vehicles; i++) {
      const t = Date.now() / 5000 + i;
      this.positions[i] = computePosition(this.config.center, this.config.radius, t);
      const env = makeVehiclePayload(i, at, this.positions[i]);
      publishPromises.push(this.client.xaddJson(this.config.stream, env, this.config.trimMaxLen).catch((e: Error) => {
        console.error('[opentransit-mock] xAdd error', e);
      }));
    }
    await Promise.all(publishPromises);
    this.tick++;
    if (this.tick % 10 === 0) {
      console.log(`[opentransit-mock] published ${this.config.vehicles} events @ tick ${this.tick}`);
    }
  }
}

/** Entrypoint: connects to Valkey and starts the simulator. */
async function main() {
  const raw: Redis = createRedis(config.valkeyUrl);
  raw.on('error', (e: any) => console.error('[opentransit-mock] valkey error', e));
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const client = new IoRedisClient(raw, {
    logger,
    metrics: new RedisMetrics('valkey'),
    defaultRead: { blockMs: 5000, count: 100 },
  });
  await client.connect();
  console.log(`[opentransit-mock] connected to ${config.valkeyUrl}`);

  const simulator = new VehicleSimulator(client, config);
  await simulator.start();
}

main().catch((e) => {
  console.error('[opentransit-mock] fatal', e);
  process.exit(1);
});
