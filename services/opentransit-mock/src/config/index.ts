import { z } from 'zod';

/**
 * Configuration schema for the mock event producer.
 * Simplified to focus on essential settings for a mock service.
 */
export const ConfigSchema = z.object({
  // Core connection settings
  valkeyUrl: z.string().url().default('redis://valkey:6379'),
  cityId: z.string().min(1).default('nyc'),
  
  // Simulation settings
  vehicles: z.number().int().min(1).max(1000).default(12),
  intervalMs: z.number().int().min(200).max(10000).default(1000),
  
  // Stream settings
  stream: z.string().min(1).default('events.normalized'),
  
  // Movement area (simplified from center + radius)
  centerLat: z.number().min(-90).max(90).default(40.75),
  centerLng: z.number().min(-180).max(180).default(-73.98),
  radius: z.number().positive().default(0.02),
  
  // Behavior settings
  movementPattern: z.enum(['circular', 'random', 'realistic']).default('circular'),
  vehicleRemovalProbability: z.number().min(0).max(1).default(0.1),
  
  // System settings
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  healthPort: z.number().int().min(1000).max(65535).default(8080)
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Creates configuration from environment variables with validation.
 * 
 * @returns Validated configuration object
 * @throws Error if configuration is invalid
 */
export function createConfig(): Config {
  const rawConfig = {
    // Core connection settings
    valkeyUrl: process.env.VALKEY_URL,
    cityId: process.env.CITY_ID,
    
    // Simulation settings
    vehicles: process.env.VEHICLES ? Number(process.env.VEHICLES) : undefined,
    intervalMs: process.env.INTERVAL_MS ? Number(process.env.INTERVAL_MS) : undefined,
    
    // Stream settings
    stream: process.env.STREAM,
    
    // Movement area
    centerLat: process.env.CENTER_LAT ? Number(process.env.CENTER_LAT) : undefined,
    centerLng: process.env.CENTER_LNG ? Number(process.env.CENTER_LNG) : undefined,
    radius: process.env.RADIUS ? Number(process.env.RADIUS) : undefined,
    
    // Behavior settings
    movementPattern: process.env.MOVEMENT_PATTERN as 'circular' | 'random' | 'realistic',
    vehicleRemovalProbability: process.env.VEHICLE_REMOVAL_PROBABILITY ? Number(process.env.VEHICLE_REMOVAL_PROBABILITY) : undefined,
    
    // System settings
    logLevel: process.env.LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    healthPort: process.env.HEALTH_PORT ? Number(process.env.HEALTH_PORT) : undefined
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    console.error('Invalid configuration:', error);
    process.exit(1);
  }
}
