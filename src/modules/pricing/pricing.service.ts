import PricingPlan, { PricingPlanDocument } from './pricing.model';
import { ApiError } from '@/utils/ApiError';
import { UpdatePricingPlanInput } from './pricing.validation';

const defaultPlans: Array<Partial<PricingPlanDocument>> = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Start Searching and try video sync.',
    monthlyPrice: 0,
    annualDiscountPercent: 0,
    currency: 'USD',
    cadence: 'forever',
    ctaLabel: 'Start Searching',
    ctaHref: '/library',
    features: ['Unlimited search', 'Video sync previews', 'Personal shortlists'],
    isFeatured: false,
    sortOrder: 1,
    isActive: true,
  },
  {
    key: 'studio',
    name: 'Studio',
    description: 'For agencies licensing music often.',
    monthlyPrice: 49,
    annualDiscountPercent: 20,
    currency: 'USD',
    cadence: 'seat / mo',
    ctaLabel: 'Send Request',
    ctaHref: '/library',
    features: [
      'Everything in Starter',
      'Stems on every track',
      'Shared team shortlists',
      'Remove watermarks',
    ],
    isFeatured: true,
    sortOrder: 2,
    isActive: true,
  },
];

export const ensureDefaultPricingPlans = async (): Promise<void> => {
  await Promise.all(
    defaultPlans.map((plan) =>
      PricingPlan.updateOne(
        { key: plan.key },
        { $setOnInsert: plan },
        { upsert: true },
      ),
    ),
  );
};

export const listPricingPlans = async ({
  includeInactive = false,
}: {
  includeInactive?: boolean;
} = {}): Promise<PricingPlanDocument[]> => {
  await ensureDefaultPricingPlans();
  const filter = includeInactive ? {} : { isActive: true };
  return PricingPlan.find(filter).sort({ sortOrder: 1, createdAt: 1 });
};

export const updatePricingPlan = async (
  key: 'starter' | 'studio',
  payload: UpdatePricingPlanInput,
): Promise<PricingPlanDocument> => {
  await ensureDefaultPricingPlans();
  const plan = await PricingPlan.findOneAndUpdate(
    { key },
    { $set: payload },
    { new: true, runValidators: true },
  );

  if (!plan) {
    throw new ApiError(404, 'Pricing plan not found');
  }

  return plan;
};
