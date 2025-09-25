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
  .describe('GTFS route_type code (0..1702)');
/** Type of {@link RouteTypeSchema}. */
export type RouteType = z.infer<typeof RouteTypeSchema>;

/** Transit agency metadata. */
export const AgencySchema = z
  .object({
    id: IdSchema.describe('Agency identifier'),
    name: NonEmptyStringSchema.describe('Public display name'),
    url: HttpUrlSchema.describe('Agency homepage URL'),
    timezone: IanaTimezoneSchema.describe('Primary local timezone'),
    lang: z.string().min(2).optional().describe('BCP-47 language tag (optional)'),
    phone: z.string().optional().describe('Public contact phone (optional)'),
  })
  .strict()
  .describe('Transit agency metadata');
/** Type of {@link AgencySchema}. */
export type Agency = z.infer<typeof AgencySchema>;

/** Stop/station with coordinate and optional codes/descriptions. */
export const StopSchema = z
  .object({
    id: IdSchema.describe('Stop/station identifier'),
    name: NonEmptyStringSchema.describe('Stop display name'),
    coordinate: CoordinateSchema.describe('Stop coordinate (WGS84)'),
    code: NonEmptyStringSchema.optional().describe('Public-facing stop code (optional)'),
    desc: NonEmptyStringSchema.optional().describe('Longer description (optional)'),
    zoneId: NonEmptyStringSchema.optional().describe('Fare zone identifier (optional)'),
  })
  .strict()
  .describe('Stop or station definition');
/** Type of {@link StopSchema}. */
export type Stop = z.infer<typeof StopSchema>;

/** Route line metadata and presentation fields. */
export const RouteSchema = z
  .object({
    id: IdSchema.describe('Route identifier'),
    agencyId: IdSchema.describe('Owning agency identifier'),
    shortName: NonEmptyStringSchema.optional().describe('Short name/number (optional)'),
    longName: NonEmptyStringSchema.describe('Long public name'),
    type: RouteTypeSchema.describe('GTFS route_type'),
    color: ColorHexSchema.optional().describe('Brand color hex (optional)'),
    textColor: ColorHexSchema.optional().describe('Text color hex (optional)'),
  })
  .strict()
  .describe('Route metadata and presentation');
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
    id: IdSchema.describe('Trip identifier'),
    routeId: IdSchema.describe('Associated route identifier'),
    serviceId: NonEmptyStringSchema.describe('Service calendar identifier'),
    headsign: NonEmptyStringSchema.optional().describe('Headsign (optional)'),
    directionId: TripDirectionSchema.optional().describe('Direction (optional)'),
    shapeId: NonEmptyStringSchema.optional().describe('Polyline shape id (optional)'),
  })
  .strict()
  .describe('Scheduled or canonical trip');
/** Type of {@link TripSchema}. */
export type Trip = z.infer<typeof TripSchema>;

/** High-level vehicle operational status. */
export const VehicleStatusSchema = z
  .enum(['in_service', 'out_of_service', 'layover', 'deadhead'])
  .describe('Operational status of a vehicle');
/** Type of {@link VehicleStatusSchema}. */
export type VehicleStatus = z.infer<typeof VehicleStatusSchema>;

/** Real-time vehicle position/telemetry snapshot. */
export const VehiclePositionSchema = z
  .object({
    id: IdSchema.describe('Vehicle identifier'),
    tripId: IdSchema.optional().describe('Active trip (optional)'),
    routeId: IdSchema.optional().describe('Active route (optional)'),
    coordinate: CoordinateSchema.describe('Current coordinate (WGS84)'),
    bearing: z
      .number()
      .gte(0)
      .lt(360)
      .optional()
      .describe('Bearing degrees [0, 360) (optional)'),
    speedMps: z
      .number()
      .gte(0)
      .optional()
      .describe('Speed meters/second (optional)'),
    updatedAt: IsoDateTimeStringSchema.describe('Sample timestamp (ISO 8601)'),
    status: VehicleStatusSchema.optional().describe('Operational status (optional)'),
  })
  .strict()
  .describe('Real-time vehicle position/telemetry');
/** Type of {@link VehiclePositionSchema}. */
export type VehiclePosition = z.infer<typeof VehiclePositionSchema>;

/** Metadata about an ingested feed snapshot. */
export const FeedMetadataSchema = z
  .object({
    source: HttpUrlSchema.or(NonEmptyStringSchema).describe('Origin URL or identifier'),
    fetchedAt: IsoDateTimeStringSchema.describe('Ingestion timestamp (ISO 8601)'),
    version: NonEmptyStringSchema.optional().describe('Upstream feed version (optional)'),
  })
  .strict()
  .describe('Metadata about an ingested feed snapshot');
/** Type of {@link FeedMetadataSchema}. */
export type FeedMetadata = z.infer<typeof FeedMetadataSchema>;
