import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Processor } from '../processor.js';
// Types are used in the mock functions
import { Topics } from '@open-transit-map/infra';
import { createMockLogger, createMockStore, createMockEventBus } from '../../../__tests__/test-utils.js';

// Mock dependencies
const mockStore = createMockStore();
const mockBus = createMockEventBus();
const mockLogger = createMockLogger();

describe('Processor', () => {
  let processor: Processor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new Processor(mockStore, mockBus, mockLogger);
  });

  afterEach(async () => {
    if (processor) {
      await processor.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = processor.getConfig();
      expect(config.maxVehiclesPerCity).toBe(10000);
      expect(config.maxVehicleAgeMs).toBe(5 * 60 * 1000);
      expect(config.enableMetrics).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        maxVehiclesPerCity: 5000,
        enableDetailedLogging: true
      };
      
      const customProcessor = new Processor(mockStore, mockBus, mockLogger, customConfig);
      const config = customProcessor.getConfig();
      
      expect(config.maxVehiclesPerCity).toBe(5000);
      expect(config.enableDetailedLogging).toBe(true);
    });
  });

  describe('Lifecycle', () => {
    it('should start successfully', async () => {
      await processor.start();
      
      expect(mockBus.subscribe).toHaveBeenCalledWith(Topics.EventsNormalized, 'processor', 'processor-1', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('Starting processor');
    });

    it('should stop successfully', async () => {
      await processor.start();
      await processor.stop();
      
      // The unsubscribe function is called internally, not through the bus
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping processor');
    });

    it('should handle start errors gracefully', async () => {
      const error = new Error('Start failed');
      vi.mocked(mockBus.subscribe).mockImplementationOnce(() => {
        throw error;
      });
      
      await expect(processor.start()).rejects.toThrow('Start failed');
      expect(mockLogger.error).toHaveBeenCalledWith({ error }, 'Failed to start processor');
    });
  });

  describe('Event Processing', () => {
    beforeEach(async () => {
      await processor.start();
    });

    it('should process valid vehicle upsert events', async () => {
      const validEvent = {
        data: {
          kind: 'vehicle.upsert',
          at: new Date().toISOString(),
          cityId: 'test-city',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: new Date().toISOString()
          }
        }
      };

      // Mock the event handler
      const envelopeHandler = vi.mocked(mockBus.subscribe).mock.calls
        .find(call => call[0] === Topics.EventsNormalized)?.[3];
      
      if (envelopeHandler) {
        await envelopeHandler(validEvent);
      }

      // Verify metrics were recorded
      const metrics = processor.getMetrics();
      expect(metrics.eventsProcessed).toBeGreaterThan(0);
    });

    it('should process valid vehicle remove events', async () => {
      const validEvent = {
        data: {
          kind: 'vehicle.remove',
          at: new Date().toISOString(),
          cityId: 'test-city',
          payload: {
            id: 'vehicle-1'
          }
        }
      };

      // Mock the event handler
      const envelopeHandler = vi.mocked(mockBus.subscribe).mock.calls
        .find(call => call[0] === Topics.EventsNormalized)?.[3];
      
      if (envelopeHandler) {
        await envelopeHandler(validEvent);
      }

      // Verify metrics were recorded
      const metrics = processor.getMetrics();
      expect(metrics.eventsProcessed).toBeGreaterThan(0);
    });

    it('should handle invalid events gracefully', async () => {
      const invalidEvent = {
        data: {
          kind: 'invalid.event',
          at: 'invalid-date'
        }
      };

      // Mock the event handler
      const envelopeHandler = vi.mocked(mockBus.subscribe).mock.calls
        .find(call => call[0] === Topics.EventsNormalized)?.[3];
      
      if (envelopeHandler) {
        await envelopeHandler(invalidEvent);
      }

      // Should not throw and should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ errors: expect.any(Array) }),
        'Invalid event envelope'
      );
    });
  });

  describe('State Management', () => {
    it('should track vehicle state statistics', () => {
      const stats = processor.getStateStats();
      
      expect(stats).toHaveProperty('totalCities');
      expect(stats).toHaveProperty('totalVehicles');
      expect(stats).toHaveProperty('vehiclesPerCity');
      expect(stats).toHaveProperty('estimatedMemoryBytes');
    });
  });

  describe('Metrics', () => {
    it('should provide metrics summary', () => {
      const metrics = processor.getMetrics();
      
      expect(metrics).toHaveProperty('eventsProcessed');
      expect(metrics).toHaveProperty('eventsProcessedSuccess');
      expect(metrics).toHaveProperty('eventsProcessedError');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('frameComputations');
      expect(metrics).toHaveProperty('errorCounts');
    });
  });

  describe('Circuit Breaker', () => {
    it('should provide circuit breaker state', () => {
      const state = processor.getCircuitBreakerState();
      
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('failureCount');
      expect(['closed', 'open', 'half-open']).toContain(state.state);
    });
  });

  describe('Configuration', () => {
    it('should support environment variable overrides', () => {
      // Set environment variables
      process.env.PROCESSOR_MAX_VEHICLES_PER_CITY = '5000';
      process.env.PROCESSOR_ENABLE_DETAILED_LOGGING = 'true';
      
      const processorWithEnv = new Processor(mockStore, mockBus, mockLogger);
      const config = processorWithEnv.getConfig();
      
      expect(config.maxVehiclesPerCity).toBe(5000);
      expect(config.enableDetailedLogging).toBe(true);
      
      // Clean up
      delete process.env.PROCESSOR_MAX_VEHICLES_PER_CITY;
      delete process.env.PROCESSOR_ENABLE_DETAILED_LOGGING;
    });

    it('should validate configuration and throw on invalid values', () => {
      const invalidConfig = {
        maxVehiclesPerCity: -1, // Invalid: should be positive
        maxVehicleAgeMs: 0 // Invalid: should be positive
      };
      
      expect(() => {
        new Processor(mockStore, mockBus, mockLogger, invalidConfig);
      }).toThrow('Invalid Processor configuration');
    });
  });

  describe('Error Handling', () => {
    it('should handle event processing errors gracefully', async () => {
      await processor.start();
      
      // Mock a processing error
      const errorEvent = {
        data: {
          kind: 'vehicle.upsert',
          at: new Date().toISOString(),
          cityId: 'test-city',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: new Date().toISOString()
          }
        }
      };

      // Mock the event handler to throw
      const envelopeHandler = vi.mocked(mockBus.subscribe).mock.calls
        .find(call => call[0] === Topics.EventsNormalized)?.[3];
      
      if (envelopeHandler) {
        // Mock the internal processing to throw
        vi.spyOn(processor as any, 'computeFramesForCity').mockRejectedValueOnce(new Error('Processing failed'));
        
        await envelopeHandler(errorEvent);
      }

      // Should not throw and should record error metrics
      const metrics = processor.getMetrics();
      expect(metrics.eventsProcessedError).toBeGreaterThan(0);
    });
  });
});
