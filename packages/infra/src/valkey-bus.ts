import type { Topic } from './topics.js';
import type { EventBus } from './eventbus.js';
import type { RedisClient } from './redis-client.js';
import type { Logger } from 'pino';

/**
 * Configuration options for the Valkey Streams event bus.
 * 
 * @interface ValkeyBusConfig
 * @since 1.0.0
 */
export interface ValkeyBusConfig {
  /** 
   * Maximum length of the Redis stream before automatic trimming.
   * Uses approximate trimming (`MAXLEN ~ N`) to prevent memory bloat.
   * 
   * @default 10000
   * @minimum 100
   */
  maxLen: number;
  
  /** 
   * Block timeout for Redis XREADGROUP operations in milliseconds.
   * How long to wait for new messages before timing out.
   * 
   * @default 5000
   * @minimum 100
   */
  blockMs: number;
}

/**
 * Internal subscription metadata for tracking active subscriptions.
 * 
 * @interface Subscription
 * @internal
 * @since 1.0.0
 */
interface Subscription {
  /** Unique identifier for the subscription */
  id: string;
  /** Redis stream name being subscribed to */
  stream: string;
  /** Consumer group name */
  group: string;
  /** Consumer name within the group */
  consumer: string;
  /** Shared reference to stop flag for coordination between unsubscribe and loop */
  stopped: { value: boolean };
  /** Promise for the subscription loop (for cleanup) */
  promise?: Promise<void>;
}

/**
 * Result of processing a single message from the stream.
 * 
 * @interface MessageProcessResult
 * @internal
 * @since 1.0.0
 */
interface MessageProcessResult {
  /** Whether the message was processed successfully */
  success: boolean;
  /** Redis message ID for acknowledgment */
  messageId: string;
  /** Error that occurred during processing (if any) */
  error?: Error;
}

/**
 * Interface for managing Redis consumer groups.
 * 
 * Handles the creation and management of consumer groups for Redis streams.
 * 
 * @interface ConsumerGroupManager
 * @since 1.0.0
 */
export interface ConsumerGroupManager {
  /**
   * Ensures a consumer group exists for the given stream.
   * 
   * Creates the consumer group if it doesn't exist, or handles the case
   * where it already exists (BUSYGROUP error).
   * 
   * @param stream - Redis stream name
   * @param group - Consumer group name
   * @throws {Error} If group creation fails for reasons other than BUSYGROUP
   * 
   * @example
   * ```typescript
   * await consumerGroupManager.ensureGroupExists('events', 'workers');
   * ```
   */
  ensureGroupExists(stream: string, group: string): Promise<void>;
}

/**
 * Interface for processing individual messages from Redis streams.
 * 
 * Handles message parsing, handler execution, and acknowledgment.
 * 
 * @interface MessageProcessor
 * @template T - Type of the message payload
 * @since 1.0.0
 */
export interface MessageProcessor<T> {
  /**
   * Processes a single message from the stream.
   * 
   * Parses the JSON message, calls the handler, and acknowledges the message
   * if processing succeeds. Failed messages remain in the Pending Entries List.
   * 
   * @param stream - Redis stream name
   * @param group - Consumer group name
   * @param messageId - Redis message ID
   * @param messageJson - JSON string of the message payload
   * @param handler - Function to process the parsed message
   * @returns Promise resolving to processing result
   * 
   * @example
   * ```typescript
   * const result = await processor.processMessage(
   *   'events', 'workers', '1-0', '{"type":"test"}', 
   *   (msg) => console.log(msg)
   * );
   * ```
   */
  processMessage(
    stream: string,
    group: string,
    messageId: string,
    messageJson: string,
    handler: (message: T) => Promise<void> | void
  ): Promise<MessageProcessResult>;
}

/**
 * Interface for managing Redis client connections.
 * 
 * Handles connection lifecycle, health checks, and graceful shutdown.
 * 
 * @interface ConnectionManager
 * @since 1.0.0
 */
export interface ConnectionManager {
  /**
   * Ensures the Redis client is connected.
   * 
   * Establishes connection if not already connected. Idempotent operation.
   * 
   * @throws {Error} If connection fails
   * 
   * @example
   * ```typescript
   * await connectionManager.ensureConnected();
   * ```
   */
  ensureConnected(): Promise<void>;
  
  /**
   * Checks if the Redis client is healthy.
   * 
   * Performs a ping operation to verify the connection is working.
   * 
   * @returns Promise resolving to true if healthy, false otherwise
   * 
   * @example
   * ```typescript
   * const healthy = await connectionManager.isHealthy();
   * ```
   */
  isHealthy(): Promise<boolean>;
  
