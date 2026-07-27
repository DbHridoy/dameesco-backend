import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as downloadService from './download.service';

export const downloadSong = asyncHandler(async (req, res: Response) => {
  const songId = req.params.songId!;
  const ip = (req.ip || req.headers['x-forwarded-for']?.toString()) ?? '';
  const ua = req.headers['user-agent'] ?? '';
  const result = await downloadService.requestSongDownload(
    req.user!.id,
    songId,
    ip,
    typeof ua === 'string' ? ua : '',
  );
  res
    .status(200)
    .json(new ApiResponse('Download URL generated', result));
});

export const downloadStem = asyncHandler(async (req, res: Response) => {
  const ip = (req.ip || req.headers['x-forwarded-for']?.toString()) ?? '';
  const ua = req.headers['user-agent'] ?? '';
  const result = await downloadService.requestStemDownload(
    req.user!.id,
    req.params.songId!,
    req.params.stemId!,
    ip,
    typeof ua === 'string' ? ua : '',
  );
  res
    .status(200)
    .json(new ApiResponse('Stem download URL generated', result));
});

// Admin
export const listDownloads = asyncHandler(async (req, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const result = await downloadService.listAllDownloads(page, limit);
  res.status(200).json(
    new ApiResponse('Downloads fetched', result.downloads, {
      total: result.total,
      page,
      limit,
    }),
  );
});

export const downloadStats = asyncHandler(async (_req, res: Response) => {
  const stats = await downloadService.getDownloadStats();
  res
    .status(200)
    .json(new ApiResponse('Download stats fetched', stats));
});
