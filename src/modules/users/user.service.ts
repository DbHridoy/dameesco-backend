import bcrypt from 'bcryptjs';
import { FilterQuery } from 'mongoose';
import User, { UserDocument } from './user.model';
import { ApiError } from '@/utils/ApiError';
import env from '@/config/env.config';
import {
  buildPagination,
  buildPaginatedMeta,
  PaginationOptions,
  PaginatedMeta,
} from '@/utils/pagination';
import { USER_STATUS } from '@/constants/user-status';
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLAN,
  SubscriptionStatus,
  SubscriptionPlan,
} from '@/constants/subscription';
import {
  ChangePasswordInput,
  CreateAdminInput,
  ListUsersQueryInput,
  UpdateProfileInput,
  UpdateSubscriptionInput,
} from './user.validation';
import { USER_ROLES } from '@/constants/roles';

const sanitizeUser = (user: UserDocument | null): UserDocument | null => {
  if (!user) return null;
  // Reuse the model's toJSON() via a re-serialization
  return JSON.parse(JSON.stringify(user));
};

export const getUserById = async (id: string): Promise<UserDocument> => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

export const updateProfile = async (
  id: string,
  payload: UpdateProfileInput,
): Promise<UserDocument> => {
  const user = await User.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

export const changePassword = async (
  id: string,
  payload: ChangePasswordInput,
): Promise<void> => {
  const user = await User.findById(id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await bcrypt.compare(payload.oldPassword, user.password);
  if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

  user.password = await bcrypt.hash(payload.newPassword, env.BCRYPT_SALT_ROUNDS);
  await user.save();
};

export const createAdmin = async (
  payload: CreateAdminInput,
): Promise<UserDocument> => {
  const email = payload.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'Email is already registered');
  }

  const hashed = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);
  const user = await User.create({
    name: payload.name,
    email,
    password: hashed,
    phone: payload.phone,
    role: USER_ROLES.ADMIN,
    emailVerified: true,
  });

  return sanitizeUser(user) as UserDocument;
};

export const updateUserStatus = async (
  id: string,
  status: 'active' | 'blocked',
): Promise<UserDocument> => {
  const user = await User.findByIdAndUpdate(id, { status }, { new: true });
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

export const updateSubscription = async (
  id: string,
  payload: UpdateSubscriptionInput,
): Promise<UserDocument> => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');

  user.subscriptionStatus = payload.subscriptionStatus as SubscriptionStatus;
  user.subscriptionPlan = payload.subscriptionPlan as SubscriptionPlan;
  if (payload.paidAccessStartsAt) {
    user.paidAccessStartsAt = new Date(payload.paidAccessStartsAt);
  }
  if (payload.paidAccessEndsAt) {
    user.paidAccessEndsAt = new Date(payload.paidAccessEndsAt);
  }
  if (payload.downloadLimit !== undefined) {
    user.downloadLimit = payload.downloadLimit;
  }
  if (payload.subscriptionStatus === SUBSCRIPTION_STATUS.FREE) {
    user.paidAccessEndsAt = null;
    user.subscriptionPlan = SUBSCRIPTION_PLAN.FREE;
  }
  await user.save();
  return user;
};

export const listUsers = async (
  query: ListUsersQueryInput,
): Promise<{ users: UserDocument[]; meta: PaginatedMeta }> => {
  const filter: FilterQuery<UserDocument> = {};
  if (query.search) {
    const search = String(query.search).trim();
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.subscriptionStatus) {
    filter.subscriptionStatus = query.subscriptionStatus;
  }

  const pagination: PaginationOptions = {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy ?? 'createdAt',
    sortOrder: query.sortOrder ?? 'desc',
  };
  const { page, limit, skip, sort } = buildPagination(pagination, [
    'createdAt',
    'name',
    'email',
    'downloadsUsed',
  ]);

  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    users: users.map((u) => sanitizeUser(u) as UserDocument),
    meta: buildPaginatedMeta(page, limit, total),
  };
};

export const getActiveUserOrThrow = async (
  id: string,
): Promise<UserDocument> => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.status === USER_STATUS.BLOCKED) {
    throw new ApiError(403, 'Your account is blocked');
  }
  return user;
};

export const incrementDownloadsUsed = async (
  userId: string,
): Promise<void> => {
  await User.findByIdAndUpdate(userId, { $inc: { downloadsUsed: 1 } });
};
