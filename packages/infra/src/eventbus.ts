import { EventEmitter } from 'events';
import type { Topic } from './topics.js';
import type { Logger } from 'pino';

/**
 * Minimal event bus abstraction.
 *
 * Allows publishing/subscribing to logical topics without coupling to a
 * concrete transport. A production adapter can back this with Valkey Streams,
 * while tests/dev use the in‑memory implementation below.
 * 
 * @interface EventBus
 * @since 1.0.0
 */
export interface EventBus {
  /**
   * Publishes a message to a topic.
   * 
   * @template T - Type of the message payload
   * @param topic - Topic name to publish to
   * @param message - Message payload to publish
   * @returns Promise resolving to true if published successfully, false otherwise
   */
  publish<T>(topic: Topic | string, message: T): Promise<boolean>;
  
  /**
   * Subscribes to a topic for message processing.
   * 
   * @template T - Type of the message payload
   * @param topic - Topic name to subscribe to
   * @param group - Consumer group name for load balancing
   * @param consumer - Consumer identifier within the group
   * @param handler - Function to process each message
   * @returns Unsubscribe function to stop the subscription
   */
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
 * 
 * @class InMemoryEventBus
 * @implements {EventBus}
 * @since 1.0.0
 */
export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter();

  /**
   * Creates a new in-memory event bus.
   * 
   * @param logger - Logger for events and errors
   */
  constructor(private readonly logger: Logger) {}

  /**
   * Publishes a message to a topic.
   * 
   * @template T - Type of the message payload
   * @param topic - Topic name to publish to
   * @param message - Message payload to publish
   * @returns Promise resolving to true if published successfully, false otherwise
   */
  async publish<T>(topic: Topic | string, message: T): Promise<boolean> {
    // Emit on next tick to avoid reentrancy surprises
    const name = String(topic);
    return new Promise((resolve) => {
      setImmediate(() => {
        try {
          this.emitter.emit(name, message);
          this.logger.debug({ topic: name }, 'event published');
          resolve(true);
        } catch (e) {
          this.logger.error({ topic: name, err: e }, 'publish failed');
          resolve(false);
        }
      });
    });
  }

  /**
   * Subscribes to a topic.
   *
   * @template T - Type of the message payload
   * @param topic - Topic name to subscribe to
   * @param _group - Consumer group name (ignored in memory implementation)
   * @param consumer - Consumer identifier (used in logs only)
   * @param handler - Async handler invoked for each message
   * @returns Unsubscribe function
   */
  subscribe<T>(topic: Topic | string, _group: string, consumer: string, handler: (message: T) => Promise<void> | void) {
    const event = String(topic);
    this.logger.info({ topic: event, consumer }, 'subscribed');
    const wrapped = async (msg: T) => {
      try {
        await handler(msg);
      } catch (e) {
        // For dev bus, swallow to keep other subscribers alive; log the error
        this.logger.warn({ topic: event, consumer, err: e }, 'handler error');
      }
    };
    this.emitter.on(event, wrapped);
    return () => {
      this.emitter.off(event, wrapped);
      this.logger.info({ topic: event, consumer }, 'unsubscribed');
    };
  }
}
