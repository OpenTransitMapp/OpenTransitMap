import { z } from 'zod';
import { IsoDateTimeStringSchema, NonEmptyStringSchema } from './common.js';

export const HealthzResponseSchema = z
  .object({
    ok: z.boolean(),
    service: NonEmptyStringSchema,
    time: IsoDateTimeStringSchema,
  })
  .strict();
export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;

