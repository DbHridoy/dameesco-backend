import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { validate } from '@/middleware/validate.middleware';
import { USER_ROLES } from '@/constants/roles';
import * as licenseController from './license-request.controller';
import {
  createLicenseRequestSchema,
  licenseIdParamSchema,
  updateLicenseStatusSchema,
} from './license-request.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/requests',
  validate(createLicenseRequestSchema),
  licenseController.createRequest,
);

router.get('/my-requests', licenseController.listMyRequests);

export default router;

// Admin-specific routes
export const adminLicenseRouter = Router();

adminLicenseRouter.use(authenticate, authorizeRoles(USER_ROLES.ADMIN));

adminLicenseRouter.get(
  '/requests',
  licenseController.listAllRequests,
);

adminLicenseRouter.get(
  '/requests/:id',
  validate(licenseIdParamSchema, 'params'),
  licenseController.getRequest,
);

adminLicenseRouter.patch(
  '/requests/:id/status',
  validate(licenseIdParamSchema, 'params'),
  validate(updateLicenseStatusSchema),
  licenseController.updateStatus,
);