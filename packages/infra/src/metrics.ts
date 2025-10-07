import client from 'prom-client';

/**
 * Concrete Prometheus metrics for Redis stream operations used by infra.
 *
 * Naming intentionally generic so services can reuse them across processes.
 */
/**
 * Prometheus metrics collector for Redis stream operations.
 *
 * Provides counters and histograms for published/consumed events, errors, and blocking read durations.
 * Metric names are prefixed (default: 'redis_') to allow for multi-process/service usage.
 */
export class RedisMetrics {
  /** Counter for total number of events published to streams */
  private readonly published: client.Counter;
  /** Counter for total number of events consumed from streams */
  private readonly consumed: client.Counter;
  /** Counter for total number of Redis stream operation errors */
  private readonly errors: client.Counter;
  /** Histogram for duration of blocking XREADGROUP calls in seconds */
  private readonly readBlocked: client.Histogram;

  /**
   * Create a new RedisMetrics instance.
   * @param prefix Metric name prefix (default: 'redis_')
   */
  constructor(prefix = 'redis') {
    this.published = new client.Counter({
      name: `${prefix}events_published_total`,
      help: 'Total number of events published to streams',
      labelNames: ['stream'],
    });
    this.consumed = new client.Counter({
      name: `${prefix}_events_consumed_total`,
      help: 'Total number of events consumed from streams',
      labelNames: ['stream', 'group'],
    });
    this.errors = new client.Counter({
      name: `${prefix}_errors_total`,
      help: 'Total number of Redis stream operation errors',
      labelNames: ['op', 'stream', 'group'],
    });
    this.readBlocked = new client.Histogram({
      name: `${prefix}_read_block_seconds`,
      help: 'Duration of blocking XREADGROUP calls in seconds',
      labelNames: ['stream', 'group'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });
  }

  /**
   * Increment the published events counter for a given stream.
   * @param labels Optional labels object. If omitted, uses empty string for stream.
   */
  incPublished(labels?: { stream?: string }) {
    this.published.inc({ stream: labels?.stream ?? '' });
  }

  /**
   * Increment the consumed events counter for a given stream and group.
   * @param labels Optional labels object. 'count' can be provided as a string to increment by more than 1.
   */
  incConsumed(labels?: { stream?: string; group?: string; count?: string }) {
    this.consumed.inc({ stream: labels?.stream ?? '', group: labels?.group ?? '' }, Number(labels?.count ?? '1'));
  }

  /**
   * Increment the errors counter for a given operation, stream, and group.
   * @param labels Optional labels object. If omitted, uses empty strings for all labels.
   */
  incErrors(labels?: { op?: string; stream?: string; group?: string }) {
    this.errors.inc({ op: labels?.op ?? '', stream: labels?.stream ?? '', group: labels?.group ?? '' });
  }

  /**
   * Observe the duration (in seconds) of a blocking XREADGROUP call.
   * @param seconds Duration in seconds.
   * @param labels Optional labels object for stream and group.
   */
  observeReadBlockedSeconds(seconds: number, labels?: { stream?: string; group?: string }) {
    this.readBlocked.observe({ stream: labels?.stream ?? '', group: labels?.group ?? '' }, seconds);
  }
}

