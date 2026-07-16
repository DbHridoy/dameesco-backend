import { Router } from 'express';
import authRoutes from '@/modules/auth/auth.routes';
import userRoutes from '@/modules/users/user.routes';
import songRoutes from '@/modules/songs/song.routes';
import playlistRoutes from '@/modules/playlists/playlist.routes';
import downloadRoutes from '@/modules/downloads/download.routes';
import licenseRoutes from '@/modules/licensing/license-request.routes';
import accessRequestRoutes from '@/modules/access-requests/access-request.routes';
import adminRoutes from '@/modules/admin/admin.routes';
import notificationRoutes from '@/modules/notifications/notification.routes';
import webhookRoutes from '@/modules/webhooks/webhook.routes';
import { ApiResponse } from '@/utils/ApiResponse';

const router = Router();

router.get('/health', (_req, res) => {
  res
    .status(200)
    .json(new ApiResponse('OK', { service: 'dameesco-backend', time: new Date() }));
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/songs', songRoutes);
router.use('/playlists', playlistRoutes);
router.use('/downloads', downloadRoutes);
router.use('/licensing', licenseRoutes);
router.use('/access-requests', accessRequestRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
