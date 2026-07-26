import { z } from 'zod';

export const pricingPlanKeyParamSchema = z.object({
  key: z.enum(['starter', 'studio']),
});

export const updatePricingPlanSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().min(1).max(400).optional(),
  monthlyPrice: z.coerce.number().min(0).max(100000).optional(),
  annualDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  currency: z.string().min(1).max(10).optional(),
  cadence: z.string().min(1).max(80).optional(),
  ctaLabel: z.string().min(1).max(80).optional(),
  ctaHref: z.string().min(1).max(200).optional(),
  features: z.array(z.string().min(1).max(160)).min(1).max(20).optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePricingPlanInput = z.infer<typeof updatePricingPlanSchema>;
