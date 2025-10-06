import type { Logger } from 'pino';
import type { VehicleSimulator } from '../simulator/vehicle-simulator.js';

/**
 * Health check server for monitoring the mock service.
 */
export class HealthServer {
  private server?: any;

  constructor(
    private port: number,
    private logger: Logger,
    private simulator?: VehicleSimulator
  ) {}

  /**
   * Starts the health check server.
   */
  start(): void {
    const http = require('http');
    
    this.server = http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        this.handleHealthCheck(req, res);
      } else if (req.url === '/metrics') {
        this.handleMetrics(req, res);
      } else {
        this.handleNotFound(req, res);
      }
    });

    this.server.listen(this.port, () => {
      this.logger.info({ port: this.port }, 'Health check server started');
    });
  }

  /**
   * Stops the health check server.
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
      this.logger.info('Health check server stopped');
    }
  }

  /**
   * Updates the simulator reference (useful for dependency injection).
   */
  setSimulator(simulator: VehicleSimulator): void {
    this.simulator = simulator;
  }

  /**
   * Handles health check requests.
   */
  private handleHealthCheck(req: any, res: any): void {
    const status = this.simulator?.getStatus() || { 
      isRunning: false, 
      activeVehicles: 0, 
      tick: 0 
    };

    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      simulator: status
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  /**
   * Handles metrics requests.
   */
  private handleMetrics(req: any, res: any): void {
    const metrics = this.simulator?.getMetrics() || {};

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics));
  }

  /**
   * Handles 404 requests.
   */
  private handleNotFound(req: any, res: any): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}
