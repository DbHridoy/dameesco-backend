import { Response } from 'express';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';
import * as pricingService from './pricing.service';
import { UpdatePricingPlanInput } from './pricing.validation';

export const listPublicPricingPlans = asyncHandler(async (_req, res: Response) => {
  const plans = await pricingService.listPricingPlans();
  res.status(200).json(new ApiResponse('Pricing plans fetched', { plans }));
});

export const listAdminPricingPlans = asyncHandler(async (_req, res: Response) => {
  const plans = await pricingService.listPricingPlans({ includeInactive: true });
  res.status(200).json(new ApiResponse('Pricing plans fetched', { plans }));
});

export const updatePricingPlan = asyncHandler(async (req, res: Response) => {
  const key = req.params.key as 'starter' | 'studio';
  const payload = req.body as UpdatePricingPlanInput;
  const plan = await pricingService.updatePricingPlan(key, payload);
  res.status(200).json(new ApiResponse('Pricing plan updated', { plan }));
});
