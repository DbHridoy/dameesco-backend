import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import * as licenseService from './license-request.service';
import {
  CreateLicenseRequestInput,
  UpdateLicenseStatusInput,
} from './license-request.validation';

export const createRequest = asyncHandler(async (req, res: Response) => {
  const payload = req.body as CreateLicenseRequestInput;
  const request = await licenseService.createLicenseRequest(
    req.user!.id,
    payload,
  );
  res
    .status(201)
    .json(new ApiResponse('License request submitted', { request }));
});

export const listMyRequests = asyncHandler(async (req, res: Response) => {
  const requests = await licenseService.listMyRequests(req.user!.id);
  res
    .status(200)
    .json(new ApiResponse('My license requests', { requests }));
});

export const listAllRequests = asyncHandler(async (req, res: Response) => {
  const status = req.query.status as string | undefined;
  const requests = await licenseService.listAllRequests(status);
  res
    .status(200)
    .json(new ApiResponse('All license requests', { requests }));
});

export const getRequest = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'requestId');
  const request = await licenseService.getRequest(id);
  res
    .status(200)
    .json(new ApiResponse('License request fetched', { request }));
});

export const updateStatus = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'requestId');
  const payload = req.body as UpdateLicenseStatusInput;
  const request = await licenseService.updateStatus(
    id,
    req.user!.id,
    payload,
  );
  res
    .status(200)
    .json(new ApiResponse('License request updated', { request }));
});