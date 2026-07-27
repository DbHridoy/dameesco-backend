import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as stemService from './stem.service';

export const listStems = asyncHandler(async (req, res: Response) => {
  const result = await stemService.listStemMetadata(
    req.params.id!,
    req.user?.id,
    req.user?.role,
  );
  res.status(200).json(new ApiResponse('Stems fetched', result));
});

export const getStemAssetUrl = asyncHandler(async (req, res: Response) => {
  const asset = await stemService.getAdminStemAssetUrl(
    req.params.id!,
    req.params.stemId!,
  );
  res.status(200).json(new ApiResponse('Stem asset URL generated', asset));
});

export const deleteStem = asyncHandler(async (req, res: Response) => {
  await stemService.deleteStem(req.params.id!, req.params.stemId!);
  res.status(200).json(new ApiResponse('Stem deleted'));
});
