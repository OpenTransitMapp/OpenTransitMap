import { z } from 'zod';
import type { Logger } from 'pino';

/**
 * Zod schema for Processor configuration.
 * 
 * @constant
 * @since 1.0.0
 */
export const ProcessorConfigSchema = z.object({
  maxVehiclesPerCity: z.number().int().positive().default(10000),
  maxVehicleAgeMs: z.number().int().positive().default(5 * 60 * 1000), // 5 minutes
  cleanupIntervalMs: z.number().int().positive().default(60 * 1000), // 1 minute
  maxRetries: z.number().int().min(0).default(3),
  retryBaseDelayMs: z.number().int().positive().default(1000),
  retryMaxDelayMs: z.number().int().positive().default(10000),
  circuitBreakerThreshold: z.number().int().positive().default(5),
  circuitBreakerTimeoutMs: z.number().int().positive().default(30000), // 30 seconds
  enableMetrics: z.boolean().default(true),
  enableDetailedLogging: z.boolean().default(false)
});

/**
 * Type for Processor configuration inferred from Zod schema.
 * 
 * @type ProcessorConfig
 * @since 1.0.0
 */
export type ProcessorConfig = z.infer<typeof ProcessorConfigSchema>;

/**
 * Default configuration for the Processor.
 * 
 * @constant
 * @since 1.0.0
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  maxVehiclesPerCity: 10000,
  maxVehicleAgeMs: 5 * 60 * 1000, // 5 minutes
  cleanupIntervalMs: 60 * 1000, // 1 minute
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 10000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 30000, // 30 seconds
  enableMetrics: true,
  enableDetailedLogging: false
};

/**
 * Creates a Processor configuration with environment variable overrides.
 * 
 * Uses Zod for validation and type safety. Environment variables are automatically
 * parsed and validated according to the schema.
 * 
 * @param overrides - Configuration overrides
 * @param logger - Logger for configuration warnings
 * @returns Processor configuration
 * 
 * @example
 * ```typescript
 * const config = createProcessorConfig({
 *   maxVehiclesPerCity: 5000,
 *   enableDetailedLogging: true
 * }, logger);
 * ```
 * 
 * @since 1.0.0
 */
export function createProcessorConfig(
  overrides: Partial<ProcessorConfig> = {},
  logger?: Logger
): ProcessorConfig {
  // Parse environment variables into a raw config object
  const envConfig = {
    maxVehiclesPerCity: process.env.PROCESSOR_MAX_VEHICLES_PER_CITY,
    maxVehicleAgeMs: process.env.PROCESSOR_MAX_VEHICLE_AGE_MS,
    cleanupIntervalMs: process.env.PROCESSOR_CLEANUP_INTERVAL_MS,
    maxRetries: process.env.PROCESSOR_MAX_RETRIES,
    retryBaseDelayMs: process.env.PROCESSOR_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: process.env.PROCESSOR_RETRY_MAX_DELAY_MS,
    circuitBreakerThreshold: process.env.PROCESSOR_CIRCUIT_BREAKER_THRESHOLD,
    circuitBreakerTimeoutMs: process.env.PROCESSOR_CIRCUIT_BREAKER_TIMEOUT_MS,
    enableMetrics: process.env.PROCESSOR_ENABLE_METRICS,
    enableDetailedLogging: process.env.PROCESSOR_ENABLE_DETAILED_LOGGING
  };

  // Create a schema that transforms string values to appropriate types
  const EnvProcessorConfigSchema = ProcessorConfigSchema.extend({
    maxVehiclesPerCity: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().positive().optional()
    ),
    maxVehicleAgeMs: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().positive().optional()
    ),
    cleanupIntervalMs: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().positive().optional()
    ),
    maxRetries: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().min(0).optional()
    ),
    retryBaseDelayMs: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().positive().optional()
    ),
    retryMaxDelayMs: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().positive().optional()
    ),
    circuitBreakerThreshold: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().positive().optional()
    ),
    circuitBreakerTimeoutMs: z.preprocess(
      (val) => val ? parseInt(String(val), 10) : undefined,
      z.number().int().positive().optional()
    ),
    enableMetrics: z.preprocess(
      (val) => val ? val === 'true' : undefined,
      z.boolean().optional()
    ),
    enableDetailedLogging: z.preprocess(
      (val) => val ? val === 'true' : undefined,
      z.boolean().optional()
    )
  });

  try {
    // Parse and validate environment variables
    const parsedEnvConfig = EnvProcessorConfigSchema.parse(envConfig);
    
    // Merge with overrides and defaults
    const finalConfig = ProcessorConfigSchema.parse({
      ...DEFAULT_PROCESSOR_CONFIG,
      ...parsedEnvConfig,
      ...overrides
    });

    logger?.debug({ config: finalConfig }, 'Processor configuration created successfully');
    return finalConfig;

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `Invalid Processor configuration: ${error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger?.error({ errors: error.issues, envConfig, overrides }, errorMessage);
      throw new Error(errorMessage);
    }
    throw error;
  }
}

/**
 * Validates a Processor configuration using Zod.
 * 
 * @param config - Configuration to validate
 * @param logger - Logger for validation warnings
 * @returns Validated configuration
 * @throws {Error} If configuration is invalid
 * 
 * @since 1.0.0
 */
export function validateProcessorConfig(config: unknown, logger?: Logger): ProcessorConfig {
  try {
    const validatedConfig = ProcessorConfigSchema.parse(config);
    logger?.debug({ config: validatedConfig }, 'Processor configuration validated successfully');
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `Invalid Processor configuration: ${error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger?.error({ errors: error.issues, config }, errorMessage);
      throw new Error(errorMessage);
    }
    throw error;
  }
}
