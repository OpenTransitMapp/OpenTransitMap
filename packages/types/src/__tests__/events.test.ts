import { describe, it, expect } from 'vitest';
import {
  EventEnvelopeSchema,
  VehicleRemoveEventSchema,
  VehicleDeltaSchema,
  VehicleUpsertEventSchema,
} from '../schemas/events.js';

describe('events schemas', () => {
  it.each([
    ['valid schemaVersion 1', '1', true],
    ['invalid schemaVersion 0', '0', false],
    ['invalid schemaVersion 2', '2', false],
  ])('event envelope: %s', (_desc, ver, ok) => {
    const upsert = {
      kind: 'vehicle.upsert' as const,
      at: '2024-01-01T00:00:00Z',
      cityId: 'nyc',
      payload: { id: 'veh-1', coordinate: { lat: 1, lng: 2 }, updatedAt: '2024-01-01T00:00:00Z' },
      source: 'providerA',
    };
    expect(EventEnvelopeSchema.safeParse({ schemaVersion: ver, data: upsert }).success).toBe(ok);
  });

  it('validates remove event with payload id', () => {
    const remove = {
      kind: 'vehicle.remove' as const,
      at: '2024-01-01T00:00:00Z',
      cityId: 'nyc',
      payload: { id: 'veh-1' },
      source: 'providerA',
    };
    expect(VehicleRemoveEventSchema.safeParse(remove).success).toBe(true);
  });

  it.each([
    [
      'valid upsert event',
      {
        kind: 'vehicle.upsert' as const,
        at: '2024-01-01T00:00:00Z',
        cityId: 'nyc',
        payload: { id: 'veh-1', coordinate: { lat: 1, lng: 2 }, updatedAt: '2024-01-01T00:00:00Z' },
        source: 'providerA',
      },
      true,
    ],
    [
      'invalid upsert event: payload missing required fields',
      {
        kind: 'vehicle.upsert' as const,
        at: '2024-01-01T00:00:00Z',
        cityId: 'nyc',
        payload: { id: 'veh-1' },
        source: 'providerA',
      },
      false,
    ],
    [
      'invalid upsert event: wrong kind',
      {
        kind: 'vehicle.insert', // @ts-ignore
        at: '2024-01-01T00:00:00Z',
        cityId: 'nyc',
        payload: { id: 'veh-1', coordinate: { lat: 1, lng: 2 }, updatedAt: '2024-01-01T00:00:00Z' },
        source: 'providerA',
      } as any,
      false,
    ],
  ])('%s', (_desc, event, ok) => {
    expect(VehicleUpsertEventSchema.safeParse(event).success).toBe(ok);
  });

  it('rejects extra top-level keys on upsert/remove events (strict)', () => {
    const upsertExtra = {
      kind: 'vehicle.upsert' as const,
      at: '2024-01-01T00:00:00Z',
      cityId: 'nyc',
      payload: { id: 'veh-1', coordinate: { lat: 1, lng: 2 }, updatedAt: '2024-01-01T00:00:00Z' },
      source: 'providerA',
      extra: true,
    } as any;
    expect(VehicleUpsertEventSchema.safeParse(upsertExtra).success).toBe(false);

    const removeExtra = {
      kind: 'vehicle.remove' as const,
      at: '2024-01-01T00:00:00Z',
      cityId: 'nyc',
      payload: { id: 'veh-1' },
      source: 'providerA',
      extra: 'x',
    } as any;
    expect(VehicleRemoveEventSchema.safeParse(removeExtra).success).toBe(false);
  });

  it.each([
    [
      'valid delta: one upsert, one remove, all fields valid',
      {
        scopeId: 'scope-1',
        at: '2024-01-01T00:00:00Z',
        cityId: 'nyc',
        upserts: [
          { id: 'veh-1', coordinate: { lat: 1, lng: 2 }, updatedAt: '2024-01-01T00:00:00Z' },
        ],
        removes: ['veh-2'],
      },
      true,
    ],
    [
      'valid delta: empty upserts and removes arrays',
      {
        scopeId: 'scope-1',
        at: '2024-01-01T00:00:00Z',
        cityId: 'nyc',
        upserts: [],
        removes: [],
      },
      true,
    ],
    [
      'invalid delta: upsert with invalid coordinate (lat out of range)',
      {
        scopeId: 'scope-1',
        at: '2024-01-01T00:00:00Z',
        cityId: 'nyc',
        upserts: [
          { id: 'veh-1', coordinate: { lat: 999, lng: 2 }, updatedAt: '2024-01-01T00:00:00Z' },
        ],
        removes: ['veh-2'],
      },
      false,
    ],
    [
      'invalid delta: removes contains non-string id',
      { scopeId: 'scope-1', at: '2024-01-01T00:00:00Z', cityId: 'nyc', upserts: [], removes: [123] } as any,
      false,
    ],
    [
      'invalid delta: extra property not allowed',
      { scopeId: 'scope-1', at: '2024-01-01T00:00:00Z', cityId: 'nyc', extra: true } as any,
      false,
    ],
  ])('%s', (_desc, payload, ok) => {
    expect(VehicleDeltaSchema.safeParse(payload).success).toBe(ok);
  });
});
