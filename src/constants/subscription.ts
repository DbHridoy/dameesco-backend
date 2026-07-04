export const SUBSCRIPTION_STATUS = {
  FREE: 'free',
  PAID: 'paid',
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const SUBSCRIPTION_PLAN = {
  FREE: 'free',
  STANDARD: 'standard',
  PREMIUM: 'premium',
  CUSTOM: 'custom',
} as const;

export type SubscriptionPlan =
  (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN];