import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Metrics } from '../metrics.js';
import client from 'prom-client';

// Mock the logger
vi.mock('../logger.js', () => ({
  metricsLogger: {
    info: vi.fn(),
  },
}));

describe('Metrics', () => {
  let metrics: Metrics;

  beforeEach(() => {
    // Clear all registered metrics before each test
    client.register.clear();
    metrics = new Metrics();
  });

  afterEach(() => {
    // Clean up after each test
    client.register.clear();
  });

  describe('Constructor', () => {
    it('initializes with default prefix', () => {
      expect(metrics).toBeInstanceOf(Metrics);
    });

    it('initializes with custom prefix', () => {
      client.register.clear();
      const customMetrics = new Metrics({ prefix: 'custom_' });
      expect(customMetrics).toBeInstanceOf(Metrics);
    });

    it('enables default Node.js metrics', () => {
      // The constructor should enable default metrics
      // We can verify this by checking if any metrics are registered
      const registeredMetrics = client.register.getMetricsAsArray();
      expect(registeredMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('HTTP Metrics', () => {
    it('records HTTP request duration and total', () => {
      const method = 'GET';
      const route = '/api/v1/trains';
      const statusCode = 200;
      const duration = 0.123;

      // This should not throw
      expect(() => {
        metrics.observeHttpRequest(method, route, statusCode, duration);
      }).not.toThrow();
    });

    it('records HTTP request errors', () => {
      const method = 'POST';
      const route = '/api/v1/trains/scopes';
      const errorType = 'validation_error';

      // This should not throw
      expect(() => {
        metrics.recordHttpError(method, route, errorType);
      }).not.toThrow();
    });

    it('handles different HTTP methods and status codes', () => {
      const testCases = [
        { method: 'GET', statusCode: 200 },
        { method: 'POST', statusCode: 201 },
        { method: 'PUT', statusCode: 200 },
        { method: 'DELETE', statusCode: 204 },
        { method: 'GET', statusCode: 404 },
        { method: 'POST', statusCode: 400 },
        { method: 'GET', statusCode: 500 },
      ];

      testCases.forEach(({ method, statusCode }) => {
        expect(() => {
          metrics.observeHttpRequest(method, '/test', statusCode, 0.1);
        }).not.toThrow();
      });
    });
  });

  describe('Business Metrics', () => {
    it('records scope creation', () => {
      const cityId = 'nyc';
      
      expect(() => {
        metrics.recordScopeCreation(cityId);
      }).not.toThrow();
    });

    it('records frame update duration', () => {
      const cityId = 'nyc';
      const duration = 0.456;
      
      expect(() => {
        metrics.observeFrameUpdate(cityId, duration);
      }).not.toThrow();
    });

    it('sets active scopes count', () => {
      const cityId = 'nyc';
      const count = 5;
      
      expect(() => {
        metrics.setActiveScopes(cityId, count);
      }).not.toThrow();
    });

    it('sets active vehicles count by status', () => {
      const cityId = 'nyc';
      const status = 'in_service';
      const count = 42;
      
      expect(() => {
        metrics.setActiveVehicles(cityId, status, count);
      }).not.toThrow();
    });

    it('handles multiple vehicle statuses', () => {
      const cityId = 'nyc';
      const statuses = ['in_service', 'out_of_service', 'maintenance', 'unknown'];
      
      statuses.forEach((status, index) => {
        expect(() => {
          metrics.setActiveVehicles(cityId, status, index * 10);
        }).not.toThrow();
      });
    });

    it('handles zero counts', () => {
      const cityId = 'nyc';
      
      expect(() => {
        metrics.setActiveScopes(cityId, 0);
        metrics.setActiveVehicles(cityId, 'in_service', 0);
      }).not.toThrow();
    });
  });

  describe('Metrics Export', () => {
    it('exports metrics in Prometheus format', async () => {
      // Record some metrics first
      metrics.observeHttpRequest('GET', '/test', 200, 0.1);
      metrics.recordScopeCreation('nyc');
      metrics.setActiveScopes('nyc', 1);
      metrics.setActiveVehicles('nyc', 'in_service', 5);

      const metricsString = await metrics.getMetrics();
      
      expect(typeof metricsString).toBe('string');
      expect(metricsString.length).toBeGreaterThan(0);
      expect(metricsString).toContain('# HELP');
      expect(metricsString).toContain('# TYPE');
    });

    it('handles empty metrics export', async () => {
      const metricsString = await metrics.getMetrics();
      
      expect(typeof metricsString).toBe('string');
      // Should still return valid Prometheus format even with no custom metrics
      expect(metricsString).toContain('# HELP');
    });
  });

  describe('Edge Cases', () => {
    it('handles very large duration values', () => {
      expect(() => {
        metrics.observeHttpRequest('GET', '/test', 200, 999999);
        metrics.observeFrameUpdate('nyc', 999999);
      }).not.toThrow();
    });

    it('handles very small duration values', () => {
      expect(() => {
        metrics.observeHttpRequest('GET', '/test', 200, 0.000001);
        metrics.observeFrameUpdate('nyc', 0.000001);
      }).not.toThrow();
    });

    it('handles negative duration values gracefully', () => {
      expect(() => {
        metrics.observeHttpRequest('GET', '/test', 200, -0.1);
        metrics.observeFrameUpdate('nyc', -0.1);
      }).not.toThrow();
    });

    it('handles empty strings for labels', () => {
      expect(() => {
        metrics.observeHttpRequest('', '', 200, 0.1);
        metrics.recordHttpError('', '', '');
        metrics.recordScopeCreation('');
        metrics.observeFrameUpdate('', 0.1);
        metrics.setActiveScopes('', 0);
        metrics.setActiveVehicles('', '', 0);
      }).not.toThrow();
    });

    it('handles special characters in labels', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      expect(() => {
        metrics.observeHttpRequest(specialChars, specialChars, 200, 0.1);
        metrics.recordHttpError(specialChars, specialChars, specialChars);
        metrics.recordScopeCreation(specialChars);
        metrics.observeFrameUpdate(specialChars, 0.1);
        metrics.setActiveScopes(specialChars, 1);
        metrics.setActiveVehicles(specialChars, specialChars, 1);
      }).not.toThrow();
    });
  });

  describe('Multiple Instances', () => {
    it('handles multiple metrics instances with different prefixes', () => {
      client.register.clear();
      const metrics1 = new Metrics({ prefix: 'app1_' });
      client.register.clear();
      const metrics2 = new Metrics({ prefix: 'app2_' });
      
      expect(() => {
        metrics1.observeHttpRequest('GET', '/test', 200, 0.1);
        metrics2.observeHttpRequest('GET', '/test', 200, 0.1);
      }).not.toThrow();
    });
  });
});
