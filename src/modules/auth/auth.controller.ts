import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import * as authService from './auth.service';
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.validation';

export const register = asyncHandler(async (req, res: Response) => {
  const payload = req.body as RegisterInput;
  const { user, tokens } = await authService.register(payload);
  res
    .status(201)
    .json(
      new ApiResponse('Registration successful', { user, ...tokens }),
    );
});

export const login = asyncHandler(async (req, res: Response) => {
  const payload = req.body as LoginInput;
  const { user, tokens } = await authService.login(payload);
  res
    .status(200)
    .json(new ApiResponse('Login successful', { user, ...tokens }));
});

export const getMe = asyncHandler(async (req, res: Response) => {
  const userId = req.user!.id;
  ensureValidObjectId(userId, 'userId');
  const user = await authService.getMe(userId);
  res.status(200).json(new ApiResponse('Current user', { user }));
});

export const forgotPassword = asyncHandler(async (req, res: Response) => {
  const payload = req.body as ForgotPasswordInput;
  await authService.forgotPassword(payload);
  res
    .status(200)
    .json(
      new ApiResponse(
        'If that email exists, a reset code has been sent.',
      ),
    );
});

export const resetPassword = asyncHandler(async (req, res: Response) => {
  const payload = req.body as ResetPasswordInput;
  await authService.resetPassword(payload);
  res
    .status(200)
    .json(new ApiResponse('Password reset successful'));
});

export const changePassword = asyncHandler(async (req, res: Response) => {
  const userId = req.user!.id;
  ensureValidObjectId(userId, 'userId');
  const payload = req.body as ChangePasswordInput;
  await authService.changePassword(userId, payload);
  res
    .status(200)
    .json(new ApiResponse('Password changed successfully'));
});