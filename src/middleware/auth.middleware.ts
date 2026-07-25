import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/utils/ApiError';
import { verifyAccessToken } from '@/utils/generateToken';
import { isValidObjectId } from '@/utils/sanitizeQuery';
import { USER_ROLES } from '@/constants/roles';

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }

    const token = header.split(' ')[1];
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    const decoded = verifyAccessToken(token);
    if (!decoded?.id || !isValidObjectId(decoded.id)) {
      throw new ApiError(401, 'Invalid token payload');
    }

    req.user = {
      id: decoded.id,
      role: decoded.role as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
      email: decoded.email,
    };
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      next();
      return;
    }
    if (!header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Invalid authorization header');
    }

    const token = header.split(' ')[1];
    if (!token) {
      throw new ApiError(401, 'Invalid authorization header');
    }

    const decoded = verifyAccessToken(token);
    if (!decoded?.id || !isValidObjectId(decoded.id)) {
      throw new ApiError(401, 'Invalid token payload');
    }

    req.user = {
      id: decoded.id,
      role: decoded.role as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
      email: decoded.email,
    };
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (
    req.user?.role !== USER_ROLES.ADMIN &&
    req.user?.role !== USER_ROLES.SUPER_ADMIN
  ) {
    next(new ApiError(403, 'Admin access required'));
    return;
  }
  next();
};
