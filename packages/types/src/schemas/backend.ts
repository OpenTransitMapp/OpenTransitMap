import { z } from 'zod';
import { IsoDateTimeStringSchema, NonEmptyStringSchema } from './common.js';
import { ScopeIdSchema } from './viewport.js';
import { ScopedTrainsFrameSchema } from './frames.js';
import { ScopeDefinitionSchema } from './viewport.js';

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
  .describe('Response payload for GET /healthz')
  .meta({
    id: 'HealthzResponse',
    example: { ok: true, service: 'backend', time: '2024-09-25T12:34:56Z' },
  });
/** Type of {@link HealthzResponseSchema}. */
export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;

/** Standard API error envelope. */
export const ApiErrorSchema = z
  .object({
    ok: z.literal(false).describe('Always false to indicate an error response.'),
    error: z.string().describe('Human‑readable error message summarizing the failure.'),
    details: z.any().optional().describe('Optional machine‑readable details (e.g., validation issues).'),
  })
  .strict()
  .describe('Standard API error envelope used across endpoints. Provides a stable shape for clients to handle failures consistently.')
  .meta({ id: 'ApiError', example: { ok: false, error: 'Invalid viewport request' } });
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Query parameters for GET /api/v1/trains (scoped fetch). */
export const GetScopedTrainsQuerySchema = z
  .object({
    // When used under requestParams.query, zod-openapi derives name/in
    scope: ScopeIdSchema.describe('Viewport scope identifier. Use the value returned by POST /api/v1/trains/scopes.'),
  })
  .strict()
  .describe('Query parameters for fetching the latest scoped trains frame.')
  .meta({ id: 'GetScopedTrainsQuery', example: { scope: 'scope_nyc_abc123' } });
export type GetScopedTrainsQuery = z.infer<typeof GetScopedTrainsQuerySchema>;

/** Response for POST /api/v1/trains/scopes. */
export const ProvisionScopeResponseSchema = z
  .object({
    ok: z.literal(true).describe('Always true to indicate success.'),
    scopeId: ScopeIdSchema.describe('Minted or reused scope identifier.'),
    frame: ScopedTrainsFrameSchema.describe('Initial scoped frame (may be empty if no vehicles yet).'),
  })
  .strict()
  .describe('Response for provisioning a viewport scope, including the scope identifier and the initial scoped frame.')
  .meta({
    id: 'ProvisionScopeResponse',
    example: {
      ok: true,
      scopeId: 'scope_nyc_abc123',
      frame: {
        scopeId: 'scope_nyc_abc123',
        bbox: { south: 40.7, west: -74.02, north: 40.78, east: -73.94, zoom: 12 },
        cityId: 'nyc',
        at: '2024-09-25T12:34:56Z',
        vehicles: [],
      },
    },
  });
export type ProvisionScopeResponse = z.infer<typeof ProvisionScopeResponseSchema>;

/** Response for GET /api/v1/trains (scoped). */
export const GetScopedTrainsResponseSchema = z
  .object({
    ok: z.literal(true).describe('Always true to indicate success.'),
    frame: ScopedTrainsFrameSchema.describe('Latest scoped trains frame for the requested scope.'),
  })
  .strict()
  .describe('Response with the latest scoped trains frame.')
  .meta({
    id: 'GetScopedTrainsResponse',
    example: {
      ok: true,
      frame: {
        scopeId: 'scope_nyc_abc123',
        bbox: { south: 40.7, west: -74.02, north: 40.78, east: -73.94, zoom: 12 },
        cityId: 'nyc',
        at: '2024-09-25T12:35:10Z',
        vehicles: [
          {
            id: 'V123',
            coordinate: { lat: 40.75, lng: -73.98 },
            updatedAt: '2024-09-25T12:35:10Z',
            routeId: '1',
            status: 'in_service',
          },
        ],
      },
    },
  });
export type GetScopedTrainsResponse = z.infer<typeof GetScopedTrainsResponseSchema>;

/** Response for GET /api/v1/trains/scopes (list active scopes). */
export const GetScopesResponseSchema = z
  .object({
    ok: z.literal(true).describe('Always true to indicate success.'),
    scopes: z.array(ScopeDefinitionSchema).describe('Active (non-expired) viewport scopes currently in the store.'),
  })
  .strict()
  .describe('Response listing active viewport scopes.')
  .meta({
    id: 'GetScopesResponse',
    example: {
      ok: true,
      scopes: [
        {
          id: 'v1|nyc|40.7000|-74.0200|40.7600|-73.9600',
          cityId: 'nyc',
          bbox: { south: 40.7, west: -74.02, north: 40.76, east: -73.96, zoom: 12 },
          createdAt: '2024-09-25T12:34:56Z',
        },
      ],
    },
  });
export type GetScopesResponse = z.infer<typeof GetScopesResponseSchema>;
