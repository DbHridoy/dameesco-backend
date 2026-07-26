import mongoose from 'mongoose';
import Song from '@/modules/songs/song.model';
import User from '@/modules/users/user.model';
import LicenseRequest, {
  LicenseRequestDocument,
} from './license-request.model';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import {
  CreateLicenseRequestInput,
  UpdateLicenseStatusInput,
} from './license-request.validation';
import {
  sendAdminLicenseSubmittedEmail,
  sendLicenseSubmittedEmail,
  sendLicenseStatusEmail,
} from '@/email/email.service';
import env from '@/config/env.config';
import { LICENSE_STATUS } from '@/constants/license-status';

export const createLicenseRequest = async (
  userId: string,
  payload: CreateLicenseRequestInput,
): Promise<LicenseRequestDocument> => {
  ensureValidObjectId(payload.song, 'songId');

  const [user, song] = await Promise.all([
    User.findById(userId),
    Song.findById(payload.song),
  ]);
  if (!user) throw new ApiError(404, 'User not found');
  if (!song) throw new ApiError(404, 'Song not found');

  const request = await LicenseRequest.create({
    user: user._id,
    song: song._id,
    fullName: payload.fullName,
    email: payload.email,
    companyName: payload.companyName,
    projectName: payload.projectName,
    usageType: payload.usageType,
    usageDescription: payload.usageDescription,
    budget: payload.budget,
    message: payload.message,
  });

  await sendLicenseSubmittedEmail({
    to: user.email,
    subject: 'We received your license request',
    name: user.name,
    songTitle: song.title,
    requestId: request._id.toString(),
  });

  await sendAdminLicenseSubmittedEmail({
    to: env.LICENSE_ADMIN_EMAIL || env.ADMIN_EMAIL,
    subject: `New license request: ${song.title}`,
    requestId: request._id.toString(),
    requesterName: payload.fullName || user.name,
    requesterEmail: payload.email || user.email,
    songTitle: song.title,
    songArtist: song.artist,
    companyName: payload.companyName,
    projectName: payload.projectName,
    usageType: payload.usageType,
    usageDescription: payload.usageDescription,
    budget: payload.budget,
    message: payload.message,
  });

  return request;
};

export const listMyRequests = async (
  userId: string,
): Promise<LicenseRequestDocument[]> => {
  return LicenseRequest.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate('song', 'title artist');
};

export const listAllRequests = async (
  status?: string,
): Promise<LicenseRequestDocument[]> => {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  return LicenseRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email')
    .populate('song', 'title artist');
};

export const getRequest = async (
  id: string,
): Promise<LicenseRequestDocument> => {
  ensureValidObjectId(id, 'requestId');
  const request = await LicenseRequest.findById(id)
    .populate('user', 'name email')
    .populate('song', 'title artist');
  if (!request) throw new ApiError(404, 'License request not found');
  return request;
};

export const updateStatus = async (
  id: string,
  reviewerId: string,
  payload: UpdateLicenseStatusInput,
): Promise<LicenseRequestDocument> => {
  ensureValidObjectId(id, 'requestId');
  const request = await LicenseRequest.findById(id).populate(
    'song',
    'title',
  );
  if (!request) throw new ApiError(404, 'License request not found');

  request.status = payload.status;
  request.adminNote = payload.adminNote;
  request.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
  request.reviewedAt = new Date();
  await request.save();

  const user = await User.findById(request.user);
  if (user) {
    await sendLicenseStatusEmail({
      to: user.email,
      subject: `License request ${payload.status.replace('_', ' ')}`,
      name: user.name,
      songTitle:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (request.song as any)?.title ?? 'your song',
      status: payload.status as 'approved' | 'rejected' | 'in_review',
      adminNote: payload.adminNote,
    });
  }

  return request;
};

void LICENSE_STATUS;
