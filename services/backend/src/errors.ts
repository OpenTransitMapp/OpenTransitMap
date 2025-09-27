import type { ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * Standardized error type for application-level errors.
 * This type provides a consistent error format across the application.
 * 
 * @remarks
 * - Prefer throwing plain objects matching this shape over Error subclasses
 * - All errors include a name, message, and HTTP status code
 * - Optional details field can carry structured error information
 * - Used by route handlers to communicate errors to the error middleware
 * 
 * @example
 * throw {
 *   name: 'BadRequest',
 *   message: 'Invalid viewport coordinates',
 *   status: 400,
 *   details: { field: 'bbox.south', issue: 'Must be between -90 and 90' }
 * } as AppError;
 */
export type AppError = {
  name: 'BadRequest' | 'NotFound';
  message: string;
  status: number;
  details?: unknown;
};

/**
 * Creates a 400 Bad Request error with optional details.
 * Use this for client errors like invalid input or malformed requests.
 * 
 * @param message - Human-readable error message
 * @param details - Optional structured error details (e.g., validation issues)
 * @returns AppError with status 400
 * 
 * @example
 * // Basic usage
 * throw badRequest('Missing required field');
 * 
 * @example
 * // With validation details
 * throw badRequest('Invalid input', [
 *   { field: 'email', issue: 'Must be a valid email address' }
 * ]);
 */
export const badRequest = (message: string, details?: unknown): AppError => ({
  name: 'BadRequest',
  message,
  status: 400,
  details,
});

/**
 * Creates a 404 Not Found error.
 * Use this when a requested resource doesn't exist or has expired.
 * 
 * @param message - Human-readable error message explaining what wasn't found
 * @returns AppError with status 404
 * 
 * @example
 * throw notFound('Scope not found or expired');
 * 
 * @example
 * throw notFound(`Vehicle ${id} not found in current frame`);
 */
export const notFound = (message: string): AppError => ({
  name: 'NotFound',
  message,
  status: 404,
});

/**
 * Express error handling middleware that standardizes error responses.
 * Converts various error types into a consistent JSON response format.
 * 
 * @remarks
 * - All errors are converted to JSON with { ok: false, error: string }
 * - AppErrors include their details in the response if provided
 * - Unknown errors are converted to 500 Internal Server Error
 * - Status code is preserved from AppErrors or defaults to 500
 * 
 * Response Format:
 * ```typescript
 * {
 *   ok: false,
 *   error: string,      // Human-readable error message
 *   details?: unknown   // Optional structured error information
 * }
 * ```
 * 
 * @example Response for BadRequest
 * Status: 400
 * {
 *   "ok": false,
 *   "error": "Invalid viewport coordinates",
 *   "details": [{ "field": "bbox.south", "message": "Must be between -90 and 90" }]
 * }
 * 
 * @example Response for unknown error
 * Status: 500
 * {
 *   "ok": false,
 *   "error": "Internal Server Error"
 * }
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
 * Converts Zod validation errors into a simplified format suitable for API responses.
 * This makes validation errors more readable and consistent in the API.
 * 
 * @param error - The Zod validation error to convert
 * @returns Array of simplified validation issues
 * 
 * @remarks
 * Each issue in the output contains:
 * - path: Dotted path to the invalid field (e.g., "user.email")
 * - message: Human-readable error message
 * - code: Zod error code for programmatic handling
 * 
 * @example
 * // Input ZodError from validating { email: "not-an-email" }
 * const result = userSchema.safeParse({ email: "not-an-email" });
 * if (!result.success) {
 *   const issues = zodIssuesToPlain(result.error);
 *   // issues = [{
 *   //   path: "email",
 *   //   message: "Invalid email address",
 *   //   code: "invalid_string"
 *   // }]
 * }
 */
export function zodIssuesToPlain(error: ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
}
