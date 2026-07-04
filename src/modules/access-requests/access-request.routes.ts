import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { validate } from '@/middleware/validate.middleware';
import { uploadDocument } from '@/middleware/upload.middleware';
import { USER_ROLES } from '@/constants/roles';
import * as accessController from './access-request.controller';
import {
  accessRequestIdParamSchema,
  createAccessRequestSchema,
  decideAccessRequestSchema,
} from './access-request.validation';

const router = Router();
router.use(authenticate);

router.post(
  '/',
  uploadDocument.single('paymentProof'),
  validate(createAccessRequestSchema),
  accessController.createRequest,
);
router.get('/my', accessController.listMyRequests);

export default router;

// Admin router
export const adminAccessRequestRouter = Router();
adminAccessRequestRouter.use(
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
);

adminAccessRequestRouter.get('/', accessController.listAllRequests);

adminAccessRequestRouter.patch(
  '/:id/approve',
  validate(accessRequestIdParamSchema, 'params'),
  validate(decideAccessRequestSchema),
  accessController.approveRequest,
);

adminAccessRequestRouter.patch(
  '/:id/reject',
  validate(accessRequestIdParamSchema, 'params'),
  validate(decideAccessRequestSchema),
  accessController.rejectRequest,
);