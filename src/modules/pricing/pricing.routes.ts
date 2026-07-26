import { Router } from 'express';
import { USER_ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { validate } from '@/middleware/validate.middleware';
import * as pricingController from './pricing.controller';
import {
  pricingPlanKeyParamSchema,
  updatePricingPlanSchema,
} from './pricing.validation';

const router = Router();

router.get('/', pricingController.listPublicPricingPlans);

router.get(
  '/admin',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  pricingController.listAdminPricingPlans,
);

router.patch(
  '/admin/:key',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(pricingPlanKeyParamSchema, 'params'),
  validate(updatePricingPlanSchema),
  pricingController.updatePricingPlan,
);

export default router;
