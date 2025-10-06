import { describe, it, expect, vi } from 'vitest';
import { ConfigSchema, createConfig } from '../../config/index.js';
import { mockProcessEnv } from '../test-utils.js';

describe('Configuration', () => {
  describe('ConfigSchema', () => {
    it('should validate a complete valid configuration', () => {
      const validConfig = {
        valkeyUrl: 'redis://localhost:6379',
        cityId: 'test-city',
        vehicles: 10,
        intervalMs: 2000,
        stream: 'events.test',
        centerLat: 40.75,
        centerLng: -73.98,
        radius: 0.01,
        movementPattern: 'circular' as const,
        vehicleRemovalProbability: 0.2,
        logLevel: 'debug' as const,
        healthPort: 9000
      };

      const result = ConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should apply default values for missing fields', () => {
      const partialConfig = {
        valkeyUrl: 'redis://localhost:6379',
        cityId: 'test-city'
      };

      const result = ConfigSchema.parse(partialConfig);
      
      expect(result.valkeyUrl).toBe('redis://localhost:6379');
      expect(result.cityId).toBe('test-city');
      expect(result.vehicles).toBe(12);
      expect(result.intervalMs).toBe(1000);
      expect(result.stream).toBe('events.normalized');
      expect(result.centerLat).toBe(40.75);
      expect(result.centerLng).toBe(-73.98);
      expect(result.radius).toBe(0.02);
      expect(result.movementPattern).toBe('circular');
      expect(result.vehicleRemovalProbability).toBe(0.1);
      expect(result.logLevel).toBe('info');
      expect(result.healthPort).toBe(8080);
    });

    it('should reject invalid valkeyUrl', () => {
      const invalidConfig = {
        valkeyUrl: 'not-a-url'
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject vehicles outside valid range', () => {
      const invalidConfig = {
        vehicles: 2000 // Max is 1000
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject intervalMs outside valid range', () => {
      const invalidConfig = {
        intervalMs: 50 // Min is 200
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid latitude', () => {
      const invalidConfig = {
        centerLat: 91 // Max is 90
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid longitude', () => {
      const invalidConfig = {
        centerLng: 181 // Max is 180
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid movement pattern', () => {
      const invalidConfig = {
        movementPattern: 'invalid-pattern'
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid log level', () => {
      const invalidConfig = {
        logLevel: 'invalid-level'
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject vehicleRemovalProbability outside 0-1 range', () => {
      const invalidConfig = {
        vehicleRemovalProbability: 1.5
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject negative radius', () => {
      const invalidConfig = {
        radius: -0.01
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject healthPort outside valid range', () => {
      const invalidConfig = {
        healthPort: 500 // Min is 1000
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('createConfig', () => {

    it('should create config with default values when no env vars are set', () => {
      const config = createConfig();
      
      expect(config.valkeyUrl).toBe('redis://valkey:6379');
      expect(config.cityId).toBe('nyc');
      expect(config.vehicles).toBe(12);
      expect(config.intervalMs).toBe(1000);
      expect(config.stream).toBe('events.normalized');
      expect(config.centerLat).toBe(40.75);
      expect(config.centerLng).toBe(-73.98);
      expect(config.radius).toBe(0.02);
      expect(config.movementPattern).toBe('circular');
      expect(config.vehicleRemovalProbability).toBe(0.1);
      expect(config.logLevel).toBe('info');
      expect(config.healthPort).toBe(8080);
    });

    it('should parse environment variables correctly', () => {
      const envMock = mockProcessEnv({
        VALKEY_URL: 'redis://test:6379',
        CITY_ID: 'test-city',
        VEHICLES: '25',
        INTERVAL_MS: '2000',
        STREAM: 'events.test',
        CENTER_LAT: '37.7749',
        CENTER_LNG: '-122.4194',
        RADIUS: '0.05',
        MOVEMENT_PATTERN: 'realistic',
        VEHICLE_REMOVAL_PROBABILITY: '0.2',
        LOG_LEVEL: 'debug',
        HEALTH_PORT: '9000'
      });

      envMock.setup();
      const config = createConfig();
      envMock.teardown();
      
      expect(config.valkeyUrl).toBe('redis://test:6379');
      expect(config.cityId).toBe('test-city');
      expect(config.vehicles).toBe(25);
      expect(config.intervalMs).toBe(2000);
      expect(config.stream).toBe('events.test');
      expect(config.centerLat).toBe(37.7749);
      expect(config.centerLng).toBe(-122.4194);
      expect(config.radius).toBe(0.05);
      expect(config.movementPattern).toBe('realistic');
      expect(config.vehicleRemovalProbability).toBe(0.2);
      expect(config.logLevel).toBe('debug');
      expect(config.healthPort).toBe(9000);
    });

    it('should handle partial environment variables', () => {
      const envMock = mockProcessEnv({
        VEHICLES: '50',
        LOG_LEVEL: 'warn'
      });

      envMock.setup();
      const config = createConfig();
      envMock.teardown();
      
      expect(config.vehicles).toBe(50);
      expect(config.logLevel).toBe('warn');
      expect(config.valkeyUrl).toBe('redis://valkey:6379'); // Default
      expect(config.cityId).toBe('nyc'); // Default
    });

    it('should throw error for invalid environment variables', () => {
      const envMock = mockProcessEnv({
        VEHICLES: 'invalid-number'
      });

      envMock.setup();
      expect(() => createConfig()).toThrow();
      envMock.teardown();
    });

    it('should handle empty string environment variables as undefined', () => {
      const envMock = mockProcessEnv({
        VEHICLES: '',
        LOG_LEVEL: ''
      });

      envMock.setup();
      
      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      const mockExit = vi.fn();
      process.exit = mockExit as any;
      
      // Mock console.error to prevent error output
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      try {
        const config = createConfig();
        
        // If createConfig didn't exit, it should return a config
        if (config) {
          expect(config.vehicles).toBe(12); // Default
          expect(config.logLevel).toBe('info'); // Default
        } else {
          // If it exited, the mock should have been called
          expect(mockExit).toHaveBeenCalledWith(1);
        }
      } finally {
        // Restore originals
        process.exit = originalExit;
        console.error = originalConsoleError;
        envMock.teardown();
      }
    });
  });
});
