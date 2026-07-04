import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/utils/ApiError';
import logger from '@/config/logger.config';
import env from '@/config/env.config';

interface ErrorResponseBody {
  success: boolean;
  message: string;
  errors?: unknown[];
}

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: unknown[] = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  }

  if (env.NODE_ENV !== 'production' && !(err instanceof ApiError)) {
    logger.error(
      { err, path: req.originalUrl, method: req.method },
      err.message,
    );
  } else {
    logger.error(
      { path: req.originalUrl, method: req.method, message },
      'Request error',
    );
  }

  const body: ErrorResponseBody = {
    success: false,
    message,
  };
  if (errors.length > 0) body.errors = errors;

  res.status(statusCode).json(body);
};