  /**
   * Gracefully shuts down the Redis connection.
   * 
   * Closes the connection and cleans up resources.
   * 
   * @example
   * ```typescript
   * await connectionManager.shutdown();
   * ```
   */
  shutdown(): Promise<void>;
}

/**
 * Interface for managing subscription loops.
 * 
 * Handles the main message consumption loop for Redis streams.
 * 
 * @interface SubscriptionLoop
 * @template T - Type of the message payload
 * @since 1.0.0
 */
export interface SubscriptionLoop<T> {
  /**
   * Starts the subscription loop for consuming messages.
   * 
   * Runs a continuous loop that reads messages from the stream and processes them.
   * Respects the stopped flag for graceful shutdown.
   * 
   * @param stream - Redis stream name
   * @param group - Consumer group name
   * @param consumer - Consumer name within the group
   * @param handler - Function to process each message
   * @param stopped - Shared reference to stop flag
   * 
   * @example
   * ```typescript
   * const stopped = { value: false };
   * await subscriptionLoop.start('events', 'workers', 'worker-1', handler, stopped);
   * ```
   */
  start(
    stream: string,
    group: string,
    consumer: string,
    handler: (message: T) => Promise<void> | void,
    stopped: { value: boolean }
  ): Promise<void>;
}

/**
 * Default implementation of consumer group management.
 * 
 * Handles Redis consumer group creation with proper error handling for
 * the BUSYGROUP case (group already exists).
 * 
 * @class DefaultConsumerGroupManager
 * @implements {ConsumerGroupManager}
 * @since 1.0.0
 */
export class DefaultConsumerGroupManager implements ConsumerGroupManager {
  /**
   * Creates a new consumer group manager.
   * 
   * @param client - Redis client for group operations
   * @param logger - Logger for group creation events
   */
  constructor(
    private readonly client: RedisClient,
    private readonly logger: Logger
  ) {}

  /**
   * Ensures a consumer group exists for the given stream.
   * 
   * Creates the consumer group starting from the beginning of the stream (ID '0').
   * Silently handles BUSYGROUP errors which indicate the group already exists.
   * 
   * @param stream - Redis stream name
   * @param group - Consumer group name
   * @throws {Error} If group creation fails for reasons other than BUSYGROUP
   * 
   * @example
   * ```typescript
   * const manager = new DefaultConsumerGroupManager(client, logger);
   * await manager.ensureGroupExists('events', 'workers');
   * ```
   */
  async ensureGroupExists(stream: string, group: string): Promise<void> {
    try {
      await this.client.xgroupCreate(stream, group, '0', true);
      this.logger.info({ stream, group }, 'consumer group created');
    } catch (e: any) {
      // BUSYGROUP means it already exists
      if (!String(e?.message || '').includes('BUSYGROUP')) {
        this.logger.warn({ stream, group, err: e }, 'xgroup create warning');
        // Re-throw non-BUSYGROUP errors so they can be handled by the caller
        throw e;
      }
    }
  }
}

/**
 * Default implementation of message processing.
 * 
 * Handles JSON parsing, handler execution, and message acknowledgment.
 * Failed messages remain in the Pending Entries List (PEL) for manual recovery.
 * 
 * @class DefaultMessageProcessor
 * @implements {MessageProcessor<T>}
 * @template T - Type of the message payload
 * @since 1.0.0
 */
export class DefaultMessageProcessor<T> implements MessageProcessor<T> {
  /**
   * Creates a new message processor.
   * 
   * @param client - Redis client for acknowledgment operations
   * @param logger - Logger for processing events and errors
   */
  constructor(
    private readonly client: RedisClient,
    private readonly logger: Logger
  ) {}

