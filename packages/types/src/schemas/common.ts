import { z } from 'zod';

export const NonEmptyStringSchema = z.string().min(1);
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;

export const IdSchema = NonEmptyStringSchema.brand('Id');
export type Id = z.infer<typeof IdSchema>;

export const IsoDateTimeStringSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: 'Invalid ISO8601 timestamp',
  })
  .brand('IsoDateTimeString');
export type IsoDateTimeString = z.infer<typeof IsoDateTimeStringSchema>;

export const UrlSchema = z.string().url().brand('Url');
export type Url = z.infer<typeof UrlSchema>;

export const LatitudeSchema = z.number().gte(-90).lte(90).brand('Latitude');
export type Latitude = z.infer<typeof LatitudeSchema>;

export const LongitudeSchema = z.number().gte(-180).lte(180).brand('Longitude');
export type Longitude = z.infer<typeof LongitudeSchema>;

export const CoordinateSchema = z
  .object({
    lat: LatitudeSchema,
    lng: LongitudeSchema,
  })
  .strict();
export type Coordinate = z.infer<typeof CoordinateSchema>;

