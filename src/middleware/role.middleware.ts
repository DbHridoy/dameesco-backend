import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/utils/ApiError';
import { UserRole } from '@/constants/roles';

export const authorizeRoles =
  (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ApiError(
          403,
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        ),
      );
      return;
    }
    next();
  };