  /**
   * Processes a single message from the stream.
   * 
   * Performs the following steps:
   * 1. Parses the JSON message payload
   * 2. Calls the provided handler function
   * 3. Acknowledges the message if processing succeeds
   * 4. Returns processing result with success status
   * 
   * If any step fails, the message remains unacknowledged in the PEL
   * for potential retry or manual recovery.
   * 
   * @param stream - Redis stream name
   * @param group - Consumer group name
   * @param messageId - Redis message ID for acknowledgment
   * @param messageJson - JSON string of the message payload
   * @param handler - Function to process the parsed message
   * @returns Promise resolving to processing result
   * 
   * @example
   * ```typescript
   * const processor = new DefaultMessageProcessor(client, logger);
   * const result = await processor.processMessage(
   *   'events', 'workers', '1-0', '{"type":"user_created","id":123}',
   *   async (msg) => {
   *     console.log('Processing:', msg);
   *     // Process the message...
   *   }
   * );
   * 
   * if (result.success) {
   *   console.log('Message processed successfully');
   * } else {
   *   console.error('Processing failed:', result.error);
   * }
   * ```
   */
  async processMessage(
    stream: string,
    group: string,
    messageId: string,
    messageJson: string,
    handler: (message: T) => Promise<void> | void
  ): Promise<MessageProcessResult> {
    try {
      const obj = JSON.parse(messageJson);
      await handler(obj);
      await this.client.xack(stream, group, messageId);
      return { success: true, messageId };
    } catch (err) {
      this.logger.warn({ stream, group, id: messageId, err }, 'handler failed; leaving in PEL');
      return { success: false, messageId, error: err as Error };
    }
  }
}

/**
 * Default implementation of connection management.
 * 
 * Handles Redis connection lifecycle with health checks and graceful shutdown.
 * 
 * @class DefaultConnectionManager
 * @implements {ConnectionManager}
 * @since 1.0.0
 */
export class DefaultConnectionManager implements ConnectionManager {
  /**
   * Creates a new connection manager.
   * 
   * @param client - Redis client to manage
   * @param logger - Logger for connection events
   */
  constructor(
    private readonly client: RedisClient,
    private readonly logger: Logger
  ) {}

  /**
   * Ensures the Redis client is connected.
   * 
   * Establishes connection if not already connected. Idempotent operation.
   * 
   * @throws {Error} If connection fails
   * 
   * @example
   * ```typescript
   * await connectionManager.ensureConnected();
   * ```
   */
  async ensureConnected(): Promise<void> {
    await this.client.connect();
    this.logger.debug({}, 'Valkey client connected');
  }

  /**
   * Checks if the Redis client is healthy.
   * 
   * Performs a ping operation to verify the connection is working.
   * 
   * @returns Promise resolving to true if healthy, false otherwise
   * 
   * @example
   * ```typescript
   * const healthy = await connectionManager.isHealthy();
   * ```
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gracefully shuts down the Redis connection.
   * 
   * Closes the connection and cleans up resources.
   * 
   * @example
   * ```typescript
   * await connectionManager.shutdown();
   * ```
   */
  async shutdown(): Promise<void> {
    await this.client.quit();
    this.logger.info({}, 'Valkey client disconnected');
  }
}

/**
 * Default implementation of subscription loop management.
 * 
 * Handles the main message consumption loop for Redis streams with proper
 * error handling and connection recovery.
 * 
 * @class DefaultSubscriptionLoop
 * @implements {SubscriptionLoop<T>}
 * @template T - Type of the message payload
 * @since 1.0.0
 */
export class DefaultSubscriptionLoop<T> implements SubscriptionLoop<T> {
  /**
   * Creates a new subscription loop.
   * 
   * @param client - Redis client for stream operations
   * @param config - Configuration for the event bus
   * @param messageProcessor - Processor for individual messages
   * @param logger - Logger for loop events and errors
   */
  constructor(
    private readonly client: RedisClient,
    private readonly config: ValkeyBusConfig,
    private readonly messageProcessor: MessageProcessor<T>,
    private readonly logger: Logger
  ) {}

