import { Redis } from 'ioredis';
import type { Logger } from 'pino';

import type { RedisMetrics } from './metrics.js';

/** Logger is pino.Logger; optional to allow silent consumers. */

/** Options passed to XREADGROUP (COUNT/BLOCK). */
export interface ReadOpts { COUNT?: number; BLOCK?: number }

/** Normalized shape for stream reads. */
export type NormalizedStream = { name: string; messages: Array<{ id: string; message: Record<string, string> }> };

/**
 * Redis client wrapper interface for stream operations and health checks.
 */
export interface RedisClient {
  /**
   * Establishes a connection to the Redis server.
   * Should be idempotent; does nothing if already connected.
   */
  connect(): Promise<void>;

  /**
   * Gracefully closes the Redis connection.
   * Should be called when shutting down the client.
   */
  quit(): Promise<void>;

  /**
   * Alias for `quit()`. Closes the Redis connection.
   */
  close(): Promise<void>;

  /**
   * Pings the Redis server to check connectivity.
   * @returns The server's response string (usually "PONG").
   */
  ping(): Promise<string>;

  /**
   * Adds a JSON-encoded payload to a Redis stream.
   * @param stream - The name of the stream.
   * @param payload - The data to add (will be stringified).
   * @param maxLenApprox - Optional maximum length (approximate) for the stream.
   * @returns The ID of the added stream entry.
   */
  xaddJson(
    stream: string,
    payload: unknown,
    maxLenApprox?: number
  ): Promise<string>;

  /**
   * Creates a consumer group for a stream.
   * @param stream - The name of the stream.
   * @param group - The name of the consumer group.
   * @param id - The stream ID to start from (default: '$').
   * @param mkstream - If true, creates the stream if it does not exist.
   */
  xgroupCreate(
    stream: string,
    group: string,
    id?: string,
    mkstream?: boolean
  ): Promise<void>;

  /**
   * Reads messages from a stream as part of a consumer group, returning normalized results.
   * @param group - The consumer group name.
   * @param consumer - The consumer name.
   * @param streamKey - The stream key to read from.
   * @param id - The ID to read from (e.g., '>' for new messages).
   * @param opts - Optional read options (COUNT, BLOCK).
   * @returns An array of normalized stream messages, or null if no messages.
   */
  xreadgroupNormalized(
    group: string,
    consumer: string,
    streamKey: string,
    id: string,
    opts?: ReadOpts
  ): Promise<NormalizedStream[] | null>;

  /**
   * Acknowledges one or more messages as processed in a stream consumer group.
   * @param stream - The stream name.
   * @param group - The consumer group name.
   * @param id - The message ID to acknowledge.
   * @returns The result of the XACK command.
   */
  xack(
    stream: string,
    group: string,
    id: string
  ): Promise<any>;
}

// Metrics are provided by the concrete RedisMetrics type in infra/metrics

/**
 * ioredis-backed implementation of RedisClient with optional logging/metrics.
 */
export interface IoRedisClientOptions {
  /** Structured logger (pino)*/
  logger: Logger;
  /** Prometheus-backed metrics for publish/consume/errors/read durations*/
  metrics: RedisMetrics;
  /** Default read options when BLOCK/COUNT not specified at call site.*/
  defaultRead?: { blockMs?: number; count?: number };
}

export class IoRedisClient implements RedisClient {
  private readonly log: Logger;
  private readonly metrics: RedisMetrics;
  private readonly defaultRead?: { blockMs?: number; count?: number };
  private connected = false;

