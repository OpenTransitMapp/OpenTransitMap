import { EventEmitter } from 'events';
import type { Topic } from './topics.js';
import { pipelineEventBusLogger } from '../logger.js';

/**
 * Minimal event bus abstraction.
 *
 * Allows publishing/subscribing to logical topics without coupling to a
 * concrete transport. A production adapter can back this with Valkey Streams,
 * while tests/dev use the in‑memory implementation below.
 */
export interface EventBus {
  publish<T>(topic: Topic | string, message: T): Promise<void>;
  subscribe<T>(
    topic: Topic | string,
    group: string,
    consumer: string,
    handler: (message: T) => Promise<void> | void
  ): () => void; // returns unsubscribe
}

/**
 * In‑memory EventBus backed by Node.js EventEmitter.
 *
 * @remarks
 * - No persistence, durability, or consumer offsets
 * - Suitable for development and tests only
 */
export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter();
  private readonly log = pipelineEventBusLogger;

  /**
   * Publishes a message to a topic.
   */
  async publish<T>(topic: Topic | string, message: T): Promise<void> {
    // Emit on next tick to avoid reentrancy surprises
    const name = String(topic);
    setImmediate(() => {
      try {
        this.emitter.emit(name, message);
        this.log.debug({ topic: name }, 'event published');
      } catch (e) {
        this.log.error({ topic: name, err: e }, 'publish failed');
      }
    });
  }

  /**
   * Subscribes to a topic.
   *
   * @param topic - Topic name to subscribe to
   * @param group - Consumer group name (ignored in memory implementation)
   * @param consumer - Consumer identifier (used in logs only)
   * @param handler - Async handler invoked for each message
   * @returns Unsubscribe function
   */
  subscribe<T>(topic: Topic | string, _group: string, consumer: string, handler: (message: T) => Promise<void> | void) {
    const event = String(topic);
    this.log.info({ topic: event, consumer }, 'subscribed');
    const wrapped = async (msg: T) => {
      try {
        await handler(msg);
      } catch (e) {
        // For dev bus, swallow to keep other subscribers alive; log the error
        this.log.warn({ topic: event, consumer, err: e }, 'handler error');
      }
    };
    this.emitter.on(event, wrapped);
    return () => {
      this.emitter.off(event, wrapped);
      this.log.info({ topic: event, consumer }, 'unsubscribed');
    };
  }
}
