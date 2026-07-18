import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { uploadVideo } from '@/middleware/upload.middleware';
import * as videoSyncController from './video-sync.controller';

const router = Router();

router.post(
  '/preview-download',
  authenticate,
  uploadVideo.single('video'),
  videoSyncController.renderPreview,
);

export default router;
