import type { ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

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

/** Create a 400 BadRequest AppError with optional details (e.g., Zod issues). */
export const badRequest = (message: string, details?: unknown): AppError => ({
  name: 'BadRequest',
  message,
  status: 400,
  details,
});

/** Create a 404 NotFound AppError. */
export const notFound = (message: string): AppError => ({
  name: 'NotFound',
  message,
  status: 404,
});

/**
 * Express error middleware that returns a consistent JSON payload.
 *
 * Payload shape: { ok: false, error: string, details?: unknown }
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const payload: any = { ok: false };
  const e = err as Partial<AppError> | undefined;
  if (e && typeof e === 'object' && typeof e.status === 'number' && typeof e.message === 'string') {
    res.status(e.status);
    payload.error = e.message;
    if (e.details !== undefined) payload.details = e.details;
  } else {
    res.status(500);
    payload.error = 'Internal Server Error';
  }
  res.json(payload);
}

/**
 * Convert a ZodError into a minimal array of plain issues suitable for JSON responses.
 * Each issue contains a dotted `path`, human `message`, and Zod `code`.
 */
export function zodIssuesToPlain(error: ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
}