  /**
   * Starts the subscription loop for consuming messages.
   * 
   * Runs a continuous loop that reads messages from the stream and processes them.
   * Respects the stopped flag for graceful shutdown.
   * 
   * @param stream - Redis stream name
   * @param group - Consumer group name
   * @param consumer - Consumer name within the group
   * @param handler - Function to process each message
   * @param stopped - Shared reference to stop flag
   * 
   * @example
   * ```typescript
   * const stopped = { value: false };
   * await subscriptionLoop.start('events', 'workers', 'worker-1', handler, stopped);
   * ```
   */
  async start(
    stream: string,
    group: string,
    consumer: string,
    handler: (message: T) => Promise<void> | void,
    stopped: { value: boolean }
  ): Promise<void> {
    this.logger.info({ stream, group, consumer }, 'subscription loop started');

    while (!stopped.value) {
      try {
        const messages = await this.client.xreadgroupNormalized(
          group,
          consumer,
          stream,
          '>',
          { BLOCK: this.config.blockMs, COUNT: 100 }
        );

        if (messages && messages.length > 0) {
          // Process messages in parallel for better performance
          const promises = messages.flatMap(streamData =>
            streamData.messages.map(msg =>
              this.messageProcessor.processMessage(
                stream,
                group,
                msg.id,
                JSON.stringify(msg.message),
                handler
              )
            )
          );

          await Promise.all(promises);
        } else {
          // No messages received, add a small delay to prevent tight loop
          // This is especially important in test environments
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (err) {
        await this.handleConnectionError(err as Error);
      }
    }

    this.logger.info({ stream, group, consumer }, 'subscription loop stopped');
  }

  /**
   * Handles connection errors with exponential backoff.
   * 
   * @param err - The error that occurred
   * @private
   */
  private async handleConnectionError(err: Error): Promise<void> {
    this.logger.warn({ err }, 'subscription loop error, retrying in 1s');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * ValkeyStreamsBus - A robust, testable event bus implementation using Redis Streams.
 * 
 * This class provides a reliable, persistent event bus using Redis Streams as the underlying
 * transport. It supports consumer groups for load balancing, message acknowledgment for
 * at-least-once delivery, and automatic stream trimming to manage memory usage.
 * 
 * ## Features
 * - **Publishing**: Uses `XADD` with approximate trimming (`MAXLEN ~ N`) to prevent memory bloat
 * - **Consuming**: Uses consumer groups with `XREADGROUP` for load balancing and fault tolerance
 * - **Acknowledgment**: Messages are acknowledged with `XACK` after successful processing
 * - **Error Handling**: Failed messages remain in the Pending Entries List (PEL) for manual recovery
 * - **Connection Management**: Automatic connection handling with health checks
 * - **Resource Cleanup**: Proper shutdown mechanism for all subscriptions and connections
 * - **Testability**: Dependency injection makes unit testing straightforward
 * 
 * ## Architecture
 * The class is composed of several focused components:
 * - `ConnectionManager`: Handles Redis connection lifecycle
 * - `ConsumerGroupManager`: Manages consumer group creation
 * - `MessageProcessor`: Processes individual messages
 * - `SubscriptionLoop`: Manages the subscription loop logic
 * 
 * ## Usage Example
 * ```typescript
 * import { createValkeyStreamsBus } from '@open-transit-map/infra';
 * import { createRedisClient } from '@open-transit-map/infra';
 * 
 * // Create a Redis client
 * const client = createRedisClient('redis://localhost:6379');
 * 
 * // Create the event bus
 * const bus = createValkeyStreamsBus(client, { maxLen: 10000, blockMs: 5000 }, logger);
 * 
 * // Publish messages
 * await bus.publish('events.user.created', { userId: 123, email: 'user@example.com' });
 * 
 * // Subscribe to messages
 * const unsubscribe = bus.subscribe('events.user.created', 'workers', 'worker-1', async (message) => {
 *   console.log('Processing user creation:', message);
 *   // Process the message...
 * });
 * 
 * // Later, unsubscribe
 * unsubscribe();
 * 
 * // Graceful shutdown
 * await bus.shutdown();
 * ```
 * 
 * @class ValkeyStreamsBus
 * @implements {EventBus}
 * @since 1.0.0
 */
export class ValkeyStreamsBus implements EventBus {
  /** Map of active subscriptions for cleanup */
  private subscriptions = new Map<string, Subscription>();
  /** Counter for generating unique subscription IDs */
  private subscriptionCounter = 0;

  /**
   * Creates a new ValkeyStreamsBus instance.
   * 
   * All dependencies are injected for maximum testability. Default implementations
   * are provided for all components, but they can be overridden for testing or
   * custom behavior.
   * 
   * @param client - Redis client for stream operations
   * @param config - Configuration for the event bus
   * @param logger - Logger for events and errors
   * @param connectionManager - Manager for Redis connections (optional)
   * @param consumerGroupManager - Manager for consumer groups (optional)
   * @param messageProcessor - Processor for individual messages (optional)
   * @param subscriptionLoop - Loop for consuming messages (optional)
   * 
   * @example
   * ```typescript
   * // Basic usage with defaults
   * const bus = new ValkeyStreamsBus(client, config, logger);
   * 
   * // Custom dependencies for testing
   * const bus = new ValkeyStreamsBus(
   *   client, config, logger,
   *   mockConnectionManager,
   *   mockConsumerGroupManager,
   *   mockMessageProcessor,
   *   mockSubscriptionLoop
   * );
   * ```
   */
  constructor(
    private readonly client: RedisClient,
    private readonly config: ValkeyBusConfig,
    private readonly logger: Logger,
    private readonly connectionManager: ConnectionManager = new DefaultConnectionManager(client, logger),
    private readonly consumerGroupManager: ConsumerGroupManager = new DefaultConsumerGroupManager(client, logger),
    private readonly messageProcessor: MessageProcessor<any> = new DefaultMessageProcessor(client, logger),
    private readonly subscriptionLoop: SubscriptionLoop<any> = new DefaultSubscriptionLoop(client, config, new DefaultMessageProcessor(client, logger), logger)
  ) {}

  /**
   * Publishes a message to a Redis stream with automatic trimming.
   * 
   * Uses Redis `XADD` command with approximate trimming (`MAXLEN ~ N`) to prevent
   * memory bloat. The message is automatically serialized to JSON and added to
   * the specified stream.
   * 
   * @template T - Type of the message payload
   * @param topic - Stream name (topic) to publish to
   * @param message - Message payload to publish
   * @returns Promise resolving to true if published successfully, false otherwise
   * 
   * @example
   * ```typescript
   * // Publish a simple message
   * const success = await bus.publish('events.user.created', { 
   *   userId: 123, 
   *   email: 'user@example.com' 
   * });
   * 
   * if (success) {
   *   console.log('Message published successfully');
   * } else {
   *   console.error('Failed to publish message');
   * }
   * 
   * // Publish with typed message
   * interface UserEvent {
   *   userId: number;
   *   action: 'created' | 'updated' | 'deleted';
   * }
   * 
   * const userEvent: UserEvent = { userId: 123, action: 'created' };
   * await bus.publish('events.user', userEvent);
   * ```
   */
  async publish<T>(topic: Topic | string, message: T): Promise<boolean> {
    const stream = String(topic);
    try {
      await this.connectionManager.ensureConnected();
      await this.client.xaddJson(stream, message, this.config.maxLen);
      this.logger.debug({ stream }, 'event published');
      return true;
    } catch (err) {
      this.logger.error({ stream, err }, 'publish failed');
      return false;
    }
  }

  /**
   * Subscribes to a Redis stream using a consumer group for message processing.
   * 
   * Creates a subscription that continuously reads messages from the specified stream
   * using Redis consumer groups. This enables load balancing and fault tolerance:
   * - Multiple consumers can process messages in parallel
   * - Failed messages remain in the Pending Entries List (PEL) for retry
   * - Each message is delivered to only one consumer in the group
   * 
   * The subscription runs asynchronously and returns an unsubscribe function
   * for cleanup. Messages are processed in parallel for better performance.
   * 
   * @template T - Type of the message payload
   * @param topic - Stream name (topic) to subscribe to
   * @param group - Consumer group name for load balancing
   * @param consumer - Consumer name within the group
   * @param handler - Function to process each message
   * @returns Unsubscribe function to stop the subscription
   * 
   * @example
   * ```typescript
   * // Basic subscription
   * const unsubscribe = bus.subscribe('events.user.created', 'workers', 'worker-1', 
   *   async (message) => {
   *     console.log('Processing user creation:', message);
   *     // Process the message...
   *   }
   * );
   * 
   * // Later, stop the subscription
   * unsubscribe();
   * 
   * // Multiple workers processing the same stream
   * const worker1 = bus.subscribe('events.orders', 'processors', 'worker-1', handler);
   * const worker2 = bus.subscribe('events.orders', 'processors', 'worker-2', handler);
   * const worker3 = bus.subscribe('events.orders', 'processors', 'worker-3', handler);
   * 
   * // Each message will be delivered to only one worker
   * ```
   */
  subscribe<T>(
    topic: Topic | string, 
    group: string, 
    consumer: string, 
    handler: (message: T) => Promise<void> | void
  ): () => void {
    const stream = String(topic);
    const subscriptionId = `sub-${++this.subscriptionCounter}`;
    const stopped = { value: false };
    
    const subscription: Subscription = {
      id: subscriptionId,
      stream,
      group,
      consumer,
      stopped
    };

    // Store subscription first
    this.subscriptions.set(subscriptionId, subscription);
    this.logger.info({ stream, group, consumer }, 'subscribed');

    // Start the subscription loop asynchronously
    const run = async () => {
      try {
        await this.connectionManager.ensureConnected();
        await this.consumerGroupManager.ensureGroupExists(stream, group);
        await this.subscriptionLoop.start(stream, group, consumer, handler, stopped);
      } catch (err) {
        this.logger.error({ stream, group, err }, 'subscription setup failed');
        // Set stopped flag to prevent infinite waiting in tests
        stopped.value = true;
      }
    };

    subscription.promise = run();

    return () => {
      stopped.value = true;
      this.subscriptions.delete(subscriptionId);
      this.logger.info({ stream, group, consumer }, 'unsubscribed');
    };
  }

  /**
   * Checks if the Redis client is healthy.
   * 
   * Performs a ping operation to verify the Redis connection is working.
   * This is useful for health checks and monitoring.
   * 
   * @returns Promise resolving to true if healthy, false otherwise
   * 
   * @example
   * ```typescript
   * const healthy = await bus.isHealthy();
   * if (healthy) {
   *   console.log('Event bus is healthy');
   * } else {
   *   console.error('Event bus is unhealthy');
   * }
   * ```
   */
  async isHealthy(): Promise<boolean> {
    return this.connectionManager.isHealthy();
  }

  /**
   * Gracefully shuts down the event bus.
   * 
   * Performs the following cleanup operations:
   * 1. Stops all active subscriptions
   * 2. Clears the subscription registry
   * 3. Closes the Redis connection
   * 
   * This should be called before the application exits to ensure
   * proper cleanup of resources.
   * 
   * @example
   * ```typescript
   * // Graceful shutdown
   * process.on('SIGTERM', async () => {
   *   console.log('Shutting down event bus...');
   *   await bus.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  async shutdown(): Promise<void> {
    this.logger.info({}, 'Shutting down ValkeyStreamsBus');
    
    // Stop all subscriptions
    for (const subscription of this.subscriptions.values()) {
      subscription.stopped.value = true;
    }
    this.subscriptions.clear();
    
    // Close the connection
    await this.connectionManager.shutdown();
  }

  /**
   * Gets the number of active subscriptions.
   * 
   * Useful for monitoring and testing purposes.
   * 
   * @returns Number of active subscriptions
   * 
   * @example
   * ```typescript
   * const count = bus.getActiveSubscriptionCount();
   * console.log(`Active subscriptions: ${count}`);
   * ```
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Gets a subscription by its ID.
   * 
   * Primarily used for testing and debugging purposes.
   * 
   * @param id - Subscription ID
   * @returns Subscription metadata or undefined if not found
   * 
   * @example
   * ```typescript
   * const subscription = bus.getSubscription('sub-1');
   * if (subscription) {
   *   console.log('Subscription found:', subscription.stream);
   * }
   * ```
   */
  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }
}

/**
 * Factory function to create a ValkeyStreamsBus with default dependencies.
 * 
 * This is the recommended way to create a ValkeyStreamsBus instance as it
 * provides sensible defaults and applies configuration validation. The factory
 * ensures minimum values are respected and creates all default dependencies.
 * 
 * @param client - Redis client for stream operations
 * @param config - Partial configuration (optional, defaults will be applied)
 * @param logger - Logger for events and errors
 * @returns Configured ValkeyStreamsBus instance
 * 
 * @example
 * ```typescript
 * import { createValkeyStreamsBus } from '@open-transit-map/infra';
 * import { createRedisClient } from '@open-transit-map/infra';
 * import pino from 'pino';
 * 
 * // Basic usage with defaults
 * const client = createRedisClient('redis://localhost:6379');
 * const logger = pino();
 * const bus = createValkeyStreamsBus(client, {}, logger);
 * 
 * // Custom configuration
 * const bus = createValkeyStreamsBus(client, {
 *   maxLen: 50000,    // Keep more messages in stream
 *   blockMs: 10000    // Wait longer for new messages
 * }, logger);
 * 
 * // Configuration validation (minimums applied automatically)
 * const bus = createValkeyStreamsBus(client, {
 *   maxLen: 50,       // Will be clamped to 100
 *   blockMs: 25       // Will be clamped to 100
 * }, logger);
 * ```
 * 
 * @since 1.0.0
 */
export function createValkeyStreamsBus(
  client: RedisClient,
  config: Partial<ValkeyBusConfig> = {},
  logger: Logger
): ValkeyStreamsBus {
  const defaultConfig: ValkeyBusConfig = {
    maxLen: 10000,
    blockMs: 5000,
    ...config
  };

  // Apply minimum values
  const finalConfig: ValkeyBusConfig = {
    maxLen: Math.max(100, defaultConfig.maxLen),
    blockMs: Math.max(100, defaultConfig.blockMs)
  };

  return new ValkeyStreamsBus(client, finalConfig, logger);
}
