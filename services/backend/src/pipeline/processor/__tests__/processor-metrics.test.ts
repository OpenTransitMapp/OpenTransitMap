import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultProcessorMetrics } from '../processor-metrics.js';
import { createMockLogger } from '../../../__tests__/test-utils.js';
import type { VehicleStateStats } from '../processor-types.js';

describe('DefaultProcessorMetrics', () => {
  let metrics: DefaultProcessorMetrics;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    metrics = new DefaultProcessorMetrics(mockLogger, true);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const summary = metrics.getSummary();
      expect(summary.eventsProcessed).toBe(0);
      expect(summary.eventsProcessedSuccess).toBe(0);
      expect(summary.eventsProcessedError).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.averageProcessingTime).toBe(0);
      expect(summary.frameComputations).toBe(0);
      expect(summary.averageFrameComputationTime).toBe(0);
      expect(summary.errorCounts).toEqual({});
      expect(summary.lastStateStats).toBeUndefined();
      expect(summary.lastStateStatsTime).toBeUndefined();
    });

    it('should initialize with metrics disabled', () => {
      const disabledMetrics = new DefaultProcessorMetrics(mockLogger, false);
      
      disabledMetrics.recordEventProcessed('test', true, 100);
      disabledMetrics.recordFrameComputation('city1', 5, 10, 200);
      disabledMetrics.recordError('test-error', {});
      
      const summary = disabledMetrics.getSummary();
      expect(summary.eventsProcessed).toBe(0);
      expect(summary.frameComputations).toBe(0);
      expect(summary.errorCounts).toEqual({});
    });
  });

  describe('recordEventProcessed', () => {
    it('should record successful event processing', () => {
      metrics.recordEventProcessed('vehicle.upsert', true, 150);

      const summary = metrics.getSummary();
      expect(summary.eventsProcessed).toBe(1);
      expect(summary.eventsProcessedSuccess).toBe(1);
      expect(summary.eventsProcessedError).toBe(0);
      expect(summary.successRate).toBe(100);
      expect(summary.averageProcessingTime).toBe(150);
    });

    it('should record failed event processing', () => {
      metrics.recordEventProcessed('vehicle.upsert', false, 200);

      const summary = metrics.getSummary();
      expect(summary.eventsProcessed).toBe(1);
      expect(summary.eventsProcessedSuccess).toBe(0);
      expect(summary.eventsProcessedError).toBe(1);
      expect(summary.successRate).toBe(0);
      expect(summary.averageProcessingTime).toBe(200);
    });

    it('should calculate success rate correctly with mixed results', () => {
      metrics.recordEventProcessed('vehicle.upsert', true, 100);
      metrics.recordEventProcessed('vehicle.upsert', false, 150);
      metrics.recordEventProcessed('vehicle.remove', true, 120);

      const summary = metrics.getSummary();
      expect(summary.eventsProcessed).toBe(3);
      expect(summary.eventsProcessedSuccess).toBe(2);
      expect(summary.eventsProcessedError).toBe(1);
      expect(summary.successRate).toBeCloseTo(66.67, 1);
      expect(summary.averageProcessingTime).toBeCloseTo(123.33, 1);
    });

    it('should log debug information for event processing', () => {
      metrics.recordEventProcessed('vehicle.upsert', true, 150);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'vehicle.upsert',
          success: true,
          processingTimeMs: 150,
          totalEvents: 1,
          successRate: 100
        }),
        'Event processed'
      );
    });

    it('should not record when metrics are disabled', () => {
      const disabledMetrics = new DefaultProcessorMetrics(mockLogger, false);
      disabledMetrics.recordEventProcessed('vehicle.upsert', true, 150);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('recordFrameComputation', () => {
    it('should record frame computation', () => {
      metrics.recordFrameComputation('city1', 5, 10, 300);

      const summary = metrics.getSummary();
      expect(summary.frameComputations).toBe(1);
      expect(summary.averageFrameComputationTime).toBe(300);
    });

    it('should calculate average frame computation time', () => {
      metrics.recordFrameComputation('city1', 5, 10, 200);
      metrics.recordFrameComputation('city2', 3, 8, 400);

      const summary = metrics.getSummary();
      expect(summary.frameComputations).toBe(2);
      expect(summary.averageFrameComputationTime).toBe(300);
    });

    it('should log debug information for frame computation', () => {
      metrics.recordFrameComputation('city1', 5, 10, 300);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId: 'city1',
          scopesProcessed: 5,
          vehiclesIncluded: 10,
          processingTimeMs: 300,
          totalFrameComputations: 1,
          averageFrameComputationTime: 300
        }),
        'Frame computation completed'
      );
    });

    it('should not record when metrics are disabled', () => {
      const disabledMetrics = new DefaultProcessorMetrics(mockLogger, false);
      disabledMetrics.recordFrameComputation('city1', 5, 10, 300);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('recordError', () => {
    it('should record error with context', () => {
      const context = { operation: 'test', id: '123' };
      metrics.recordError('validation.error', context);

      const errorCounts = metrics.getErrorCounts();
      expect(errorCounts.get('validation.error')).toBe(1);
      expect(errorCounts.size).toBe(1);
    });

    it('should increment error count for same error type', () => {
      metrics.recordError('validation.error', {});
      metrics.recordError('validation.error', {});
      metrics.recordError('validation.error', {});

      const errorCounts = metrics.getErrorCounts();
      expect(errorCounts.get('validation.error')).toBe(3);
    });

    it('should track multiple error types', () => {
      metrics.recordError('validation.error', {});
      metrics.recordError('network.error', {});
      metrics.recordError('validation.error', {});
      metrics.recordError('timeout.error', {});

      const errorCounts = metrics.getErrorCounts();
      expect(errorCounts.get('validation.error')).toBe(2);
      expect(errorCounts.get('network.error')).toBe(1);
      expect(errorCounts.get('timeout.error')).toBe(1);
      expect(errorCounts.size).toBe(3);
    });

    it('should log warning for error recording', () => {
      const context = { operation: 'test' };
      metrics.recordError('validation.error', context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'validation.error',
          errorCount: 1,
          context
        }),
        'Error recorded'
      );
    });

    it('should not record when metrics are disabled', () => {
      const disabledMetrics = new DefaultProcessorMetrics(mockLogger, false);
      disabledMetrics.recordError('validation.error', {});

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('recordStateStats', () => {
    it('should record state statistics', () => {
      const stats: VehicleStateStats = {
        totalCities: 2,
        totalVehicles: 150,
        vehiclesPerCity: { 'city1': 100, 'city2': 50 },
        estimatedMemoryBytes: 1024000
      };

      metrics.recordStateStats(stats);

      expect(metrics.getLastStateStats()).toEqual(stats);
      expect(metrics.getLastStateStatsTime()).toBeInstanceOf(Date);
    });

    it('should update last state statistics', () => {
      const stats1: VehicleStateStats = {
        totalCities: 1,
        totalVehicles: 50,
        vehiclesPerCity: { 'city1': 50 },
        estimatedMemoryBytes: 512000
      };

      const stats2: VehicleStateStats = {
        totalCities: 2,
        totalVehicles: 100,
        vehiclesPerCity: { 'city1': 50, 'city2': 50 },
        estimatedMemoryBytes: 1024000
      };

      metrics.recordStateStats(stats1);
      const time1 = metrics.getLastStateStatsTime();

      // Wait a bit to ensure different timestamps
      setTimeout(() => {
        metrics.recordStateStats(stats2);
        const time2 = metrics.getLastStateStatsTime();

        expect(metrics.getLastStateStats()).toEqual(stats2);
        expect(time2!.getTime()).toBeGreaterThan(time1!.getTime());
      }, 10);
    });

    it('should log debug information for state statistics', () => {
      const stats: VehicleStateStats = {
        totalCities: 1,
        totalVehicles: 50,
        vehiclesPerCity: { 'city1': 50 },
        estimatedMemoryBytes: 512000
      };

      metrics.recordStateStats(stats);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          ...stats,
          timestamp: expect.any(String)
        }),
        'State statistics recorded'
      );
    });

    it('should not record when metrics are disabled', () => {
      const disabledMetrics = new DefaultProcessorMetrics(mockLogger, false);
      const stats: VehicleStateStats = {
        totalCities: 1,
        totalVehicles: 50,
        vehiclesPerCity: { 'city1': 50 },
        estimatedMemoryBytes: 512000
      };

      disabledMetrics.recordStateStats(stats);

      expect(metrics.getLastStateStats()).toBeUndefined();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('getSuccessRate', () => {
    it('should return 0 when no events processed', () => {
      expect(metrics.getSuccessRate()).toBe(0);
    });

    it('should return 100 when all events successful', () => {
      metrics.recordEventProcessed('test', true, 100);
      metrics.recordEventProcessed('test', true, 200);
      expect(metrics.getSuccessRate()).toBe(100);
    });

    it('should return 0 when all events failed', () => {
      metrics.recordEventProcessed('test', false, 100);
      metrics.recordEventProcessed('test', false, 200);
      expect(metrics.getSuccessRate()).toBe(0);
    });

    it('should return correct percentage for mixed results', () => {
      metrics.recordEventProcessed('test', true, 100);
      metrics.recordEventProcessed('test', false, 200);
      metrics.recordEventProcessed('test', true, 150);
      expect(metrics.getSuccessRate()).toBeCloseTo(66.67, 1);
    });
  });

  describe('getAverageProcessingTime', () => {
    it('should return 0 when no events processed', () => {
      expect(metrics.getAverageProcessingTime()).toBe(0);
    });

    it('should return correct average for single event', () => {
      metrics.recordEventProcessed('test', true, 150);
      expect(metrics.getAverageProcessingTime()).toBe(150);
    });

    it('should return correct average for multiple events', () => {
      metrics.recordEventProcessed('test', true, 100);
      metrics.recordEventProcessed('test', true, 200);
      metrics.recordEventProcessed('test', true, 300);
      expect(metrics.getAverageProcessingTime()).toBe(200);
    });
  });

  describe('getAverageFrameComputationTime', () => {
    it('should return 0 when no frame computations', () => {
      expect(metrics.getAverageFrameComputationTime()).toBe(0);
    });

    it('should return correct average for single computation', () => {
      metrics.recordFrameComputation('city1', 5, 10, 300);
      expect(metrics.getAverageFrameComputationTime()).toBe(300);
    });

    it('should return correct average for multiple computations', () => {
      metrics.recordFrameComputation('city1', 5, 10, 200);
      metrics.recordFrameComputation('city2', 3, 8, 400);
      expect(metrics.getAverageFrameComputationTime()).toBe(300);
    });
  });

  describe('getErrorCounts', () => {
    it('should return empty map when no errors recorded', () => {
      const errorCounts = metrics.getErrorCounts();
      expect(errorCounts.size).toBe(0);
    });

    it('should return copy of error counts', () => {
      metrics.recordError('test.error', {});
      const errorCounts = metrics.getErrorCounts();
      
      expect(errorCounts.get('test.error')).toBe(1);
      
      // Modify the returned map
      errorCounts.set('test.error', 999);
      
      // Original should be unchanged
      const originalCounts = metrics.getErrorCounts();
      expect(originalCounts.get('test.error')).toBe(1);
    });
  });

  describe('getSummary', () => {
    it('should return comprehensive metrics summary', () => {
      // Record some data
      metrics.recordEventProcessed('vehicle.upsert', true, 100);
      metrics.recordEventProcessed('vehicle.remove', false, 150);
      metrics.recordFrameComputation('city1', 5, 10, 300);
      metrics.recordError('validation.error', {});
      
      const stats: VehicleStateStats = {
        totalCities: 1,
        totalVehicles: 50,
        vehiclesPerCity: { 'city1': 50 },
        estimatedMemoryBytes: 512000
      };
      metrics.recordStateStats(stats);

      const summary = metrics.getSummary();

      expect(summary.eventsProcessed).toBe(2);
      expect(summary.eventsProcessedSuccess).toBe(1);
      expect(summary.eventsProcessedError).toBe(1);
      expect(summary.successRate).toBe(50);
      expect(summary.averageProcessingTime).toBe(125);
      expect(summary.frameComputations).toBe(1);
      expect(summary.averageFrameComputationTime).toBe(300);
      expect(summary.errorCounts).toEqual({ 'validation.error': 1 });
      expect(summary.lastStateStats).toEqual(stats);
      expect(summary.lastStateStatsTime).toBeInstanceOf(Date);
    });
  });

  describe('reset', () => {
    it('should reset all metrics to initial state', () => {
      // Record some data
      metrics.recordEventProcessed('test', true, 100);
      metrics.recordFrameComputation('city1', 5, 10, 300);
      metrics.recordError('test.error', {});
      
      const stats: VehicleStateStats = {
        totalCities: 1,
        totalVehicles: 50,
        vehiclesPerCity: { 'city1': 50 },
        estimatedMemoryBytes: 512000
      };
      metrics.recordStateStats(stats);

      // Reset
      metrics.reset();

      const summary = metrics.getSummary();
      expect(summary.eventsProcessed).toBe(0);
      expect(summary.eventsProcessedSuccess).toBe(0);
      expect(summary.eventsProcessedError).toBe(0);
      expect(summary.frameComputations).toBe(0);
      expect(summary.errorCounts).toEqual({});
      expect(summary.lastStateStats).toBeUndefined();
      expect(summary.lastStateStatsTime).toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith('Processor metrics reset');
    });
  });

  describe('edge cases', () => {
    it('should handle zero processing times', () => {
      metrics.recordEventProcessed('test', true, 0);
      expect(metrics.getAverageProcessingTime()).toBe(0);
    });

    it('should handle very large processing times', () => {
      metrics.recordEventProcessed('test', true, Number.MAX_SAFE_INTEGER);
      expect(metrics.getAverageProcessingTime()).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle empty error context', () => {
      metrics.recordError('test.error', {});
      const errorCounts = metrics.getErrorCounts();
      expect(errorCounts.get('test.error')).toBe(1);
    });

    it('should handle complex error context', () => {
      const complexContext = {
        operation: 'test',
        nested: { value: 123 },
        array: [1, 2, 3]
      };
      metrics.recordError('test.error', complexContext);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'test.error',
          errorCount: 1,
          context: complexContext
        }),
        'Error recorded'
      );
    });
  });
});
