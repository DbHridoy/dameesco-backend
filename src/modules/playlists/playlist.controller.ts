import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as playlistService from './playlist.service';
import * as playlistAnalyticsService from '@/modules/analytics/playlist-analytics.service';
import {
  CreatePlaylistInput,
  UpdatePlaylistInput,
} from './playlist.validation';
import { USER_ROLES } from '@/constants/roles';

const isDashboardAdmin = (role: string): boolean =>
  role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;

export const createPlaylist = asyncHandler(async (req, res: Response) => {
  const payload = req.body as CreatePlaylistInput;
  const playlist = await playlistService.createPlaylist(req.user!.id, payload);
  res.status(201).json(new ApiResponse('Playlist created', { playlist }));
});

export const updatePlaylist = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  const payload = req.body as UpdatePlaylistInput;
  const playlist = await playlistService.updatePlaylist(
    id,
    req.user!.id,
    isDashboardAdmin(req.user!.role),
    payload,
  );
  res.status(200).json(new ApiResponse('Playlist updated', { playlist }));
});

export const deletePlaylist = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  await playlistService.deletePlaylist(
    id,
    req.user!.id,
    isDashboardAdmin(req.user!.role),
  );
  res.status(200).json(new ApiResponse('Playlist deleted'));
});

export const getPlaylist = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  const playlist = await playlistService.getPlaylist(id);
  res.status(200).json(new ApiResponse('Playlist fetched', { playlist }));
});

export const uploadCover = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'Cover image is required',
    });
    return;
  }
  const playlist = await playlistService.uploadPlaylistCoverImage(
    id,
    req.user!.id,
    isDashboardAdmin(req.user!.role),
    req.file,
  );
  res.status(200).json(new ApiResponse('Playlist cover uploaded', { playlist }));
});

export const listMyPlaylists = asyncHandler(async (req, res: Response) => {
  const playlists = await playlistService.listMyPlaylists(req.user!.id);
  res.status(200).json(new ApiResponse('My playlists', { playlists }));
});

export const listPublicPlaylists = asyncHandler(async (_req, res: Response) => {
  const playlists = await playlistService.listPublicPlaylists();
  res.status(200).json(new ApiResponse('Public playlists', { playlists }));
});

export const recordPublicPlaylistView = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  await playlistAnalyticsService.recordPlaylistView({
    playlistId: id,
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(200).json(new ApiResponse('Playlist view recorded'));
});

export const addSong = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  const songId = req.params.songId!;
  const playlist = await playlistService.addSongToPlaylist(
    id,
    songId,
    req.user!.id,
    isDashboardAdmin(req.user!.role),
  );
  res
    .status(200)
    .json(new ApiResponse('Song added to playlist', { playlist }));
});

export const removeSong = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  const songId = req.params.songId!;
  const playlist = await playlistService.removeSongFromPlaylist(
    id,
    songId,
    req.user!.id,
    isDashboardAdmin(req.user!.role),
  );
  res
    .status(200)
    .json(new ApiResponse('Song removed from playlist', { playlist }));
});
