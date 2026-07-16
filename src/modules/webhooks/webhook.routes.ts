import { Router } from 'express';
import * as webhookController from './webhook.controller';

const router = Router();

router.post('/cyanite', webhookController.cyanite);

export default router;
