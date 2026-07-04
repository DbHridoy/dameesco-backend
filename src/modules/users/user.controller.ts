import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import * as userService from './user.service';
import {
  ChangePasswordInput,
  ListUsersQueryInput,
  UpdateProfileInput,
  UpdateSubscriptionInput,
  UpdateUserStatusInput,
} from './user.validation';

export const getMe = asyncHandler(async (req, res: Response) => {
  const userId = req.user!.id;
  ensureValidObjectId(userId, 'userId');
  const user = await userService.getUserById(userId);
  res
    .status(200)
    .json(new ApiResponse('Current user fetched', { user }));
});

export const updateMe = asyncHandler(async (req, res: Response) => {
  const userId = req.user!.id;
  ensureValidObjectId(userId, 'userId');
  const payload = req.body as UpdateProfileInput;
  const user = await userService.updateProfile(userId, payload);
  res.status(200).json(new ApiResponse('Profile updated', { user }));
});

export const changePassword = asyncHandler(async (req, res: Response) => {
  const userId = req.user!.id;
  ensureValidObjectId(userId, 'userId');
  const payload = req.body as ChangePasswordInput;
  await userService.changePassword(userId, payload);
  res
    .status(200)
    .json(new ApiResponse('Password changed successfully'));
});

// Admin endpoints

export const listUsers = asyncHandler(async (req, res: Response) => {
  const query = req.query as unknown as ListUsersQueryInput;
  const result = await userService.listUsers(query);
  res
    .status(200)
    .json(new ApiResponse('Users fetched', result.users, result.meta));
});

export const getUser = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'userId');
  const user = await userService.getUserById(id);
  res.status(200).json(new ApiResponse('User fetched', { user }));
});

export const updateUserStatus = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'userId');
  const { status } = req.body as UpdateUserStatusInput;
  const user = await userService.updateUserStatus(id, status);
  res
    .status(200)
    .json(new ApiResponse(`User ${status}`, { user }));
});

export const updateSubscription = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'userId');
  const payload = req.body as UpdateSubscriptionInput;
  const user = await userService.updateSubscription(id, payload);
  res
    .status(200)
    .json(new ApiResponse('Subscription updated', { user }));
});