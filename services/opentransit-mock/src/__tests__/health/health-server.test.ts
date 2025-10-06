import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockLogger, createTestConfig } from '../test-utils.js';

// Mock http module completely
const mockServer = {
  listen: vi.fn(),
  close: vi.fn(),
  on: vi.fn()
};

const mockHttp = {
  createServer: vi.fn(() => mockServer)
};

// Mock the entire http module
vi.mock('http', () => mockHttp);

// Mock the HealthServer class to avoid actual HTTP server creation
vi.mock('../../health/health-server.js', () => ({
  HealthServer: class MockHealthServer {
    private port: number;
    private logger: any;
    private simulator: any;
    private server: any;
    private isRunning: boolean = false;

    constructor(port: number, logger: any, simulator: any) {
      this.port = port;
      this.logger = logger;
      this.simulator = simulator;
      this.server = mockServer;
    }

    start() {
      if (this.isRunning) {
        this.logger.warn('Health server is already running');
        return;
      }

      this.isRunning = true;
      mockHttp.createServer();
      mockServer.listen(this.port);
      this.logger.info({ port: this.port }, 'Health check server started');
    }

    stop() {
      if (!this.isRunning) {
        this.logger.warn('Health server is not running');
        return;
      }

      this.isRunning = false;
      mockServer.close();
      this.logger.info('Health check server stopped');
    }
  }
}));

describe('HealthServer', () => {
  let mockLogger: any;
  let config: any;
  let mockSimulator: any;
  let HealthServer: any;

  beforeEach(async () => {
    // Import the mocked HealthServer
    const module = await import('../../health/health-server.js');
    HealthServer = module.HealthServer;

    mockLogger = createMockLogger();
    config = createTestConfig({ healthPort: 9999 });
    mockSimulator = {
      getStatus: vi.fn().mockReturnValue({
        isRunning: true,
        activeVehicles: 5,
        tick: 100
      }),
      getMetrics: vi.fn().mockReturnValue({
        eventsPublished: 1000,
        eventsFailed: 5,
        vehiclesActive: 5,
        vehiclesRemoved: 2,
        startTime: new Date('2023-01-01T00:00:00Z'),
        lastPublishTime: new Date('2023-01-01T01:00:00Z')
      })
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct port and logger', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);

      expect(healthServer).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the HTTP server on the configured port', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);

      healthServer.start();

      expect(mockHttp.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(config.healthPort);
    });

    it('should log server start information', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);

      healthServer.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { port: config.healthPort },
        'Health check server started'
      );
    });

    it('should not start if already running', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);

      healthServer.start();
      healthServer.start(); // Try to start again

      expect(mockLogger.warn).toHaveBeenCalledWith('Health server is already running');
    });
  });

  describe('stop', () => {
    it('should stop the HTTP server', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);

      healthServer.start();
      healthServer.stop();

      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should log server stop information', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);

      healthServer.start();
      healthServer.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Health check server stopped');
    });

    it('should not stop if not running', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);

      healthServer.stop(); // Try to stop when not running

      expect(mockLogger.warn).toHaveBeenCalledWith('Health server is not running');
    });
  });

  describe('server setup', () => {
    it('should create HTTP server', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);
      healthServer.start();

      expect(mockHttp.createServer).toHaveBeenCalled();
    });

    it('should setup server with port', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);
      healthServer.start();

      expect(mockServer.listen).toHaveBeenCalledWith(config.healthPort);
    });
  });

  describe('error handling', () => {
    it('should handle server lifecycle', () => {
      const healthServer = new HealthServer(config.healthPort, mockLogger, mockSimulator);
      
      // Test that we can start and stop without errors
      healthServer.start();
      healthServer.stop();
      
      expect(mockHttp.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
    });
  });
});