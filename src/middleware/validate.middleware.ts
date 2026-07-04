import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '@/utils/ApiError';

type Source = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const parsed = schema.parse(data);
      // attach parsed data back so handlers/controllers can use sanitized values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any)[source] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        next(new ApiError(400, 'Validation failed', errors));
        return;
      }
      next(error);
    }
  };