  constructor(private readonly client: Redis, opts: IoRedisClientOptions) {
    this.log = opts.logger;
    this.metrics = opts.metrics;
    this.defaultRead = opts.defaultRead;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.log) this.log.info('redis: connecting');
    // ioredis auto-connects; attach lifecycle listeners
    this.client.on('error', (err: Error) => this.log?.error({ err }, 'redis: error'));
    this.client.on('end', () => this.log?.warn('redis: connection ended'));
    this.connected = true;
  }

  async quit(): Promise<void> {
    if (this.log) this.log.info('redis: quitting');
    await this.client.quit();
    this.connected = false;
  }

  /** Alias for quit to match common client APIs. */
  async close(): Promise<void> {
    return this.quit();
  }

  async ping(): Promise<string> {
    const res = await this.client.ping();
    if (this.log) this.log.debug({ res }, 'redis: ping');
    return res;
  }

  async xaddJson(stream: string, payload: unknown, maxLenApprox?: number) {
    if (this.log) this.log.debug({ stream }, 'redis: xadd');
    try {
      const r = await xaddJsonHelper(this.client, stream, payload, maxLenApprox);
      this.metrics.incPublished?.({ stream });
      return r;
    } catch (err) {
      this.metrics.incErrors?.({ op: 'xadd', stream });
      if (this.log) this.log.error({ stream, err }, 'redis: xadd error');
      throw err;
    }
  }

  async xgroupCreate(stream: string, group: string, id = '0', mkstream = true): Promise<void> {
    if (this.log) this.log.info({ stream, group }, 'redis: xgroup create');
    try {
      await xgroupCreateHelper(this.client, stream, group, id, mkstream);
    } catch (err) {
      this.metrics.incErrors?.({ op: 'xgroupCreate', stream, group });
      if (this.log) this.log.warn({ stream, group, err }, 'redis: xgroup create error');
      throw err;
    }
  }

  async xreadgroupNormalized(group: string, consumer: string, streamKey: string, id: string, opts?: ReadOpts) {
    const t0 = process.hrtime.bigint();
    const eff = {
      BLOCK: opts?.BLOCK ?? this.defaultRead?.blockMs,
      COUNT: opts?.COUNT ?? this.defaultRead?.count,
    } as ReadOpts;
    const res = await xreadgroupNormalizedHelper(this.client, group, consumer, streamKey, id, eff);
    const t1 = process.hrtime.bigint();
    const seconds = Number(t1 - t0) / 1e9;
    this.metrics.observeReadBlockedSeconds?.(seconds, { stream: streamKey, group });
    if (this.log && res && res.length) this.log.debug({ count: res[0].messages.length }, 'redis: xreadgroup');
    if (res && res.length) this.metrics.incConsumed?.({ stream: streamKey, group, count: String(res[0].messages.length) });
    return res;
  }

  async xack(stream: string, group: string, id: string) {
    if (this.log) this.log.debug({ stream }, 'redis: xack');
    try {
      return await xackHelper(this.client, stream, group, id);
    } catch (err) {
      this.metrics.incErrors?.({ op: 'xack', stream, group });
      if (this.log) this.log.warn({ stream, group, err }, 'redis: xack error');
      throw err;
    }
  }
}

/**
 * Helper function to add a JSON-encoded payload to a Redis stream using XADD,
 * with optional approximate trimming of the stream length.
 *
 * @param client - The Redis client instance.
 * @param stream - The name of the Redis stream to which the message will be added.
 * @param payload - The payload to be JSON-stringified and added to the stream.
 * @param maxLenApprox - (Optional) If provided and greater than 0, the stream will be trimmed
 *                       approximately to this maximum length using the '~' modifier.
 * @returns A promise that resolves to the ID of the added stream entry.
 */
async function xaddJsonHelper(
  client: Redis,
  stream: string,
  payload: unknown,
  maxLenApprox?: number
): Promise<string> {
  const args: (string | number)[] = [];
  if (maxLenApprox && maxLenApprox > 0) {
    args.push('MAXLEN', '~', Math.floor(maxLenApprox));
  }
  args.push('*', 'json', JSON.stringify(payload));
  return client.xadd(stream, ...args) as Promise<string>;
}

/**
 * Ensures that a Redis consumer group exists for a given stream.
 * 
 * Attempts to create a consumer group on the specified stream. If the group already exists,
 * the function will silently succeed (no error thrown). Optionally, the stream can be created
 * if it does not exist by setting `mkstream` to true.
 *
 * @param client - The Redis client instance.
 * @param stream - The name of the Redis stream.
 * @param group - The name of the consumer group to create.
 * @param id - The stream ID from which the group should start consuming (default: '0').
 * @param mkstream - Whether to create the stream if it does not exist (default: true).
 * @returns A promise that resolves when the group is created or already exists.
 * @throws If an error occurs other than the group already existing.
 */
