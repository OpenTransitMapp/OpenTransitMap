import { z } from 'zod';
import { IsoDateTimeStringSchema, NonEmptyStringSchema } from './common.js';

/**
 * Health check HTTP response for `GET /healthz`.
 * - `ok`: true when the service is responding
 * - `service`: service name for quick identification
 * - `time`: server-side ISO8601 timestamp
 */
export const HealthzResponseSchema = z
  .object({
    ok: z.boolean().describe('Health indicator; true when service is responsive'),
    service: NonEmptyStringSchema.describe('Service name (e.g., "backend")'),
    time: IsoDateTimeStringSchema.describe('Server timestamp in ISO 8601'),
  })
  .strict()
  .describe('Response payload for GET /healthz');
/** Type of {@link HealthzResponseSchema}. */
export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;
