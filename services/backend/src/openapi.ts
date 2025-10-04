import { createDocument } from 'zod-openapi';
import { z } from 'zod';
import { logger } from './logger.js';
import {
  ViewportRequestSchema,
  HealthzResponseSchema,
  ApiErrorSchema,
  GetScopedTrainsQuerySchema,
  ProvisionScopeResponseSchema,
  GetScopedTrainsResponseSchema,
  GetScopesResponseSchema,
} from '@open-transit-map/types';

/**
 * Creates the OpenAPI document for a given API major version.
 * 
 * @param options - OpenAPI configuration options
 * @returns OpenAPI document object
 */
export function createOpenApiDocument() {
  const prefix = '/api/v1';
  logger.debug('Generating OpenAPI document');

  const doc = createDocument({
    openapi: '3.1.0',
    info: {
      title: 'OpenTransitMap Backend API',
      version: '0.1.0',
      description: 'Generated from Zod schemas and route contracts. This is the source of truth; avoid duplicating endpoint docs in README.',
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
        get: {
          summary: 'List active viewport scopes',
          responses: {
            '200': {
              description: 'Active (non-expired) viewport scopes',
              content: { 'application/json': { schema: GetScopesResponseSchema } },
            },
          },
        },
        post: {
          summary: 'Provision a viewport scope',
          requestBody: {
            content: { 'application/json': { schema: ViewportRequestSchema } },
          },
          responses: {
            '201': {
              description: 'Created new scope; returns scoped frame and scopeId',
              content: { 'application/json': { schema: ProvisionScopeResponseSchema } },
            },
            '200': {
              description: 'Scope already exists; returns existing scoped frame and scopeId',
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

  logger.debug('OpenAPI document generated');
  return doc;
}
