import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultEventValidator } from '../components/event-validator.js';
import { createMockLogger } from '../../../__tests__/test-utils.js';
import type { EventEnvelope } from '@open-transit-map/types';

describe('DefaultEventValidator', () => {
  let validator: DefaultEventValidator;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    validator = new DefaultEventValidator(mockLogger);
  });

  describe('validateEnvelope', () => {
    it('should validate a valid vehicle upsert event', () => {
      const envelope: EventEnvelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z'
          }
        }
      };

      const result = validator.validateEnvelope(envelope);

      expect(result.isValid).toBe(true);
      expect(result.event).toEqual(envelope);
      expect(result.errors).toBeUndefined();
    });

    it('should validate a valid vehicle remove event', () => {
      const envelope: EventEnvelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.remove',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1'
          }
        }
      };

      const result = validator.validateEnvelope(envelope);

      expect(result.isValid).toBe(true);
      expect(result.event).toEqual(envelope);
      expect(result.errors).toBeUndefined();
    });

    it('should reject envelope with missing data.kind', () => {
      const invalidEnvelope = {
        schemaVersion: '1',
        data: {
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z'
          }
        }
      };

      const result = validator.validateEnvelope(invalidEnvelope);

      expect(result.isValid).toBe(false);
      expect(result.event).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors!.some(error => error.includes('kind'))).toBe(true);
    });

    it('should reject unsupported event types', () => {
      const envelope = {
        schemaVersion: '1',
        data: {
          kind: 'unsupported.event',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {}
        }
      };

      const result = validator.validateEnvelope(envelope);

      expect(result.isValid).toBe(false);
      expect(result.event).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors!.some(error => error.includes('unsupported.event') || error.includes('Invalid input'))).toBe(true);
    });

    it('should reject invalid vehicle upsert event', () => {
      const invalidEnvelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            // Missing required fields
            id: 'vehicle-1'
            // Missing coordinate and updatedAt
          }
        }
      };

      const result = validator.validateEnvelope(invalidEnvelope);

      expect(result.isValid).toBe(false);
      expect(result.event).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors!.some(error => error.includes('coordinate'))).toBe(true);
      expect(result.errors!.some(error => error.includes('updatedAt'))).toBe(true);
    });

    it('should reject invalid vehicle remove event', () => {
      const invalidEnvelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.remove',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            // Missing required id field
          }
        }
      };

      const result = validator.validateEnvelope(invalidEnvelope);

      expect(result.isValid).toBe(false);
      expect(result.event).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors!.some(error => error.includes('id'))).toBe(true);
    });

    it('should reject invalid envelope structure', () => {
      const invalidEnvelope = {
        // Missing schemaVersion
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z'
          }
        }
      };

      const result = validator.validateEnvelope(invalidEnvelope);

      expect(result.isValid).toBe(false);
      expect(result.event).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle non-object input', () => {
      const result = validator.validateEnvelope('not an object');

      expect(result.isValid).toBe(false);
      expect(result.event).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle null input', () => {
      const result = validator.validateEnvelope(null);

      expect(result.isValid).toBe(false);
      expect(result.event).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should log debug information for successful validation', () => {
      const envelope: EventEnvelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z'
          }
        }
      };

      validator.validateEnvelope(envelope);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'vehicle.upsert',
          cityId: 'test-city',
          vehicleId: 'vehicle-1'
        }),
        'Event validation successful'
      );
    });

    it('should log warning for validation failures', () => {
      const invalidEnvelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1'
            // Missing required fields
          }
        }
      };

      validator.validateEnvelope(invalidEnvelope);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          envelope: expect.any(Object),
          error: expect.anything()
        }),
        expect.stringContaining('Envelope validation failed')
      );
    });

    it('should log error for envelope validation failures', () => {
      const invalidEnvelope = 'not an object';

      validator.validateEnvelope(invalidEnvelope);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          envelope: invalidEnvelope
        }),
        expect.stringContaining('Envelope validation failed')
      );
    });

    it('should handle vehicle upsert with optional fields', () => {
      const envelope: EventEnvelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z',
            tripId: 'trip-123',
            routeId: 'route-456',
            bearing: 90,
            speedMps: 15.5,
            status: 'in_service'
          }
        }
      };

      const result = validator.validateEnvelope(envelope);

      expect(result.isValid).toBe(true);
      expect(result.event).toEqual(envelope);
    });

    it('should handle vehicle upsert with invalid optional fields', () => {
      const envelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z',
            status: 'invalid_status' // Invalid status value
          }
        }
      };

      const result = validator.validateEnvelope(envelope);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(error => error.includes('status'))).toBe(true);
    });

    it('should handle coordinate validation', () => {
      const envelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: '2023-01-01T00:00:00Z',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 200, lng: -74.0060 }, // Invalid latitude
            updatedAt: '2023-01-01T00:00:00Z'
          }
        }
      };

      const result = validator.validateEnvelope(envelope);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(error => error.includes('coordinate') || error.includes('lat'))).toBe(true);
    });

    it('should handle invalid timestamp format', () => {
      const envelope = {
        schemaVersion: '1',
        data: {
          kind: 'vehicle.upsert',
          at: 'invalid-timestamp',
          cityId: 'test-city',
          source: 'test-source',
          payload: {
            id: 'vehicle-1',
            coordinate: { lat: 40.7128, lng: -74.0060 },
            updatedAt: '2023-01-01T00:00:00Z'
          }
        }
      };

      const result = validator.validateEnvelope(envelope);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(error => error.includes('at') || error.includes('timestamp'))).toBe(true);
    });
  });
});