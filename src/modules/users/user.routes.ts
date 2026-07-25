import { Router } from 'express';
import { authenticate, requireAdmin } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { validate } from '@/middleware/validate.middleware';
import { USER_ROLES } from '@/constants/roles';
import * as userController from './user.controller';
import {
  changePasswordSchema,
  createAdminSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateSubscriptionSchema,
  updateUserStatusSchema,
  userIdParamSchema,
} from './user.validation';

const router = Router();

// Authenticated user endpoints
router.get('/me', authenticate, userController.getMe);
router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  userController.updateMe,
);
router.post(
  '/me/change-password',
  authenticate,
  validate(changePasswordSchema),
  userController.changePassword,
);

// Admin endpoints
router.get(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(listUsersQuerySchema, 'query'),
  userController.listUsers,
);
router.post(
  '/admins',
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  validate(createAdminSchema),
  userController.createAdmin,
);
router.get(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(userIdParamSchema, 'params'),
  userController.getUser,
);
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(userIdParamSchema, 'params'),
  validate(updateUserStatusSchema),
  userController.updateUserStatus,
);
router.patch(
  '/:id/subscription',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(userIdParamSchema, 'params'),
  validate(updateSubscriptionSchema),
  userController.updateSubscription,
);

// Silence unused requireAdmin import in some setups (kept for clarity)
void requireAdmin;

export default router;
