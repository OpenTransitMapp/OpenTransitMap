import { vi } from 'vitest';
import type { Logger } from 'pino';
import type { IoRedisClient } from '@open-transit-map/infra';
import type { Config } from '../config/index.js';

/**
 * Creates a comprehensive mock logger that implements the full pino.Logger interface.
 */
export function createMockLogger(): Logger {
  const mockFn = vi.fn();

  return {
    debug: mockFn,
    info: mockFn,
    warn: mockFn,
    error: mockFn,
    trace: mockFn,
    fatal: mockFn,
    child: vi.fn(() => createMockLogger()),
    level: 'info',
    silent: vi.fn(),
    bindings: vi.fn(() => ({})),
    flush: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
    levels: {
      labels: {},
      values: {}
    }
  } as any;
}

/**
 * Creates a mock IoRedisClient for testing.
 */
export function createMockRedisClient(): IoRedisClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    xaddJson: vi.fn().mockResolvedValue('1-0'),
    xgroupCreate: vi.fn().mockResolvedValue(undefined),
    xreadgroupNormalized: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1),
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' })
  } as any;
}

/**
 * Creates a default test configuration.
 */
export function createTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    valkeyUrl: 'redis://localhost:6379',
    cityId: 'test-city',
    vehicles: 5,
    intervalMs: 1000,
    stream: 'events.test',
    centerLat: 40.75,
    centerLng: -73.98,
    radius: 0.01,
    movementPattern: 'circular',
    vehicleRemovalProbability: 0.1,
    logLevel: 'info',
    healthPort: 8080,
    ...overrides
  };
}

/**
 * Creates a mock HTTP server for health check testing.
 */
export function createMockHttpServer() {
  const server = {
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  };
  
  return {
    createServer: vi.fn(() => server),
    server
  };
}

/**
 * Mocks process.env for configuration testing.
 */
export function mockProcessEnv(env: Record<string, string>) {
  const originalEnv = process.env;
  
  // This function should be called within a test's beforeEach/afterEach
  return {
    setup: () => {
      process.env = { ...originalEnv, ...env };
    },
    teardown: () => {
      process.env = originalEnv;
    }
  };
}
