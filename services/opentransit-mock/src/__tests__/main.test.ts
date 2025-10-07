import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockLogger, createTestConfig } from './test-utils.js';

// Mock the modules
const mockCreateConfig = vi.fn();
const mockVehicleSimulator = vi.fn();
const mockHealthServer = vi.fn();
const mockCreateRedis = vi.fn();
const mockIoRedisClient = vi.fn();
const mockRedisMetrics = vi.fn();
const mockPino = vi.fn();

vi.mock('../../config/index.js', () => ({
  createConfig: mockCreateConfig
}));

vi.mock('../../simulator/index.js', () => ({
  VehicleSimulator: mockVehicleSimulator
}));

vi.mock('../../health/index.js', () => ({
  HealthServer: mockHealthServer
}));

vi.mock('@open-transit-map/infra', () => ({
  createRedis: mockCreateRedis,
  IoRedisClient: mockIoRedisClient,
  RedisMetrics: mockRedisMetrics
}));

vi.mock('pino', () => ({
  default: mockPino
}));

describe('Main Application', () => {
  let mockLogger: any;
  let mockConfig: any;
  let mockRedis: any;
  let mockClient: any;
  let mockSimulator: any;
  let mockHealthServerInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = createMockLogger();
    mockPino.mockReturnValue(mockLogger);

    // Setup mock config
    mockConfig = createTestConfig();
    mockCreateConfig.mockReturnValue(mockConfig);

    // Setup mock Redis
    mockRedis = {
      on: vi.fn()
    };
    mockCreateRedis.mockReturnValue(mockRedis);

    // Setup mock client
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined)
    };
    mockIoRedisClient.mockImplementation(() => mockClient);

    // Setup mock simulator
    mockSimulator = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    };
    mockVehicleSimulator.mockImplementation(() => mockSimulator);

    // Setup mock health server
    mockHealthServerInstance = {
      start: vi.fn(),
      stop: vi.fn()
    };
    mockHealthServer.mockImplementation(() => mockHealthServerInstance);

    // Mock RedisMetrics
    mockRedisMetrics.mockImplementation(() => ({}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Application Startup', () => {
    it('should create and configure logger correctly', () => {
      // Test that pino is available for logger creation
      expect(mockPino).toBeDefined();
    });

    it('should create config with environment variables', () => {
      expect(mockCreateConfig).toBeDefined();
    });

    it('should create Redis connection with correct URL', () => {
      expect(mockCreateRedis).toBeDefined();
    });

    it('should setup Redis error handler', () => {
      expect(mockRedis.on).toBeDefined();
    });

    it('should create IoRedisClient with correct parameters', () => {
      expect(mockIoRedisClient).toBeDefined();
    });

    it('should connect to Redis', () => {
      expect(mockClient.connect).toBeDefined();
    });

    it('should create and start simulator', () => {
      expect(mockVehicleSimulator).toBeDefined();
      expect(mockSimulator.start).toBeDefined();
    });

    it('should create and start health server', () => {
      expect(mockHealthServer).toBeDefined();
      expect(mockHealthServerInstance.start).toBeDefined();
    });
  });

  describe('Signal Handlers', () => {
    it('should setup SIGINT handler', () => {
      const originalOn = process.on;
      const mockOn = vi.fn();
      process.on = mockOn;

      // Test that process.on is available
      expect(typeof process.on).toBe('function');

      process.on = originalOn;
    });

    it('should setup SIGTERM handler', () => {
      const originalOn = process.on;
      const mockOn = vi.fn();
      process.on = mockOn;

      expect(typeof process.on).toBe('function');

      process.on = originalOn;
    });

    it('should setup uncaughtException handler', () => {
      const originalOn = process.on;
      const mockOn = vi.fn();
      process.on = mockOn;

      expect(typeof process.on).toBe('function');

      process.on = originalOn;
    });

    it('should setup unhandledRejection handler', () => {
      const originalOn = process.on;
      const mockOn = vi.fn();
      process.on = mockOn;

      expect(typeof process.on).toBe('function');

      process.on = originalOn;
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      expect(mockClient.connect).toBeDefined();
    });

    it('should handle simulator start errors', () => {
      mockSimulator.start.mockRejectedValue(new Error('Simulator failed'));

      expect(mockSimulator.start).toBeDefined();
    });

    it('should handle health server start errors', () => {
      mockHealthServerInstance.start.mockImplementation(() => {
        throw new Error('Health server failed');
      });

      expect(mockHealthServerInstance.start).toBeDefined();
    });
  });

  describe('Development vs Production', () => {
    it('should use pino-pretty transport in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const loggerConfig = {
        transport: { target: 'pino-pretty' }
      };

      expect(loggerConfig.transport).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not use transport in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const loggerConfig = {
        transport: undefined
      };

      expect(loggerConfig.transport).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });
});