import { z } from 'zod';
import {
  IdSchema,
  NonEmptyStringSchema,
  HttpUrlSchema,
  CoordinateSchema,
  IsoDateTimeStringSchema,
} from './common.js';
import { IanaTimezoneSchema, ColorHexSchema } from './common.js';

/** GTFS route_type numeric code (0..1702). */
export const RouteTypeSchema = z
  .number()
  .int()
  .min(0)
  .max(1702)
  .describe('GTFS route_type code (0..1702)')
  .meta({ example: 1 });
/** Type of {@link RouteTypeSchema}. */
export type RouteType = z.infer<typeof RouteTypeSchema>;

/** Transit agency metadata. */
export const AgencySchema = z
  .object({
    id: IdSchema.describe('Agency identifier. Stable key used to associate routes and assets.'),
    name: NonEmptyStringSchema.describe('Public display name used in UI and documentation.'),
    url: HttpUrlSchema.describe('Agency homepage URL for further information or branding links.'),
    timezone: IanaTimezoneSchema.describe('Primary local timezone used for schedules and service calendars.'),
    lang: z.string().min(2).optional().describe('BCP‑47 language tag (optional). Used for localization preferences.'),
    phone: z.string().optional().describe('Public contact phone (optional). Human‑readable string.'),
  })
  .strict()
  .describe('Transit agency metadata as derived from GTFS agency.txt and related sources.')
  .meta({
    id: 'Agency',
    example: {
      id: 'mta',
      name: 'MTA New York City Transit',
      url: 'https://new.mta.info',
      timezone: 'America/New_York',
    },
  });
/** Type of {@link AgencySchema}. */
export type Agency = z.infer<typeof AgencySchema>;

/** Stop/station with coordinate and optional codes/descriptions. */
export const StopSchema = z
  .object({
    id: IdSchema.describe('Stop/station identifier. Stable key used in trip patterns and real‑time positions.'),
    name: NonEmptyStringSchema.describe('Public display name as shown on signage or in apps.'),
    coordinate: CoordinateSchema.describe('Stop coordinate (WGS84). Used for proximity and mapping.'),
    code: NonEmptyStringSchema.optional().describe('Public‑facing stop code (optional), often printed on signage.'),
    desc: NonEmptyStringSchema.optional().describe('Longer human‑readable description (optional).'),
    zoneId: NonEmptyStringSchema.optional().describe('Fare zone identifier (optional).'),
  })
  .strict()
  .describe('Stop or station definition with location and optional presentation fields.')
  .meta({ id: 'Stop', example: { id: 'S123', name: '34 St - Penn Station', coordinate: { lat: 40.7506, lng: -73.9935 } } });
/** Type of {@link StopSchema}. */
export type Stop = z.infer<typeof StopSchema>;

/** Route line metadata and presentation fields. */
export const RouteSchema = z
  .object({
    id: IdSchema.describe('Route identifier.'),
    agencyId: IdSchema.describe('Owning agency identifier.'),
    shortName: NonEmptyStringSchema.optional().describe('Short name/number (optional), e.g. route designator.'),
    longName: NonEmptyStringSchema.describe('Long public name for UI and announcements.'),
    type: RouteTypeSchema.describe('GTFS route_type numeric code.'),
    color: ColorHexSchema.optional().describe('Brand color hex (optional), e.g., #RRGGBB.'),
    textColor: ColorHexSchema.optional().describe('Contrasting text color hex (optional).'),
  })
  .strict()
  .describe('Route metadata and presentation attributes as used in rider‑facing apps.')
  .meta({ id: 'Route', example: { id: '1', agencyId: 'mta', shortName: '1', longName: 'Broadway - 7 Avenue Local', type: 1, color: '#EE352E', textColor: '#FFFFFF' } });
/** Type of {@link RouteSchema}. */
export type Route = z.infer<typeof RouteSchema>;

/** Trip direction (0 or 1), mirroring GTFS `direction_id`. */
export const TripDirectionSchema = z
  .union([z.literal(0), z.literal(1)])
  .describe('Trip direction_id (0 or 1)');
/** Type of {@link TripDirectionSchema}. */
export type TripDirection = z.infer<typeof TripDirectionSchema>;

/** Scheduled or canonical trip for a route/service. */
export const TripSchema = z
  .object({
    id: IdSchema.describe('Trip identifier.'),
    routeId: IdSchema.describe('Associated route identifier.'),
    serviceId: NonEmptyStringSchema.describe('Service calendar identifier (e.g., weekday schedule).'),
    headsign: NonEmptyStringSchema.optional().describe('Headsign (optional): destination text shown to riders.'),
    directionId: TripDirectionSchema.optional().describe('Direction (optional): 0 or 1, matching GTFS direction_id.'),
    shapeId: NonEmptyStringSchema.optional().describe('Polyline shape id (optional) for mapping.'),
  })
  .strict()
  .describe('Scheduled or canonical trip used to associate vehicles with service patterns.')
  .meta({ id: 'Trip' });
/** Type of {@link TripSchema}. */
export type Trip = z.infer<typeof TripSchema>;

/** High-level vehicle operational status. */
export const VehicleStatusSchema = z
  .enum(['in_service', 'out_of_service', 'layover', 'deadhead'])
  .describe('Operational status of a vehicle')
  .meta({ example: 'in_service' });
/** Type of {@link VehicleStatusSchema}. */
export type VehicleStatus = z.infer<typeof VehicleStatusSchema>;

/** Real-time vehicle position/telemetry snapshot. */
export const VehiclePositionSchema = z
  .object({
    id: IdSchema.describe('Vehicle identifier.'),
    tripId: IdSchema.optional().describe('Active trip (optional).'),
    routeId: IdSchema.optional().describe('Active route (optional).'),
    coordinate: CoordinateSchema.describe('Current coordinate (WGS84) of the vehicle.'),
    bearing: z
      .number()
      .gte(0)
      .lt(360)
      .optional()
      .describe('Bearing degrees [0, 360) (optional). 0 = North, increases clockwise.'),
    speedMps: z
      .number()
      .gte(0)
      .optional()
      .describe('Speed meters/second (optional).'),
    updatedAt: IsoDateTimeStringSchema.describe('Sample timestamp (ISO 8601, UTC).'),
    status: VehicleStatusSchema.optional().describe('Operational status (optional).'),
  })
  .strict()
  .describe('Real‑time vehicle position/telemetry for mapping and tracking.')
  .meta({
    id: 'VehiclePosition',
    example: {
      id: 'V123',
      coordinate: { lat: 40.75, lng: -73.98 },
      bearing: 90,
      speedMps: 12.5,
      updatedAt: '2024-09-25T12:34:56Z',
      routeId: '1',
      status: 'in_service',
    },
  });
/** Type of {@link VehiclePositionSchema}. */
export type VehiclePosition = z.infer<typeof VehiclePositionSchema>;

/** Metadata about an ingested feed snapshot. */
export const FeedMetadataSchema = z
  .object({
    source: HttpUrlSchema.or(NonEmptyStringSchema).describe('Origin URL or identifier of the upstream data source.'),
    fetchedAt: IsoDateTimeStringSchema.describe('Ingestion timestamp (ISO 8601, UTC).'),
    version: NonEmptyStringSchema.optional().describe('Upstream feed version (optional).'),
  })
  .strict()
  .describe('Metadata about an ingested feed snapshot, useful for provenance and debugging.')
  .meta({ id: 'FeedMetadata' });
/** Type of {@link FeedMetadataSchema}. */
export type FeedMetadata = z.infer<typeof FeedMetadataSchema>;
