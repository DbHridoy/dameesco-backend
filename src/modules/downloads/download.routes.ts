import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { USER_ROLES } from '@/constants/roles';
import * as downloadController from './download.controller';

const router = Router();

router.post(
  '/songs/:songId',
  authenticate,
  downloadController.downloadSong,
);

// Admin routes (mounted under /api/v1/admin/downloads via admin.routes.ts,
// but also exposed here for convenience)
router.get(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  downloadController.listDownloads,
);
router.get(
  '/stats',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  downloadController.downloadStats,
);

export default router;