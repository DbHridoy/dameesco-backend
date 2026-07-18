import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as videoSyncService from './video-sync.service';

export const renderPreview = asyncHandler(async (req, res: Response) => {
  const result = await videoSyncService.renderVideoPreview({
    userId: req.user!.id,
    songId: req.body.songId,
    videoFile: req.file,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res
    .status(200)
    .json(new ApiResponse('Video preview generated', result));
});
