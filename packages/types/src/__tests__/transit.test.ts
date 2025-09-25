import { describe, it, expect } from 'vitest';
import {
  RouteTypeSchema,
  VehiclePositionSchema,
  TripDirectionSchema,
  VehicleStatusSchema,
  AgencySchema,
  StopSchema,
  RouteSchema,
  TripSchema,
} from '../schemas/transit.js';

describe('transit schemas', () => {
  it.each([
    [0, true],
    [1702, true],
    [-1, false],
    [1703, false],
    [1.5, false],
  ])('RouteType %s -> %s', (value, ok) => {
    expect(RouteTypeSchema.safeParse(value as number).success).toBe(ok);
  });

  it('validates vehicle position and rejects out-of-range coords', () => {
    const ok = {
      id: 'veh-1',
      coordinate: { lat: 40.7, lng: -74.0 },
      updatedAt: '2024-01-01T00:00:00Z',
    };
    const bad = {
      id: 'veh-2',
      coordinate: { lat: -100, lng: 0 },
      updatedAt: '2024-01-01T00:00:00Z',
    };
    expect(VehiclePositionSchema.safeParse(ok).success).toBe(true);
    expect(VehiclePositionSchema.safeParse(bad).success).toBe(false);
    // strict: reject extra fields
    const extra = { ...ok, extra: true } as any;
    expect(VehiclePositionSchema.safeParse(extra).success).toBe(false);
    // bearing boundary and speed non-negative
    expect(VehiclePositionSchema.safeParse({ ...ok, bearing: 0 }).success).toBe(true);
    expect(VehiclePositionSchema.safeParse({ ...ok, bearing: 359.9 }).success).toBe(true);
    expect(VehiclePositionSchema.safeParse({ ...ok, bearing: 360 }).success).toBe(false);
    expect(VehiclePositionSchema.safeParse({ ...ok, speedMps: -1 }).success).toBe(false);
  });

  it('validates Trip schema with optional fields and rejects invalid direction', () => {
    const minimal = {
      id: 'trip-1',
      routeId: 'route-1',
      serviceId: 'wkdy',
    };
    const full = {
      ...minimal,
      headsign: 'Downtown',
      directionId: 1,
      shapeId: 'shape-xyz',
    };
    expect(TripDirectionSchema.safeParse(1).success).toBe(true);
    expect(TripDirectionSchema.safeParse(0).success).toBe(true);
    expect(TripDirectionSchema.safeParse(2).success).toBe(false);
    expect(TripSchema.safeParse(minimal).success).toBe(true);
    expect(TripSchema.safeParse(full).success).toBe(true);
    expect(TripSchema.safeParse({ ...minimal, directionId: 2 }).success).toBe(false);
  });

  it('validates Route optional colors and rejects invalid color shapes', () => {
    const base = { id: 'r1', agencyId: 'a1', longName: 'Blue', type: 1 };
    expect(RouteSchema.safeParse(base).success).toBe(true);
    expect(RouteSchema.safeParse({ ...base, color: '#abcdef' }).success).toBe(true);
    expect(RouteSchema.safeParse({ ...base, textColor: '#ABC' }).success).toBe(true);
    expect(RouteSchema.safeParse({ ...base, color: 'ABCDEF' }).success).toBe(false);
    expect(RouteSchema.safeParse({ ...base, textColor: '#1234' }).success).toBe(false);
  });

  it.each([
    [0, true],
    [1, true],
    [2, false],
    [-1, false],
  ])('TripDirection %s -> %s', (value, ok) => {
    expect(TripDirectionSchema.safeParse(value as number).success).toBe(ok);
  });

  it.each([
    ['in_service', true],
    ['out_of_service', true],
    ['layover', true],
    ['deadhead', true],
    ['IN_SERVICE', false],
  ])('VehicleStatus %s -> %s', (value, ok) => {
    expect(VehicleStatusSchema.safeParse(value as any).success).toBe(ok);
  });

  it('validates Agency, Stop, Route minimal shapes', () => {
    const agency = {
      id: 'agency-1',
      name: 'City Transit',
      url: 'https://agency.example',
      timezone: 'America/New_York',
    };
    expect(AgencySchema.safeParse(agency).success).toBe(true);
    expect(AgencySchema.safeParse({ ...agency, extra: true } as any).success).toBe(false);

    const stop = {
      id: 'stop-1',
      name: 'Main St',
      coordinate: { lat: 0, lng: 0 },
    };
    expect(StopSchema.safeParse(stop).success).toBe(true);
    expect(StopSchema.safeParse({ ...stop, coordinate: { lat: -100, lng: 0 } }).success).toBe(false);

    const route = {
      id: 'route-1',
      agencyId: 'agency-1',
      longName: 'Blue Line',
      type: 1,
    };
    expect(RouteSchema.safeParse(route).success).toBe(true);
    expect(RouteSchema.safeParse({ ...route, longName: undefined } as any).success).toBe(false);
  });
});
