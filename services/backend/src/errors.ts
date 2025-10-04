import type { ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { errorLogger } from './logger.js';

/**
 * Shape of application errors emitted by route handlers.
 * Prefer throwing plain objects matching this shape instead of Error subclasses.
 */
export type AppError = {
  name: 'BadRequest' | 'NotFound';
  message: string;
  status: number;
  details?: unknown;
};

/**
 * Creates a 400 BadRequest AppError with optional details.
 * 
 * @param message - Human-readable error message
 * @param details - Optional structured error details (e.g., validation issues)
 * @returns AppError with status 400
 * 
 * @example
 * throw badRequest('Missing required field', { field: 'email' });
 */
export const badRequest = (message: string, details?: unknown): AppError => ({
  name: 'BadRequest',
  message,
  status: 400,
  details,
});

/**
 * Creates a 404 NotFound AppError.
 * 
 * @param message - Human-readable error message
 * @returns AppError with status 404
 * 
 * @example
 * throw notFound('Scope not found');
 */
export const notFound = (message: string): AppError => ({
  name: 'NotFound',
  message,
  status: 404,
});

/**
 * Express error middleware that returns consistent JSON payloads.
 * Uses the static logger for error logging.
 * 
 * Response Format:
 * ```typescript
 * {
 *   ok: false,
 *   error: string,      // Human-readable error message
 *   details?: unknown   // Optional structured error information
 * }
 * ```
 */
export function createErrorHandler() {
  return function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    const payload: any = { ok: false };
    const e = err as Partial<AppError> | undefined;

    if (e && typeof e === 'object' && typeof e.status === 'number' && typeof e.message === 'string') {
      res.status(e.status);
      payload.error = e.message;
      if (e.details !== undefined) payload.details = e.details;
      
      // Log client errors as warnings, server errors as errors
      const level = e.status < 500 ? 'warn' : 'error';
      errorLogger[level]({ 
        error: e,
        status: e.status,
        details: e.details
      }, e.message);
    } else {
      res.status(500);
      payload.error = 'Internal Server Error';
      
      // Log unexpected errors with stack trace if available
      errorLogger.error({
        error: err,
        stack: err instanceof Error ? err.stack : undefined
      }, 'Unexpected error');
    }

    res.json(payload);
  };
}

/**
 * Convert a ZodError into a minimal array of plain issues suitable for JSON responses.
 * Each issue contains a dotted `path`, human `message`, and Zod `code`.
 * 
 * @param error - Zod validation error to convert
 * @returns Array of simplified validation issues
 * 
 * @example
 * ```typescript
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   throw badRequest('Invalid input', zodIssuesToPlain(result.error));
 * }
 * ```
 */
export function zodIssuesToPlain(error: ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
}