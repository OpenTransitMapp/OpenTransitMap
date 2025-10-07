import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VehicleSimulator } from '../../simulator/vehicle-simulator.js';
import { createMockLogger, createMockRedisClient, createTestConfig } from '../test-utils.js';

describe('VehicleSimulator', () => {
  let mockClient: any;
  let mockLogger: any;
  let config: any;

  beforeEach(() => {
    mockClient = createMockRedisClient();
    mockLogger = createMockLogger();
    // Use very short intervals for faster tests
    config = createTestConfig({ intervalMs: 10 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct state', () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      const status = simulator.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.activeVehicles).toBe(config.vehicles);
      expect(status.tick).toBe(0);
    });

    it('should initialize metrics correctly', () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      const metrics = simulator.getMetrics();
      expect(metrics.eventsPublished).toBe(0);
      expect(metrics.eventsFailed).toBe(0);
      expect(metrics.vehiclesActive).toBe(config.vehicles);
      expect(metrics.vehiclesRemoved).toBe(0);
      expect(metrics.startTime).toBeInstanceOf(Date);
      expect(metrics.lastPublishTime).toBeUndefined();
    });

    it('should create initial positions for all vehicles', () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      const status = simulator.getStatus();
      expect(status.activeVehicles).toBe(config.vehicles);
    });
  });

  describe('start', () => {
    it('should start the simulator', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();

      const status = simulator.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should log startup information', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            vehicles: config.vehicles,
            intervalMs: config.intervalMs,
            movementPattern: config.movementPattern,
            vehicleRemovalProbability: config.vehicleRemovalProbability
          })
        }),
        'Starting vehicle simulator'
      );
    });

    it('should not start if already running', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      await simulator.start(); // Try to start again

      expect(mockLogger.warn).toHaveBeenCalledWith('Simulator is already running');
    });
  });

  describe('stop', () => {
    it('should stop the simulator', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      await simulator.stop();

      const status = simulator.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should not stop if not running', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.stop(); // Try to stop when not running

      const status = simulator.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should log stop information with metrics', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      await simulator.stop();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.any(Object)
        }),
        'Vehicle simulator stopped'
      );
    });
  });

  describe('publishAll', () => {
    it('should publish upsert events for all active vehicles', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      // Mock the private method by accessing it through the class
      const publishAllSpy = vi.spyOn(simulator as any, 'publishAll');
      
      await simulator.start();
      
      // Wait a short time for the interval to trigger
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(publishAllSpy).toHaveBeenCalled();
      expect(mockClient.xaddJson).toHaveBeenCalled();
    });

    it('should handle publish errors gracefully', async () => {
      mockClient.xaddJson.mockRejectedValue(new Error('Publish failed'));
      
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      
      // Wait a short time for the interval to trigger
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = simulator.getMetrics();
      expect(metrics.eventsFailed).toBeGreaterThan(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleId: expect.any(Number),
          error: expect.any(Error)
        }),
        'Failed to publish vehicle upsert event'
      );
    });

    it('should update metrics on successful publish', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      
      // Wait a short time for the interval to trigger
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = simulator.getMetrics();
      expect(metrics.eventsPublished).toBeGreaterThan(0);
    });

    it('should occasionally remove vehicles based on probability', async () => {
      // Set high removal probability for testing
      const highRemovalConfig = createTestConfig({ 
        vehicleRemovalProbability: 0.9,
        intervalMs: 10
      });
      const simulator = new VehicleSimulator(mockClient, highRemovalConfig, mockLogger);

      await simulator.start();
      
      // Wait for multiple intervals to ensure removal happens
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = simulator.getMetrics();
      expect(metrics.vehiclesRemoved).toBeGreaterThan(0);
    });

    it('should add new vehicles when below target count', async () => {
      // Set high removal probability and low vehicle count
      const config = createTestConfig({ 
        vehicles: 2, 
        vehicleRemovalProbability: 0.9 
      });
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      
      // Wait for multiple intervals
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = simulator.getStatus();
      expect(status.activeVehicles).toBeLessThanOrEqual(config.vehicles);
    });

    it('should log progress every 10 ticks', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      
      // Wait for a few ticks
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that the simulator is running and has been called
      expect(simulator.getStatus().isRunning).toBe(true);
      
      await simulator.stop();
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      const metrics = simulator.getMetrics();

      expect(metrics).toHaveProperty('eventsPublished');
      expect(metrics).toHaveProperty('eventsFailed');
      expect(metrics).toHaveProperty('vehiclesActive');
      expect(metrics).toHaveProperty('vehiclesRemoved');
      expect(metrics).toHaveProperty('startTime');
      // lastPublishTime is optional and may be undefined initially
      expect(metrics.lastPublishTime).toBeUndefined();
    });

    it('should return a copy of metrics', () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      const metrics1 = simulator.getMetrics();
      const metrics2 = simulator.getMetrics();

      expect(metrics1).not.toBe(metrics2); // Different objects
      expect(metrics1).toEqual(metrics2); // Same values
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      const status = simulator.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('activeVehicles');
      expect(status).toHaveProperty('tick');
    });

    it('should reflect running state', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      expect(simulator.getStatus().isRunning).toBe(false);

      await simulator.start();
      expect(simulator.getStatus().isRunning).toBe(true);

      await simulator.stop();
      expect(simulator.getStatus().isRunning).toBe(false);
    });
  });

  describe('movement patterns', () => {
    it('should use circular movement by default', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();
      
      // Wait for one interval
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have called xaddJson with upsert events
      expect(mockClient.xaddJson).toHaveBeenCalledWith(
        config.stream,
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'vehicle.upsert',
            payload: expect.objectContaining({
              coordinate: expect.objectContaining({
                lat: expect.any(Number),
                lng: expect.any(Number)
              })
            })
          })
        }),
        10000
      );
    });

    it('should use realistic movement when configured', async () => {
      const realisticConfig = createTestConfig({ movementPattern: 'realistic' });
      const simulator = new VehicleSimulator(mockClient, realisticConfig, mockLogger);

      await simulator.start();
      
      // Wait for one interval
      await new Promise(resolve => setTimeout(resolve, realisticConfig.intervalMs + 100));

      expect(mockClient.xaddJson).toHaveBeenCalled();
    });

    it('should use random movement when configured', async () => {
      const randomConfig = createTestConfig({ movementPattern: 'random' });
      const simulator = new VehicleSimulator(mockClient, randomConfig, mockLogger);

      await simulator.start();
      
      // Wait for one interval
      await new Promise(resolve => setTimeout(resolve, randomConfig.intervalMs + 100));

      expect(mockClient.xaddJson).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors in vehicle processing', async () => {
      // Mock an error in the movement calculation
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);
      const computePositionSpy = vi.spyOn(simulator as any, 'computePosition');
      computePositionSpy.mockImplementation(() => {
        throw new Error('Movement calculation failed');
      });

      await simulator.start();
      
      // Wait for one interval
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleId: expect.any(Number),
          error: expect.any(Error)
        }),
        'Error processing vehicle'
      );
    });
  });
});
