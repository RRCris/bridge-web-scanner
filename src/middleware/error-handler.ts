import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { Naps2Error } from '../services/naps2.service';
import { ProfilesError } from '../services/profiles.service';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError | Naps2Error | ProfilesError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`Error: ${err.message}`, { stack: err.stack });

  if (err instanceof Naps2Error) {
    res.status(500).json({
      success: false,
      error: err.message,
      details: {
        code: err.code,
        stderr: err.stderr || undefined,
        stdout: err.stdout || undefined,
      },
    });
    return;
  }

  if (err instanceof ProfilesError) {
    const statusCode = getProfilesErrorStatusCode(err.code);
    res.status(statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

function getProfilesErrorStatusCode(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'DUPLICATE_ERROR':
      return 409;
    case 'PARSE_ERROR':
      return 500;
    default:
      return 500;
  }
}

export function createError(message: string, statusCode: number): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}