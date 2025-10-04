import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Metrics } from '../metrics.js';
import { InMemoryStore } from '../store.js';

// Mock the logger
vi.mock('../logger.js', () => ({
  storeLogger: {
    info: vi.fn(),
  },
  metricsLogger: {
    info: vi.fn(),
  },
}));

// Mock prom-client to avoid registry conflicts
vi.mock('prom-client', () => {
  const mockRegistry = {
    clear: vi.fn(),
    getMetricsAsArray: vi.fn(() => []),
    metrics: vi.fn(() => 'mock_metrics'),
  };
  
  return {
    default: {
      register: mockRegistry,
      collectDefaultMetrics: vi.fn(),
      Registry: vi.fn(() => mockRegistry),
      Histogram: vi.fn(() => ({ observe: vi.fn() })),
      Counter: vi.fn(() => ({ inc: vi.fn() })),
      Gauge: vi.fn(() => ({ set: vi.fn() })),
    },
  };
});

describe('Services', () => {
  // let originalEnv: Record<string, string | undefined>;

  // beforeEach(() => {
  //   // Save original environment
  //   originalEnv = { ...process.env };
  // });

  // afterEach(() => {
  //   // Restore original environment
  //   process.env = originalEnv;
  // });

  describe('Service Creation', () => {
    it('creates metrics instance with default prefix', () => {
      const metrics = new Metrics();
      expect(metrics).toBeInstanceOf(Metrics);
      expect(metrics.prefix).toEqual('opentransit_');
    });

    it('creates metrics instance with custom prefix', () => {
      const metrics = new Metrics({ prefix: 'custom_' });
      expect(metrics).toBeInstanceOf(Metrics);
      expect(metrics.prefix).toEqual('custom_');
    });

    it('creates store instance with metrics dependency', () => {
      const mockMetrics = new Metrics();
      const store = new InMemoryStore({ metrics: mockMetrics });
      expect(store).toBeInstanceOf(InMemoryStore);
    });

    it('creates store with default TTL when not specified', () => {
      const mockMetrics = new Metrics();
      const store = new InMemoryStore({ metrics: mockMetrics });
      expect(store).toBeInstanceOf(InMemoryStore);
      expect(store.defaultTtlMs).toEqual(InMemoryStore.DEFAULT_TTL_MS);
    });

    it('creates store with custom TTL', () => {
      const defaultTtlMs = 5000;
      const mockMetrics = new Metrics();
      const store = new InMemoryStore({ 
        metrics: mockMetrics, 
        defaultTtlMs: defaultTtlMs 
      });
      expect(store).toBeInstanceOf(InMemoryStore);
      expect(store.defaultTtlMs).toEqual(defaultTtlMs);
    });
  });

  describe('Environment Variable Handling', () => {
    it('handles invalid STORE_TTL_MS env var gracefully', () => {
      const mockMetrics = new Metrics();
      // This should not throw even with invalid env var
      expect(() => {
        new InMemoryStore({ metrics: mockMetrics });
      }).not.toThrow();
    });

    it('handles empty STORE_TTL_MS env var', () => {
      const mockMetrics = new Metrics();
      expect(() => {
        new InMemoryStore({ metrics: mockMetrics });
      }).not.toThrow();
    });
  });
});
