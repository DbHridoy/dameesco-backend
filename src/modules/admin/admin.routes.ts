import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { USER_ROLES } from '@/constants/roles';
import * as adminController from './admin.controller';
import * as downloadController from '@/modules/downloads/download.controller';
import { adminLicenseRouter } from '@/modules/licensing/license-request.routes';
import { adminAccessRequestRouter } from '@/modules/access-requests/access-request.routes';
import * as userController from '@/modules/users/user.controller';
import { validate } from '@/middleware/validate.middleware';
import {
  createAdminSchema,
  listUsersQuerySchema,
} from '@/modules/users/user.validation';

const router = Router();

router.use(authenticate, authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN));

router.get('/dashboard', adminController.dashboard);
router.get('/songs/stats', adminController.songStats);

// Users
router.get(
  '/users',
  validate(listUsersQuerySchema, 'query'),
  userController.listUsers,
);
router.post(
  '/users/admins',
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  validate(createAdminSchema),
  userController.createAdmin,
);
router.get('/users/:id', userController.getUser);
router.patch('/users/:id/status', userController.updateUserStatus);
router.patch('/users/:id/subscription', userController.updateSubscription);

// Downloads
router.get('/downloads', downloadController.listDownloads);
router.get('/downloads/stats', downloadController.downloadStats);

// License requests (admin sub-router)
router.use('/license-requests', adminLicenseRouter);

// Access requests (admin sub-router)
router.use('/access-requests', adminAccessRequestRouter);

export default router;
