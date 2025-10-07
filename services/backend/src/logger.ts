import { randomUUID } from 'crypto';
import pino, { Logger } from 'pino';
import pinoHttp, { Options } from 'pino-http';

/**
 * Creates a base logger instance with common configuration.
 * 
 * This logger is used for general application logging and serves as the base
 * for other specialized loggers in the application.
 * 
 * @param options - Optional configuration overrides
 * @returns Configured Pino logger instance
 * 
 * @example
 * ```typescript
 * const logger = createLogger();
 * logger.info('Application started');
 * ```
 */
export function createLogger(options?: pino.LoggerOptions): Logger {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
    transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    ...options,
  });
}

/**
 * Creates an HTTP request logger middleware for Express.
 * 
 * This logger automatically logs HTTP requests and responses with structured
 * data including request IDs, trace information, and performance metrics.
 * 
 * Features:
 * - Automatic request ID generation
 * - Trace/span ID extraction from headers
 * - Custom log levels based on response status
 * - Request/response redaction for security
 * - Performance timing
 * 
 * @param logger - Base logger instance to use
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * const logger = createLogger();
 * const httpLogger = createHttpLogger(logger);
 * app.use(httpLogger);
 * ```
 */
export function createHttpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req) => req.id || randomUUID(),
    // Avoid customProps to prevent pino-http stringify interop issues across versions
    customLogLevel: (_, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
      if (res.statusCode >= 500 || err) return 'error';
      return 'info';
    },
    customSuccessMessage: (req) => `${req.method} ${req.url} completed`,
    customErrorMessage: (req, _, err) => `${req.method} ${req.url} failed: ${err.message}`,
    redact: ['req.headers.cookie', 'req.headers.authorization'],
  } as Options);
}

/**
 * Creates a specialized error logger with enhanced error context.
 * 
 * This logger is optimized for error logging with additional context fields
 * and structured error information.
 * 
 * @param logger - Base logger instance to use
 * @returns Error logger with enhanced error logging capabilities
 * 
 * @example
 * ```typescript
 * const logger = createLogger();
 * const errorLogger = createErrorLogger(logger);
 * errorLogger.error({ err: error, context: 'user-action' }, 'Operation failed');
 * ```
 */
export function createErrorLogger(logger: Logger) {
  // Do not pin level to 'error' so warnings (4xx) can be emitted too.
  return logger.child({
    component: 'error-handler',
  });
}

/**
 * Creates a specialized metrics logger for performance and monitoring data.
 * 
 * This logger is optimized for metrics and performance logging with
 * structured data suitable for monitoring systems.
 * 
 * @param logger - Base logger instance to use
 * @returns Metrics logger with enhanced monitoring capabilities
 * 
 * @example
 * ```typescript
 * const logger = createLogger();
 * const metricsLogger = createMetricsLogger(logger);
 * metricsLogger.info({ metric: 'response_time', value: 150 }, 'Performance metric');
 * ```
 */
export function createMetricsLogger(logger: Logger) {
  return logger.child({
    component: 'metrics',
    level: 'info',
  });
}

/**
 * Creates a specialized store logger for data operations.
 * 
 * This logger is optimized for store operations with context about
 * data mutations, TTL operations, and storage metrics.
 * 
 * @param logger - Base logger instance to use
 * @returns Store logger with enhanced data operation capabilities
 * 
 * @example
 * ```typescript
 * const logger = createLogger();
 * const storeLogger = createStoreLogger(logger);
 * storeLogger.info({ operation: 'upsert', scopeId: 'nyc' }, 'Scope updated');
 * ```
 */
export function createStoreLogger(logger: Logger) {
  return logger.child({
    component: 'store',
    level: 'info',
  });
}

/**
 * Creates a specialized pipeline logger for ingest/processor/broadcaster.
 */
export function createPipelineLogger(logger: Logger) {
  return logger.child({
    component: 'pipeline',
    level: 'info',
  });
}

// Default logger instances for the application
export const logger = createLogger();
export const httpLogger = createHttpLogger(logger);
export const errorLogger = createErrorLogger(logger);
export const metricsLogger = createMetricsLogger(logger);
export const storeLogger = createStoreLogger(logger);
export const pipelineLogger = createPipelineLogger(logger);

/**
 * Pre-instantiated sub-loggers for pipeline components to centralize
 * logger creation in one module.
 */
export const pipelineEventBusLogger = pipelineLogger.child({ subcomponent: 'eventbus', impl: 'memory' });
export const pipelineValkeyBusLogger = pipelineLogger.child({ subcomponent: 'eventbus', impl: 'valkey' });
