import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  ProcessorConfigSchema, 
  DEFAULT_PROCESSOR_CONFIG, 
  createProcessorConfig, 
  validateProcessorConfig 
} from '../processor-config.js';
import { createMockLogger } from '../../../__tests__/test-utils.js';
import type { ProcessorConfig } from '../processor-config.js';

describe('ProcessorConfig', () => {
  let mockLogger: any;
  let originalEnv: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    originalEnv = { ...process.env };
    // Clear environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('PROCESSOR_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ProcessorConfigSchema', () => {
    it('should validate a complete valid configuration', () => {
      const validConfig = {
        maxVehiclesPerCity: 5000,
        maxVehicleAgeMs: 300000,
        cleanupIntervalMs: 30000,
        maxRetries: 5,
        retryBaseDelayMs: 2000,
        retryMaxDelayMs: 15000,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeoutMs: 45000,
        enableMetrics: true,
        enableDetailedLogging: true
      };

      const result = ProcessorConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should apply default values for missing fields', () => {
      const partialConfig = {
        maxVehiclesPerCity: 5000,
        enableDetailedLogging: true
      };

      const result = ProcessorConfigSchema.parse(partialConfig);
      expect(result.maxVehiclesPerCity).toBe(5000);
      expect(result.enableDetailedLogging).toBe(true);
      expect(result.maxVehicleAgeMs).toBe(DEFAULT_PROCESSOR_CONFIG.maxVehicleAgeMs);
      expect(result.cleanupIntervalMs).toBe(DEFAULT_PROCESSOR_CONFIG.cleanupIntervalMs);
      expect(result.maxRetries).toBe(DEFAULT_PROCESSOR_CONFIG.maxRetries);
      expect(result.retryBaseDelayMs).toBe(DEFAULT_PROCESSOR_CONFIG.retryBaseDelayMs);
      expect(result.retryMaxDelayMs).toBe(DEFAULT_PROCESSOR_CONFIG.retryMaxDelayMs);
      expect(result.circuitBreakerThreshold).toBe(DEFAULT_PROCESSOR_CONFIG.circuitBreakerThreshold);
      expect(result.circuitBreakerTimeoutMs).toBe(DEFAULT_PROCESSOR_CONFIG.circuitBreakerTimeoutMs);
      expect(result.enableMetrics).toBe(DEFAULT_PROCESSOR_CONFIG.enableMetrics);
    });

    it('should reject invalid numeric values', () => {
      const invalidConfig = {
        maxVehiclesPerCity: -1, // Should be positive
        maxVehicleAgeMs: 0, // Should be positive
        maxRetries: -1 // Should be >= 0
      };

      expect(() => ProcessorConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject non-integer numeric values', () => {
      const invalidConfig = {
        maxVehiclesPerCity: 5000.5, // Should be integer
        maxVehicleAgeMs: 300000.7 // Should be integer
      };

      expect(() => ProcessorConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid boolean values', () => {
      const invalidConfig = {
        enableMetrics: 'yes', // Should be boolean
        enableDetailedLogging: 1 // Should be boolean
      };

      expect(() => ProcessorConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject unknown fields', () => {
      const invalidConfig = {
        maxVehiclesPerCity: 5000,
        unknownField: 'value'
      };

      expect(() => ProcessorConfigSchema.strict().parse(invalidConfig)).toThrow();
    });
  });

  describe('DEFAULT_PROCESSOR_CONFIG', () => {
    it('should be a valid configuration', () => {
      expect(() => ProcessorConfigSchema.parse(DEFAULT_PROCESSOR_CONFIG)).not.toThrow();
    });

    it('should have expected default values', () => {
      expect(DEFAULT_PROCESSOR_CONFIG.maxVehiclesPerCity).toBe(10000);
      expect(DEFAULT_PROCESSOR_CONFIG.maxVehicleAgeMs).toBe(5 * 60 * 1000);
      expect(DEFAULT_PROCESSOR_CONFIG.cleanupIntervalMs).toBe(60 * 1000);
      expect(DEFAULT_PROCESSOR_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_PROCESSOR_CONFIG.retryBaseDelayMs).toBe(1000);
      expect(DEFAULT_PROCESSOR_CONFIG.retryMaxDelayMs).toBe(10000);
      expect(DEFAULT_PROCESSOR_CONFIG.circuitBreakerThreshold).toBe(5);
      expect(DEFAULT_PROCESSOR_CONFIG.circuitBreakerTimeoutMs).toBe(30000);
      expect(DEFAULT_PROCESSOR_CONFIG.enableMetrics).toBe(true);
      expect(DEFAULT_PROCESSOR_CONFIG.enableDetailedLogging).toBe(false);
    });
  });

  describe('createProcessorConfig', () => {
    it('should return default configuration when no overrides provided', () => {
      const config = createProcessorConfig();
      expect(config).toEqual(DEFAULT_PROCESSOR_CONFIG);
    });

    it('should apply overrides to default configuration', () => {
      const overrides = {
        maxVehiclesPerCity: 5000,
        enableDetailedLogging: true
      };

      const config = createProcessorConfig(overrides);
      expect(config.maxVehiclesPerCity).toBe(5000);
      expect(config.enableDetailedLogging).toBe(true);
      expect(config.maxVehicleAgeMs).toBe(DEFAULT_PROCESSOR_CONFIG.maxVehicleAgeMs);
    });

    it('should parse environment variables correctly', () => {
      process.env.PROCESSOR_MAX_VEHICLES_PER_CITY = '5000';
      process.env.PROCESSOR_MAX_VEHICLE_AGE_MS = '300000';
      process.env.PROCESSOR_ENABLE_METRICS = 'false';
      process.env.PROCESSOR_ENABLE_DETAILED_LOGGING = 'true';

      const config = createProcessorConfig();

      expect(config.maxVehiclesPerCity).toBe(5000);
      expect(config.maxVehicleAgeMs).toBe(300000);
      expect(config.enableMetrics).toBe(false);
      expect(config.enableDetailedLogging).toBe(true);
    });

    it('should prioritize overrides over environment variables', () => {
      process.env.PROCESSOR_MAX_VEHICLES_PER_CITY = '5000';
      const overrides = { maxVehiclesPerCity: 7500 };

      const config = createProcessorConfig(overrides);

      expect(config.maxVehiclesPerCity).toBe(7500);
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.PROCESSOR_ENABLE_METRICS = 'true';
      process.env.PROCESSOR_ENABLE_DETAILED_LOGGING = 'false';

      const config = createProcessorConfig();

      expect(config.enableMetrics).toBe(true);
      expect(config.enableDetailedLogging).toBe(false);
    });

    it('should handle invalid boolean environment variables', () => {
      process.env.PROCESSOR_ENABLE_METRICS = 'invalid';

      expect(() => createProcessorConfig()).toThrow();
    });

    it('should handle invalid numeric environment variables', () => {
      process.env.PROCESSOR_MAX_VEHICLES_PER_CITY = 'not-a-number';

      expect(() => createProcessorConfig()).toThrow();
    });

    it('should log debug information when logger provided', () => {
      const overrides = { maxVehiclesPerCity: 5000 };
      createProcessorConfig(overrides, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            maxVehiclesPerCity: 5000
          })
        }),
        'Processor configuration created successfully'
      );
    });

    it('should log error information for invalid configuration', () => {
      const invalidOverrides = { maxVehiclesPerCity: -1 };

      expect(() => createProcessorConfig(invalidOverrides, mockLogger)).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.any(Array),
          envConfig: expect.any(Object),
          overrides: invalidOverrides
        }),
        expect.stringContaining('Invalid Processor configuration')
      );
    });

    it('should handle empty environment variables', () => {
      process.env.PROCESSOR_MAX_VEHICLES_PER_CITY = '';
      process.env.PROCESSOR_ENABLE_METRICS = '';

      const config = createProcessorConfig();
      expect(config).toEqual(DEFAULT_PROCESSOR_CONFIG);
    });

    it('should handle undefined environment variables', () => {
      process.env.PROCESSOR_MAX_VEHICLES_PER_CITY = undefined as any;
      process.env.PROCESSOR_ENABLE_METRICS = undefined as any;

      const config = createProcessorConfig();
      expect(config).toEqual(DEFAULT_PROCESSOR_CONFIG);
    });
  });

  describe('validateProcessorConfig', () => {
    it('should validate a valid configuration', () => {
      const validConfig = {
        maxVehiclesPerCity: 5000,
        maxVehicleAgeMs: 300000,
        cleanupIntervalMs: 30000,
        maxRetries: 5,
        retryBaseDelayMs: 2000,
        retryMaxDelayMs: 15000,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeoutMs: 45000,
        enableMetrics: true,
        enableDetailedLogging: true
      };

      const result = validateProcessorConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        maxVehiclesPerCity: -1,
        maxVehicleAgeMs: 'invalid'
      };

      expect(() => validateProcessorConfig(invalidConfig)).toThrow();
    });

    it('should log debug information for valid configuration', () => {
      const validConfig = { maxVehiclesPerCity: 5000 };
      validateProcessorConfig(validConfig, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.any(Object)
        }),
        'Processor configuration validated successfully'
      );
    });

    it('should log error information for invalid configuration', () => {
      const invalidConfig = { maxVehiclesPerCity: -1 };

      expect(() => validateProcessorConfig(invalidConfig, mockLogger)).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.any(Array),
          config: invalidConfig
        }),
        expect.stringContaining('Invalid Processor configuration')
      );
    });

    it('should handle unknown input types', () => {
      expect(() => validateProcessorConfig('not an object')).toThrow();
      expect(() => validateProcessorConfig(null)).toThrow();
      expect(() => validateProcessorConfig(undefined)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very large numeric values', () => {
      const largeConfig = {
        maxVehiclesPerCity: Number.MAX_SAFE_INTEGER,
        maxVehicleAgeMs: Number.MAX_SAFE_INTEGER,
        cleanupIntervalMs: Number.MAX_SAFE_INTEGER,
        maxRetries: Number.MAX_SAFE_INTEGER,
        retryBaseDelayMs: Number.MAX_SAFE_INTEGER,
        retryMaxDelayMs: Number.MAX_SAFE_INTEGER,
        circuitBreakerThreshold: Number.MAX_SAFE_INTEGER,
        circuitBreakerTimeoutMs: Number.MAX_SAFE_INTEGER
      };

      expect(() => ProcessorConfigSchema.parse(largeConfig)).not.toThrow();
    });

    it('should handle zero values for maxRetries', () => {
      const config = { maxRetries: 0 };
      expect(() => ProcessorConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle minimum positive values', () => {
      const minConfig = {
        maxVehiclesPerCity: 1,
        maxVehicleAgeMs: 1,
        cleanupIntervalMs: 1,
        retryBaseDelayMs: 1,
        retryMaxDelayMs: 1,
        circuitBreakerThreshold: 1,
        circuitBreakerTimeoutMs: 1
      };

      expect(() => ProcessorConfigSchema.parse(minConfig)).not.toThrow();
    });

    it('should handle mixed valid and invalid values', () => {
      const mixedConfig = {
        maxVehiclesPerCity: 5000, // Valid
        maxVehicleAgeMs: -100, // Invalid
        enableMetrics: true // Valid
      };

      expect(() => ProcessorConfigSchema.parse(mixedConfig)).toThrow();
    });
  });

  describe('type safety', () => {
    it('should infer correct TypeScript types', () => {
      const config: ProcessorConfig = {
        maxVehiclesPerCity: 5000,
        maxVehicleAgeMs: 300000,
        cleanupIntervalMs: 30000,
        maxRetries: 5,
        retryBaseDelayMs: 2000,
        retryMaxDelayMs: 15000,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeoutMs: 45000,
        enableMetrics: true,
        enableDetailedLogging: true
      };

      // TypeScript should compile without errors
      expect(config.maxVehiclesPerCity).toBe(5000);
      expect(config.enableMetrics).toBe(true);
    });
  });
});
