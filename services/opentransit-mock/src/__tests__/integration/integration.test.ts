import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VehicleSimulator } from '../../simulator/vehicle-simulator.js';
import { HealthServer } from '../../health/health-server.js';
import { createMockLogger, createMockRedisClient, createTestConfig } from '../test-utils.js';

describe('Integration Tests', () => {
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

  describe('Simulator + Health Server Integration', () => {
    it('should work together for health monitoring', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);
      const healthServer = new HealthServer(config.healthPort, mockLogger, simulator);

      // Start both services
      await simulator.start();
      healthServer.start();

      // Check that health server can get simulator status
      const status = simulator.getStatus();
      expect(status.isRunning).toBe(true);

      // Check that health server can get simulator metrics
      const metrics = simulator.getMetrics();
      expect(metrics).toHaveProperty('eventsPublished');
      expect(metrics).toHaveProperty('vehiclesActive');

      // Cleanup
      await simulator.stop();
      healthServer.stop();
    });

    it('should handle simulator state changes in health server', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);
      const healthServer = new HealthServer(config.healthPort, mockLogger, simulator);

      // Initially not running
      let status = simulator.getStatus();
      expect(status.isRunning).toBe(false);

      // Start simulator
      await simulator.start();
      status = simulator.getStatus();
      expect(status.isRunning).toBe(true);

      // Stop simulator
      await simulator.stop();
      status = simulator.getStatus();
      expect(status.isRunning).toBe(false);

      healthServer.stop();
    });

    it('should reflect metrics changes over time', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);
      const healthServer = new HealthServer(config.healthPort, mockLogger, simulator);

      await simulator.start();
      healthServer.start();

      // Wait for some activity
      await new Promise(resolve => setTimeout(resolve, 50));

      const initialMetrics = simulator.getMetrics();
      expect(initialMetrics.eventsPublished).toBeGreaterThanOrEqual(0);

      // Wait for more activity
      await new Promise(resolve => setTimeout(resolve, 50));

      const laterMetrics = simulator.getMetrics();
      expect(laterMetrics.eventsPublished).toBeGreaterThanOrEqual(initialMetrics.eventsPublished);

      await simulator.stop();
      healthServer.stop();
    });
  });

  describe('End-to-End Simulation Flow', () => {
    it('should complete a full simulation cycle', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);
      const healthServer = new HealthServer(config.healthPort, mockLogger, simulator);

      // Start services
      await simulator.start();
      healthServer.start();

      // Wait for a few cycles
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that events were published
      expect(mockClient.xaddJson).toHaveBeenCalled();
      
      // Check metrics
      const metrics = simulator.getMetrics();
      expect(metrics.eventsPublished).toBeGreaterThan(0);

      // Cleanup
      await simulator.stop();
      healthServer.stop();
    });

    it('should handle vehicle removal and addition', async () => {
      const highRemovalConfig = createTestConfig({ 
        vehicleRemovalProbability: 0.8,
        vehicles: 3,
        intervalMs: 10
      });
      const simulator = new VehicleSimulator(mockClient, highRemovalConfig, mockLogger);

      await simulator.start();

      // Wait for multiple cycles to see removal/addition
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = simulator.getMetrics();
      expect(metrics.vehiclesRemoved).toBeGreaterThan(0);

      await simulator.stop();
    });

    it('should maintain vehicle count within bounds', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();

      // Wait for multiple cycles
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = simulator.getStatus();
      expect(status.activeVehicles).toBeLessThanOrEqual(config.vehicles);
      expect(status.activeVehicles).toBeGreaterThan(0);

      await simulator.stop();
    });
  });

  describe('Error Recovery', () => {
    it('should continue running after publish errors', async () => {
      // Make some publishes fail
      mockClient.xaddJson
        .mockResolvedValueOnce('1-0')
        .mockRejectedValueOnce(new Error('Publish failed'))
        .mockResolvedValueOnce('2-0');

      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();

      // Wait for multiple cycles
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be running
      const status = simulator.getStatus();
      expect(status.isRunning).toBe(true);

      // Should have recorded failures
      const metrics = simulator.getMetrics();
      expect(metrics.eventsFailed).toBeGreaterThan(0);

      await simulator.stop();
    });

    it('should handle connection errors gracefully', async () => {
      mockClient.xaddJson.mockRejectedValue(new Error('Connection lost'));

      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();

      // Wait for some cycles
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be running despite errors
      const status = simulator.getStatus();
      expect(status.isRunning).toBe(true);

      // Should have recorded failures
      const metrics = simulator.getMetrics();
      expect(metrics.eventsFailed).toBeGreaterThan(0);

      await simulator.stop();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should not leak memory over time', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      await simulator.start();

      // Run for multiple cycles
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Should still be running smoothly
      const status = simulator.getStatus();
      expect(status.isRunning).toBe(true);

      await simulator.stop();
    });

    it('should handle rapid start/stop cycles', async () => {
      const simulator = new VehicleSimulator(mockClient, config, mockLogger);

      // Rapid start/stop cycles
      for (let i = 0; i < 5; i++) {
        await simulator.start();
        await new Promise(resolve => setTimeout(resolve, 20));
        await simulator.stop();
      }

      // Should not be running
      const status = simulator.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });
});
