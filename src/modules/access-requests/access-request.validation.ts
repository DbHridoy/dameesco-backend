import { z } from 'zod';
import { SUBSCRIPTION_PLAN } from '@/constants/subscription';
import { ACCESS_REQUEST_STATUS } from '@/constants/license-status';

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const createAccessRequestSchema = z.object({
  requestedPlan: z.enum([
    SUBSCRIPTION_PLAN.STANDARD,
    SUBSCRIPTION_PLAN.PREMIUM,
    SUBSCRIPTION_PLAN.CUSTOM,
  ]),
  paymentMethod: z.string().min(1).max(80),
  transactionReference: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
});

export const decideAccessRequestSchema = z.object({
  adminNote: z.string().max(2000).optional(),
  paidAccessStartsAt: z.string().datetime().optional(),
  paidAccessEndsAt: z.string().datetime().optional(),
  downloadLimit: z.coerce.number().int().min(0).max(100000).optional(),
  subscriptionPlan: z
    .enum([
      SUBSCRIPTION_PLAN.STANDARD,
      SUBSCRIPTION_PLAN.PREMIUM,
      SUBSCRIPTION_PLAN.CUSTOM,
    ])
    .optional(),
});

export const accessRequestIdParamSchema = z.object({
  id: objectIdSchema,
});

export type CreateAccessRequestInput = z.infer<
  typeof createAccessRequestSchema
>;
export type DecideAccessRequestInput = z.infer<
  typeof decideAccessRequestSchema
>;

void ACCESS_REQUEST_STATUS;