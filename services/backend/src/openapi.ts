import { createDocument } from 'zod-openapi';
import { z } from 'zod';
import {
  ViewportRequestSchema,
  HealthzResponseSchema,
  ApiErrorSchema,
  GetScopedTrainsQuerySchema,
  ProvisionScopeResponseSchema,
  GetScopedTrainsResponseSchema,
} from '@open-transit-map/types';

export type ApiMajorVersion = 'v1';

/**
 * Generates the OpenAPI documentation for the backend API.
 * This function builds a complete OpenAPI 3.1.0 specification from our Zod schemas.
 * 
 * @remarks
 * - Documentation is generated from Zod schemas and route contracts
 * - Supports versioned APIs (currently v1)
 * - Includes examples and descriptions from schema metadata
 * - Serves as the source of truth for API documentation
 * 
 * Features documented:
 * - Health check endpoint (/healthz)
 * - Prometheus metrics (/metrics)
 * - Viewport scope provisioning (/api/v1/trains/scopes)
 * - Train frame retrieval (/api/v1/trains)
 * 
 * @param version - API major version to generate docs for (defaults to 'v1')
 * @returns OpenAPI document object
 * 
 * @example
 * // Generate v1 API docs
 * const docs = getOpenApiDocument('v1');
 * 
 * @example
 * // Access via Swagger UI
 * // GET /docs -> redirects to /docs/v1
 * // GET /docs/v1 -> Swagger UI for v1 API
 */
export function getOpenApiDocument(version: ApiMajorVersion = 'v1') {
  const prefix = `/api/${version}`;

  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'OpenTransitMap Backend API',
      version: '0.1.0',
      description:
        'Generated from Zod schemas and route contracts. This is the source of truth; avoid duplicating endpoint docs in README.',
    },
    servers: [{ url: '/' }],
    paths: {
      '/healthz': {
        get: {
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Health check',
              content: { 'application/json': { schema: HealthzResponseSchema } },
            },
          },
        },
      },
      '/metrics': {
        get: {
          summary: 'Prometheus metrics',
          responses: {
            '200': {
              description: 'Prometheus metrics',
              content: { 'text/plain; version=0.0.4': { schema: z.string() } },
            },
          },
        },
      },
      [`${prefix}/trains/scopes`]: {
        post: {
          summary: 'Provision a viewport scope',
          requestBody: {
            content: { 'application/json': { schema: ViewportRequestSchema } },
          },
          responses: {
            '201': {
              description: 'Scope provisioned; returns scoped frame and scopeId',
              content: { 'application/json': { schema: ProvisionScopeResponseSchema } },
            },
            '400': {
              description: 'Invalid viewport request',
              content: { 'application/json': { schema: ApiErrorSchema } },
            },
          },
        },
      },
      [`${prefix}/trains`]: {
        get: {
          summary: 'Fetch the latest scoped trains frame',
          requestParams: {
            query: GetScopedTrainsQuerySchema,
          },
          responses: {
            '200': {
              description: 'Latest scoped snapshot for the provided scopeId',
              content: { 'application/json': { schema: GetScopedTrainsResponseSchema } },
            },
            '400': {
              description: 'Missing/invalid scope parameter',
              content: { 'application/json': { schema: ApiErrorSchema } },
            },
            '404': {
              description: 'Scope not found',
              content: { 'application/json': { schema: ApiErrorSchema } },
            },
          },
        },
      },
    },
  }, {
    reused: 'ref',
  });
}
