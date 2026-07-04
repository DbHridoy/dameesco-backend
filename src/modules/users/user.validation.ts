import { z } from 'zod';
import { USER_STATUS } from '@/constants/user-status';
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLAN,
} from '@/constants/subscription';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().trim().optional(),
  avatar: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const updateUserStatusSchema = z.object({
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.BLOCKED]),
});

export const updateSubscriptionSchema = z.object({
  subscriptionStatus: z.enum([
    SUBSCRIPTION_STATUS.FREE,
    SUBSCRIPTION_STATUS.PAID,
  ]),
  subscriptionPlan: z.enum([
    SUBSCRIPTION_PLAN.FREE,
    SUBSCRIPTION_PLAN.STANDARD,
    SUBSCRIPTION_PLAN.PREMIUM,
    SUBSCRIPTION_PLAN.CUSTOM,
  ]),
  paidAccessStartsAt: z.string().datetime().optional(),
  paidAccessEndsAt: z.string().datetime().optional(),
  downloadLimit: z.number().int().min(0).max(100000).optional(),
});

export const userIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.BLOCKED]).optional(),
  subscriptionStatus: z
    .enum([SUBSCRIPTION_STATUS.FREE, SUBSCRIPTION_STATUS.PAID])
    .optional(),
  sortBy: z
    .enum(['createdAt', 'name', 'email', 'downloadsUsed'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;