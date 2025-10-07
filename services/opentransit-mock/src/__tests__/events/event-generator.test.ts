import { describe, it, expect } from 'vitest';
import { makeVehicleUpsertPayload, makeVehicleRemovePayload, nowIso } from '../../events/event-generator.js';
import { createTestConfig } from '../test-utils.js';

describe('Event Generator', () => {
  describe('nowIso', () => {
    it('should return a valid ISO string', () => {
      const iso = nowIso();
      
      expect(typeof iso).toBe('string');
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should be a valid date
      const date = new Date(iso);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should return current time', () => {
      const before = Date.now();
      const iso = nowIso();
      const after = Date.now();
      
      const time = new Date(iso).getTime();
      expect(time).toBeGreaterThanOrEqual(before);
      expect(time).toBeLessThanOrEqual(after);
    });
  });

  describe('makeVehicleUpsertPayload', () => {
    const config = createTestConfig();
    const coordinate = { lat: 40.75, lng: -73.98 };
    const at = '2023-01-01T00:00:00.000Z';

    it('should create a valid vehicle upsert event', () => {
      const envelope = makeVehicleUpsertPayload(0, at, coordinate, config);

      expect(envelope).toHaveProperty('schemaVersion', '1');
      expect(envelope).toHaveProperty('data');
      expect(envelope.data).toHaveProperty('kind', 'vehicle.upsert');
      expect(envelope.data).toHaveProperty('at', at);
      expect(envelope.data).toHaveProperty('cityId', config.cityId);
      expect(envelope.data).toHaveProperty('source', 'opentransit-mock');
      expect(envelope.data).toHaveProperty('payload');
    });

    it('should include correct vehicle payload', () => {
      const envelope = makeVehicleUpsertPayload(5, at, coordinate, config);
      const payload = envelope.data.payload;

      expect(payload).toHaveProperty('id', 'mock_6');
      if ('coordinate' in payload) {
        expect(payload.coordinate).toEqual(coordinate);
        expect(payload.updatedAt).toBe(at);
        expect(payload.status).toBe('in_service');
      }
    });

    it('should generate correct vehicle IDs', () => {
      const envelope1 = makeVehicleUpsertPayload(0, at, coordinate, config);
      const envelope2 = makeVehicleUpsertPayload(1, at, coordinate, config);
      const envelope3 = makeVehicleUpsertPayload(9, at, coordinate, config);

      expect(envelope1.data.payload.id).toBe('mock_1');
      expect(envelope2.data.payload.id).toBe('mock_2');
      expect(envelope3.data.payload.id).toBe('mock_10');
    });

    it('should use provided coordinate', () => {
      const customCoordinate = { lat: 37.7749, lng: -122.4194 };
      const envelope = makeVehicleUpsertPayload(0, at, customCoordinate, config);

      if ('coordinate' in envelope.data.payload) {
        expect(envelope.data.payload.coordinate).toEqual(customCoordinate);
      }
    });

    it('should use provided timestamp', () => {
      const customAt = '2023-12-25T12:00:00.000Z';
      const envelope = makeVehicleUpsertPayload(0, customAt, coordinate, config);

      expect(envelope.data.at).toBe(customAt);
      if ('updatedAt' in envelope.data.payload) {
        expect(envelope.data.payload.updatedAt).toBe(customAt);
      }
    });

    it('should use config cityId', () => {
      const customConfig = createTestConfig({ cityId: 'custom-city' });
      const envelope = makeVehicleUpsertPayload(0, at, coordinate, customConfig);

      expect(envelope.data.cityId).toBe('custom-city');
    });

    it('should always use opentransit-mock as source', () => {
      const envelope = makeVehicleUpsertPayload(0, at, coordinate, config);

      expect(envelope.data.source).toBe('opentransit-mock');
    });

    it('should create valid event envelope structure', () => {
      const envelope = makeVehicleUpsertPayload(0, at, coordinate, config);

      // Check that the envelope structure is correct
      expect(envelope.schemaVersion).toBe('1');
      expect(typeof envelope.data).toBe('object');
      expect(envelope.data.kind).toBe('vehicle.upsert');
      expect(typeof envelope.data.at).toBe('string');
      expect(typeof envelope.data.cityId).toBe('string');
      expect(typeof envelope.data.source).toBe('string');
      expect(typeof envelope.data.payload).toBe('object');
    });
  });

  describe('makeVehicleRemovePayload', () => {
    const config = createTestConfig();
    const at = '2023-01-01T00:00:00.000Z';

    it('should create a valid vehicle remove event', () => {
      const envelope = makeVehicleRemovePayload(0, at, config);

      expect(envelope).toHaveProperty('schemaVersion', '1');
      expect(envelope).toHaveProperty('data');
      expect(envelope.data).toHaveProperty('kind', 'vehicle.remove');
      expect(envelope.data).toHaveProperty('at', at);
      expect(envelope.data).toHaveProperty('cityId', config.cityId);
      expect(envelope.data).toHaveProperty('source', 'opentransit-mock');
      expect(envelope.data).toHaveProperty('payload');
    });

    it('should include correct vehicle payload', () => {
      const envelope = makeVehicleRemovePayload(5, at, config);
      const payload = envelope.data.payload;

      expect(payload).toHaveProperty('id', 'mock_6');
      expect(Object.keys(payload)).toHaveLength(1); // Only id field
    });

    it('should generate correct vehicle IDs', () => {
      const envelope1 = makeVehicleRemovePayload(0, at, config);
      const envelope2 = makeVehicleRemovePayload(1, at, config);
      const envelope3 = makeVehicleRemovePayload(9, at, config);

      expect(envelope1.data.payload.id).toBe('mock_1');
      expect(envelope2.data.payload.id).toBe('mock_2');
      expect(envelope3.data.payload.id).toBe('mock_10');
    });

    it('should use provided timestamp', () => {
      const customAt = '2023-12-25T12:00:00.000Z';
      const envelope = makeVehicleRemovePayload(0, customAt, config);

      expect(envelope.data.at).toBe(customAt);
    });

    it('should use config cityId', () => {
      const customConfig = createTestConfig({ cityId: 'custom-city' });
      const envelope = makeVehicleRemovePayload(0, at, customConfig);

      expect(envelope.data.cityId).toBe('custom-city');
    });

    it('should always use opentransit-mock as source', () => {
      const envelope = makeVehicleRemovePayload(0, at, config);

      expect(envelope.data.source).toBe('opentransit-mock');
    });

    it('should create valid event envelope structure', () => {
      const envelope = makeVehicleRemovePayload(0, at, config);

      // Check that the envelope structure is correct
      expect(envelope.schemaVersion).toBe('1');
      expect(typeof envelope.data).toBe('object');
      expect(envelope.data.kind).toBe('vehicle.remove');
      expect(typeof envelope.data.at).toBe('string');
      expect(typeof envelope.data.cityId).toBe('string');
      expect(typeof envelope.data.source).toBe('string');
      expect(typeof envelope.data.payload).toBe('object');
    });
  });

  describe('event validation', () => {
    it('should create events that pass schema validation', () => {
      const config = createTestConfig();
      const coordinate = { lat: 40.75, lng: -73.98 };
      const at = '2023-01-01T00:00:00.000Z';

      // These should not throw (they use EventEnvelopeSchema.parse internally)
      expect(() => {
        makeVehicleUpsertPayload(0, at, coordinate, config);
      }).not.toThrow();

      expect(() => {
        makeVehicleRemovePayload(0, at, config);
      }).not.toThrow();
    });

    it('should handle edge case coordinates', () => {
      const config = createTestConfig();
      const at = '2023-01-01T00:00:00.000Z';

      const edgeCases = [
        { lat: 0, lng: 0 },
        { lat: 90, lng: 180 },
        { lat: -90, lng: -180 },
        { lat: 40.7128, lng: -74.0060 }
      ];

      edgeCases.forEach(coordinate => {
        expect(() => {
          makeVehicleUpsertPayload(0, at, coordinate, config);
        }).not.toThrow();
      });
    });

    it('should handle different vehicle IDs', () => {
      const config = createTestConfig();
      const coordinate = { lat: 40.75, lng: -73.98 };
      const at = '2023-01-01T00:00:00.000Z';

      // Test various vehicle IDs
      const vehicleIds = [0, 1, 99, 999, 1000];
      
      vehicleIds.forEach(vehicleId => {
        expect(() => {
          makeVehicleUpsertPayload(vehicleId, at, coordinate, config);
        }).not.toThrow();
      });
    });
  });
});
