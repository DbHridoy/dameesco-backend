import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import * as accessService from './access-request.service';
import {
  CreateAccessRequestInput,
  DecideAccessRequestInput,
} from './access-request.validation';

export const createRequest = asyncHandler(async (req, res: Response) => {
  const payload = req.body as CreateAccessRequestInput;
  const request = await accessService.createAccessRequest(
    req.user!.id,
    payload,
    req.file,
  );
  res
    .status(201)
    .json(new ApiResponse('Access request submitted', { request }));
});

export const listMyRequests = asyncHandler(async (req, res: Response) => {
  const requests = await accessService.listMyRequests(req.user!.id);
  res
    .status(200)
    .json(new ApiResponse('My access requests', { requests }));
});

export const listAllRequests = asyncHandler(async (req, res: Response) => {
  const status = req.query.status as string | undefined;
  const requests = await accessService.listAllRequests(status);
  res
    .status(200)
    .json(new ApiResponse('All access requests', { requests }));
});

export const approveRequest = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'requestId');
  const payload = req.body as DecideAccessRequestInput;
  const request = await accessService.decideRequest(
    id,
    req.user!.id,
    'approved',
    payload,
  );
  res
    .status(200)
    .json(new ApiResponse('Access request approved', { request }));
});

export const rejectRequest = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'requestId');
  const payload = req.body as DecideAccessRequestInput;
  const request = await accessService.decideRequest(
    id,
    req.user!.id,
    'rejected',
    payload,
  );
  res
    .status(200)
    .json(new ApiResponse('Access request rejected', { request }));
});