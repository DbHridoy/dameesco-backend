import Notification, { NotificationDocument } from './notification.model';
import { NotificationType } from '@/constants/license-status';
import { Types } from 'mongoose';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
}

export const createNotification = async (
  payload: CreateNotificationInput,
): Promise<NotificationDocument> => {
  return Notification.create({
    user: new Types.ObjectId(payload.userId),
    title: payload.title,
    message: payload.message,
    type: payload.type,
    metadata: payload.metadata,
  });
};

export const listForUser = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ notifications: NotificationDocument[]; total: number }> => {
  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ user: userId }),
  ]);
  return { notifications, total };
};

export const markAsRead = async (
  id: string,
  userId: string,
): Promise<NotificationDocument | null> => {
  return Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { isRead: true },
    { new: true },
  );
};

export const markAllAsRead = async (
  userId: string,
): Promise<number> => {
  const res = await Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true },
  );
  return res.modifiedCount ?? 0;
};