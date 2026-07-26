import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/auth.middleware';
import { uploadImage } from '@/middleware/upload.middleware';
import { validate } from '@/middleware/validate.middleware';
import * as playlistController from './playlist.controller';
import {
  createPlaylistSchema,
  playlistIdParamSchema,
  playlistSongParamSchema,
  updatePlaylistSchema,
} from './playlist.validation';

const router = Router();

router.get('/public', playlistController.listPublicPlaylists);
router.post(
  '/:id/view',
  optionalAuthenticate,
  validate(playlistIdParamSchema, 'params'),
  playlistController.recordPublicPlaylistView,
);

router.use(authenticate);

router.post('/', validate(createPlaylistSchema), playlistController.createPlaylist);
router.get('/my', playlistController.listMyPlaylists);
router.get('/:id', validate(playlistIdParamSchema, 'params'), playlistController.getPlaylist);
router.patch('/:id', validate(playlistIdParamSchema, 'params'), validate(updatePlaylistSchema), playlistController.updatePlaylist);
router.delete('/:id', validate(playlistIdParamSchema, 'params'), playlistController.deletePlaylist);
router.post(
  '/:id/upload-cover',
  validate(playlistIdParamSchema, 'params'),
  uploadImage.single('cover'),
  playlistController.uploadCover,
);

router.post(
  '/:id/songs/:songId',
  validate(playlistSongParamSchema, 'params'),
  playlistController.addSong,
);

router.delete(
  '/:id/songs/:songId',
  validate(playlistSongParamSchema, 'params'),
  playlistController.removeSong,
);

export default router;
