import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as adminService from './admin.service';

export const dashboard = asyncHandler(async (_req, res: Response) => {
  const stats = await adminService.getDashboardStats();
  res
    .status(200)
    .json(new ApiResponse('Dashboard stats fetched', stats));
});

export const songStats = asyncHandler(async (_req, res: Response) => {
  const stats = await adminService.getSongStats();
  res
    .status(200)
    .json(new ApiResponse('Song stats fetched', stats));
});