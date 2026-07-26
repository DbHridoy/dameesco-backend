import fs from 'fs';
import mongoose from 'mongoose';
import { AccessRequestDocument } from './access-request.model';
import AccessRequest from './access-request.model';
import User from '@/modules/users/user.model';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import {
  buildS3Key,
  uploadFile,
  deleteFile,
  isS3Configured,
  getPublicUrl,
} from '@/storage/s3.service';
import {
  CreateAccessRequestInput,
  DecideAccessRequestInput,
} from './access-request.validation';
import {
  sendAccessRequestDecisionEmail,
  sendAccessRequestSubmittedEmail,
} from '@/email/email.service';
import {
  ACCESS_REQUEST_STATUS,
  NOTIFICATION_TYPE,
} from '@/constants/license-status';
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLAN,
  SubscriptionPlan,
} from '@/constants/subscription';
import {
  createAdminNotifications,
  createNotification,
} from '@/modules/notifications/notification.service';

export const createAccessRequest = async (
  userId: string,
  payload: CreateAccessRequestInput,
  file: Express.Multer.File | undefined,
): Promise<AccessRequestDocument> => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.subscriptionStatus === SUBSCRIPTION_STATUS.PAID) {
    throw new ApiError(400, 'You already have paid access');
  }

  const pendingRequest = await AccessRequest.findOne({
    user: user._id,
    status: ACCESS_REQUEST_STATUS.PENDING,
  });
  if (pendingRequest) {
    throw new ApiError(409, 'You already have a pending subscription request');
  }

  let paymentProofKey: string | undefined;
  let paymentProofUrl: string | undefined;

  if (file) {
    if (!isS3Configured()) {
      throw new ApiError(500, 'S3 storage is not configured');
    }
    const key = buildS3Key('payment-proofs', file.originalname);
    const uploaded = await uploadFile({
      key,
      body: fs.readFileSync(file.path),
      contentType: file.mimetype,
      isPublic: false,
    });
    paymentProofKey = uploaded.key;
    paymentProofUrl = await getPublicUrl(key);
    fs.unlink(file.path, () => undefined);
  }

  const request = await AccessRequest.create({
    user: user._id,
    requestedPlan: payload.requestedPlan,
    paymentMethod: payload.paymentMethod,
    transactionReference: payload.transactionReference,
    message: payload.message,
    paymentProofKey,
    paymentProofUrl,
  });

  await sendAccessRequestSubmittedEmail({
    to: user.email,
    subject: 'We received your paid access request',
    name: user.name,
    requestedPlan: payload.requestedPlan,
  });

  await createAdminNotifications({
    title: 'New paid access request',
    message: `${user.name} requested the ${payload.requestedPlan} plan.`,
    type: NOTIFICATION_TYPE.ACCESS_SUBMITTED,
    metadata: {
      requestId: request._id.toString(),
      userId: user._id.toString(),
      requestedPlan: payload.requestedPlan,
    },
  });

  return request;
};

export const listMyRequests = async (
  userId: string,
): Promise<AccessRequestDocument[]> => {
  return AccessRequest.find({ user: userId }).sort({ createdAt: -1 });
};

export const listAllRequests = async (
  status?: string,
): Promise<AccessRequestDocument[]> => {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  return AccessRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email subscriptionStatus');
};

export const decideRequest = async (
  id: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
  payload: DecideAccessRequestInput,
): Promise<AccessRequestDocument> => {
  ensureValidObjectId(id, 'requestId');
  const request = await AccessRequest.findById(id);
  if (!request) throw new ApiError(404, 'Access request not found');
  if (request.status !== ACCESS_REQUEST_STATUS.PENDING) {
    throw new ApiError(400, 'This request has already been decided');
  }

  request.status =
    decision === 'approved'
      ? ACCESS_REQUEST_STATUS.APPROVED
      : ACCESS_REQUEST_STATUS.REJECTED;
  request.adminNote = payload.adminNote;
  request.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
  request.reviewedAt = new Date();
  await request.save();

  const user = await User.findById(request.user);
  if (!user) throw new ApiError(404, 'User not found');

  if (decision === 'approved') {
    user.subscriptionStatus = SUBSCRIPTION_STATUS.PAID;
    user.subscriptionPlan =
      (payload.subscriptionPlan as SubscriptionPlan) ??
      (request.requestedPlan as SubscriptionPlan);
    if (payload.paidAccessStartsAt) {
      user.paidAccessStartsAt = new Date(payload.paidAccessStartsAt);
    } else {
      user.paidAccessStartsAt = new Date();
    }
    if (payload.paidAccessEndsAt) {
      user.paidAccessEndsAt = new Date(payload.paidAccessEndsAt);
    } else {
      const oneMonth = new Date();
      oneMonth.setMonth(oneMonth.getMonth() + 1);
      user.paidAccessEndsAt = oneMonth;
    }
    if (payload.downloadLimit !== undefined) {
      user.downloadLimit = payload.downloadLimit;
    } else {
      // Sensible defaults by plan
      if (user.subscriptionPlan === SUBSCRIPTION_PLAN.PREMIUM) {
        user.downloadLimit = 500;
      } else if (user.subscriptionPlan === SUBSCRIPTION_PLAN.STANDARD) {
        user.downloadLimit = 100;
      } else {
        user.downloadLimit = 50;
      }
    }
    await user.save();
  }

  await sendAccessRequestDecisionEmail({
    to: user.email,
    subject: `Access request ${decision}`,
    name: user.name,
    requestedPlan: request.requestedPlan,
    decision,
    adminNote: payload.adminNote,
  });

  await createNotification({
    userId: user._id.toString(),
    title: `Paid access request ${decision}`,
    message:
      decision === 'approved'
        ? `Your ${request.requestedPlan} access request has been approved.`
        : `Your ${request.requestedPlan} access request has been rejected.`,
    type: NOTIFICATION_TYPE.ACCESS_UPDATED,
    metadata: {
      requestId: request._id.toString(),
      requestedPlan: request.requestedPlan,
      decision,
    },
  });

  // Best-effort cleanup of payment proof on reject if you want to; kept here.
  if (decision === 'rejected' && request.paymentProofKey) {
    await deleteFile(request.paymentProofKey).catch(() => undefined);
  }

  return request;
};

void AccessRequest;