async function xgroupCreateHelper(
  client: Redis,
  stream: string,
  group: string,
  id: string = '0',
  mkstream = true
) {
  const args: (string | number)[] = ['CREATE', stream, group, id];
  if (mkstream) args.push('MKSTREAM');
  try {
    // ioredis xgroup is variadic but not narrowly typed; call via spread
    return (client.xgroup as unknown as (...a: (string | number)[]) => Promise<unknown>)(...args);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('BUSYGROUP')) return;
    throw e;
  }
}

/**
 * Helper function to call the Redis XREADGROUP command and normalize its return value.
 *
 * This function reads messages from a Redis stream using a consumer group, and returns
 * the result as an array of normalized stream objects, each containing the stream name
 * and an array of messages. Each message includes its ID and a key-value map of fields.
 *
 * @param client - The Redis client instance.
 * @param group - The name of the consumer group.
 * @param consumer - The name of the consumer within the group.
 * @param streamKey - The Redis stream key to read from.
 * @param id - The stream ID to start reading from (e.g., '>' for new messages).
 * @param opts - Optional read options, such as COUNT (max messages) and BLOCK (block time in ms).
 * @returns An array of normalized stream objects, or null if no messages are available.
 *
 * Example Redis raw response:
 * [
 *   [
 *     'mystream', [
 *       ['1681912345678-0', ['json', '{"foo":"bar"}']],
 *       ['1681912345679-0', ['json', '{"baz":"qux"}']]
 *     ]
 *   ]
 * ]
 *
 * Normalized output:
 * [
 *   {
 *     name: 'mystream',
 *     messages: [
 *       { id: '1681912345678-0', message: { json: '{"foo":"bar"}' } },
 *       { id: '1681912345679-0', message: { json: '{"baz":"qux"}' } }
 *     ]
 *   }
 * ]
 */
async function xreadgroupNormalizedHelper(
  client: Redis,
  group: string,
  consumer: string,
  streamKey: string,
  id: string,
  opts?: { COUNT?: number; BLOCK?: number }
): Promise<NormalizedStream[] | null> {
  // Build the argument list for the XREADGROUP command
  const args: (string | number)[] = ['GROUP', group, consumer];
  if (opts?.BLOCK != null) args.push('BLOCK', Number(opts.BLOCK)); // Optional: block for N ms
  if (opts?.COUNT != null) args.push('COUNT', Number(opts.COUNT)); // Optional: max number of messages
  args.push('STREAMS', streamKey, id); // Specify the stream and the ID to start from

  // Call the XREADGROUP command
  const xreadgroup = client.xreadgroup as unknown as (...a: (string | number)[]) => Promise<any>;
  const res = await xreadgroup(...args);

  // If no messages are available, return null
  if (!res) return null;

  // Normalize the Redis response into a more convenient structure
  return res.map((tuple: any) => {
    const name = tuple[0]; // Stream name
    const entries = tuple[1] as any[]; // Array of messages
    const messages = entries.map((e: any) => {
      const id = e[0]; // Message ID
      const kv = e[1] as any[]; // Array of key-value pairs
      const message: Record<string, string> = {};
      // Convert the flat key-value array into an object
      for (let i = 0; i < kv.length; i += 2) {
        message[kv[i]] = kv[i + 1];
      }
      return { id, message };
    });
    return { name, messages };
  });
}

/**
 * A helper function that wraps the Redis XACK command.
 *
 * Acknowledges one or more messages as having been processed in a Redis stream consumer group.
 *
 * @param client - The Redis client instance.
 * @param stream - The name of the stream.
 * @param group - The name of the consumer group.
 * @param id - The ID of the message to acknowledge.
 * @returns A promise that resolves to the number of messages acknowledged.
 */
async function xackHelper(client: Redis, stream: string, group: string, id: string) {
  return client.xack(stream, group, id);
}

/**
 * Creates a new instance of the raw ioredis client.
 *
 * @param url - The Redis connection URL.
 * @returns A new Redis client instance.
 *
 * @remarks
 * This factory is kept for convenience in consumers that need direct access to the ioredis client.
 */
export function createRedis(url: string): Redis {
  return new Redis(url);
}
