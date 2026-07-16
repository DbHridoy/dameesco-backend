import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as cyaniteWebhookService from './cyanite-webhook.service';

export const cyanite = asyncHandler(async (req, res: Response) => {
  const result = await cyaniteWebhookService.handleCyaniteWebhook({
    payload: req.body,
    rawBody: req.rawBody,
    signature: req.header('Signature') ?? undefined,
  });

  res.status(200).json(new ApiResponse('Cyanite webhook received', result));
});
