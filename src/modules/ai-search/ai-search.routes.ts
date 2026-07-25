import { Router } from 'express';
import { validate } from '@/middleware/validate.middleware';
import * as aiSearchController from './ai-search.controller';
import { smartSearchSchema } from './ai-search.validation';

const router = Router();

router.post('/smart', validate(smartSearchSchema), aiSearchController.smartSearch);

export default router;
