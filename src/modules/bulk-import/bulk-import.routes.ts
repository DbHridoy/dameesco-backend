import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { uploadBulkImport } from '@/middleware/upload.middleware';
import { USER_ROLES } from '@/constants/roles';
import * as bulkImportController from './bulk-import.controller';

const router = Router();

router.use(authenticate, authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN));

router.get('/template', bulkImportController.downloadTemplate);

router.post(
  '/validate',
  uploadBulkImport.fields([
    { name: 'audioZip', maxCount: 1 },
    { name: 'metadata', maxCount: 1 },
  ]),
  bulkImportController.validateImport,
);

router.get('/jobs/:id', bulkImportController.getJob);
router.post('/jobs/:id/import', bulkImportController.startImport);
router.get('/jobs/:id/report', bulkImportController.downloadReport);

export default router;
