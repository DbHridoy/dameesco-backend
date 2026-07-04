import bcrypt from 'bcrypt';
import User, { UserDocument } from '@/modules/users/user.model';
import { ApiError } from '@/utils/ApiError';
import env from '@/config/env.config';
import {
  generateAccessToken,
  generateRefreshToken,
} from '@/utils/generateToken';
import { generateOtp } from '@/utils/generateOtp';
import { USER_STATUS } from '@/constants/user-status';
import { USER_ROLES } from '@/constants/roles';
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.validation';
import { sendPasswordResetEmail } from '@/email/email.service';

const OTP_EXPIRY_MINUTES = 10;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const buildTokens = (user: UserDocument): AuthTokens => {
  return {
    accessToken: generateAccessToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    }),
    refreshToken: generateRefreshToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    }),
  };
};

export const register = async (
  payload: RegisterInput,
): Promise<{ user: UserDocument; tokens: AuthTokens }> => {
  const existing = await User.findOne({
    email: payload.email.toLowerCase().trim(),
  });
  if (existing) {
    throw new ApiError(409, 'Email is already registered');
  }
  const hashed = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);
  const user = await User.create({
    name: payload.name,
    email: payload.email.toLowerCase().trim(),
    password: hashed,
    phone: payload.phone,
    role: USER_ROLES.USER,
  });
  const tokens = buildTokens(user);
  return { user, tokens };
};

export const login = async (
  payload: LoginInput,
): Promise<{ user: UserDocument; tokens: AuthTokens }> => {
  const user = await User.findOne({
    email: payload.email.toLowerCase().trim(),
  }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password');
  if (user.status === USER_STATUS.BLOCKED) {
    throw new ApiError(403, 'Your account is blocked. Contact support.');
  }
  const ok = await bcrypt.compare(payload.password, user.password);
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  const tokens = buildTokens(user);
  return { user, tokens };
};

export const getMe = async (userId: string): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

export const forgotPassword = async (
  payload: ForgotPasswordInput,
): Promise<void> => {
  const user = await User.findOne({
    email: payload.email.toLowerCase().trim(),
  }).select('+passwordResetOtp +passwordResetOtpExpiresAt');
  // Always respond success to avoid email enumeration.
  if (!user) return;

  const otp = generateOtp(6);
  user.passwordResetOtp = otp;
  user.passwordResetOtpExpiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
  );
  await user.save();

  await sendPasswordResetEmail({
    to: user.email,
    subject: 'Reset your Dameesco password',
    name: user.name,
    otp,
    expiryMinutes: OTP_EXPIRY_MINUTES,
  });
};

export const resetPassword = async (
  payload: ResetPasswordInput,
): Promise<void> => {
  const user = await User.findOne({
    email: payload.email.toLowerCase().trim(),
  }).select('+password +passwordResetOtp +passwordResetOtpExpiresAt');
  if (!user) throw new ApiError(400, 'Invalid reset request');

  if (
    !user.passwordResetOtp ||
    !user.passwordResetOtpExpiresAt ||
    user.passwordResetOtp !== payload.otp
  ) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }
  if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'OTP has expired');
  }

  user.password = await bcrypt.hash(payload.newPassword, env.BCRYPT_SALT_ROUNDS);
  user.passwordResetOtp = null;
  user.passwordResetOtpExpiresAt = null;
  await user.save();
};

export const changePassword = async (
  userId: string,
  payload: ChangePasswordInput,
): Promise<void> => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  const ok = await bcrypt.compare(payload.oldPassword, user.password);
  if (!ok) throw new ApiError(400, 'Current password is incorrect');
  user.password = await bcrypt.hash(payload.newPassword, env.BCRYPT_SALT_ROUNDS);
  await user.save();
};