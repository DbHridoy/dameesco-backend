import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/auth.middleware';
import { authorizeRoles } from '@/middleware/role.middleware';
import { validate } from '@/middleware/validate.middleware';
import { uploadAudio, uploadImage } from '@/middleware/upload.middleware';
import { USER_ROLES } from '@/constants/roles';
import * as songController from './song.controller';
import bulkImportRoutes from '@/modules/bulk-import/bulk-import.routes';
import {
  createSongSchema,
  idOrSlugParamSchema,
  listSongsQuerySchema,
  publishSongSchema,
  songIdParamSchema,
  updateSongSchema,
} from './song.validation';

const router = Router();

// Public/user routes
router.get(
  '/',
  optionalAuthenticate,
  validate(listSongsQuerySchema, 'query'),
  songController.listSongs,
);

router.get(
  '/featured',
  songController.featuredSongs,
);

router.get(
  '/search',
  validate(listSongsQuerySchema, 'query'),
  songController.searchSongs,
);

router.use('/bulk-import', bulkImportRoutes);

router.get(
  '/:id/preview-url',
  validate(songIdParamSchema, 'params'),
  songController.getPreviewAssetUrl,
);

router.get(
  '/:idOrSlug',
  validate(idOrSlugParamSchema, 'params'),
  songController.getSong,
);

// Admin routes
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(createSongSchema),
  songController.createSong,
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  validate(updateSongSchema),
  songController.updateSong,
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  songController.deleteSong,
);

router.get(
  '/:id/asset-url',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  songController.getAssetUrl,
);

router.post(
  '/:id/upload-audio',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  uploadAudio.single('audio'),
  songController.uploadAudio,
);

router.post(
  '/:id/upload-cover',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  uploadImage.single('cover'),
  songController.uploadCover,
);

router.post(
  '/:id/generate-watermark',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  songController.generateWatermark,
);

router.post(
  '/:id/generate-ai-tags',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  songController.generateAiTags,
);

router.patch(
  '/:id/publish',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  validate(publishSongSchema),
  songController.publishSong,
);

router.patch(
  '/:id/archive',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(songIdParamSchema, 'params'),
  songController.archiveSong,
);

export default router;
