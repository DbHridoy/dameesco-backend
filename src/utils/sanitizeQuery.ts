import { ApiError } from './ApiError';

export const isValidObjectId = (id: string): boolean => {
  return /^[a-fA-F0-9]{24}$/.test(id);
};

export const ensureValidObjectId = (id: string, label: string = 'id'): void => {
  if (!isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
};

export const sanitizeString = (input: unknown): string => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>$`|&;]/g, '').trim();
};

export const toObjectId = (id: string) => id;