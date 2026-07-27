import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import * as songService from './song.service';
import * as searchAnalyticsService from '@/modules/analytics/search-analytics.service';
import {
  BulkSongStatusInput,
  CreateSongInput,
  ListSongsQueryInput,
  PublishSongInput,
  UpdateSongInput,
} from './song.validation';

export const createSong = asyncHandler(async (req, res: Response) => {
  const payload = req.body as CreateSongInput;
  const song = await songService.createSong(payload, req.user!.id);
  res.status(201).json(new ApiResponse('Song created', { song }));
});

export const updateSong = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  const payload = req.body as UpdateSongInput;
  const song = await songService.updateSong(id, payload);
  res.status(200).json(new ApiResponse('Song updated', { song }));
});

export const deleteSong = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  await songService.deleteSong(id);
  res.status(200).json(new ApiResponse('Song deleted'));
});

export const getSong = asyncHandler(async (req, res: Response) => {
  const idOrSlug = req.params.idOrSlug!;
  const song = await songService.getSongByIdOrSlug(idOrSlug);
  res.status(200).json(new ApiResponse('Song fetched', { song }));
});

export const listSongs = asyncHandler(async (req, res: Response) => {
  const query = req.query as unknown as ListSongsQueryInput;
  // If admin, allow status filter; otherwise force published only
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
    const result = await songService.listPublishedSongs(query);
    res.status(200).json(new ApiResponse('Songs fetched', result.songs, result.meta));
    return;
  }
  const result = await songService.listAllSongsAdmin(query);
  res.status(200).json(new ApiResponse('Songs fetched', result.songs, result.meta));
});

export const searchSongs = asyncHandler(async (req, res: Response) => {
  const { q = '' } = req.query as { q?: string };
  const query = req.query as unknown as ListSongsQueryInput;
  const result = await songService.searchSongs(String(q), query);
  await searchAnalyticsService.recordSearchEvent({
    query: String(q),
    mode: 'catalog',
    source: 'catalog',
    songs: result.songs,
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => undefined);
  res.status(200).json(new ApiResponse('Search results', result.songs, result.meta));
});

export const featuredSongs = asyncHandler(async (req, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const songs = await songService.listFeatured(limit);
  res.status(200).json(new ApiResponse('Featured songs', { songs }));
});

export const getAssetUrl = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  const requestedType = req.query.type;
  const type =
    requestedType === 'download' || requestedType === 'watermarked'
      ? requestedType
      : 'preview';
  const asset = await songService.getAdminSongAssetUrl(id, type);
  res.status(200).json(new ApiResponse('Song asset URL generated', asset));
});

export const getPreviewAssetUrl = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  const asset = await songService.getPublicSongPreviewUrl(id);
  res.status(200).json(new ApiResponse('Song preview URL generated', asset));
});

export const uploadAudio = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'Audio file is required',
    });
    return;
  }
  const song = await songService.uploadAndProcessAudio(id, req.file);
  res
    .status(200)
    .json(new ApiResponse('Audio uploaded and watermark generated', { song }));
});

export const uploadCover = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'Cover image is required',
    });
    return;
  }
  const song = await songService.uploadCoverImage(id, req.file);
  res.status(200).json(new ApiResponse('Cover uploaded', { song }));
});

export const generateWatermark = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  const song = await songService.regenerateWatermark(id);
  res
    .status(200)
    .json(new ApiResponse('Watermark regenerated', { song }));
});

export const generateAiTags = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  const song = await songService.generateAiTags(id);
  res.status(200).json(new ApiResponse('AI tagging queued', { song }));
});

export const publishSong = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  const { status } = req.body as PublishSongInput;
  const song = await songService.setStatus(
    id,
    status === 'published' ? 'PUBLISHED' : 'ARCHIVED',
  );
  res.status(200).json(new ApiResponse(`Song ${status}`, { song }));
});

export const bulkUpdateStatus = asyncHandler(async (req, res: Response) => {
  const payload = req.body as BulkSongStatusInput;
  const result = await songService.bulkSetStatus(payload);
  res
    .status(200)
    .json(new ApiResponse('Track statuses updated', { result }));
});

export const archiveSong = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'songId');
  const song = await songService.setStatus(id, 'ARCHIVED');
  res.status(200).json(new ApiResponse('Song archived', { song }));
});
