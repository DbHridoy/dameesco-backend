import Notification, { NotificationDocument } from './notification.model';
import { NotificationType } from '@/constants/license-status';
import { Types } from 'mongoose';
import { USER_ROLES } from '@/constants/roles';
import { USER_STATUS } from '@/constants/user-status';
import User from '@/modules/users/user.model';

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

export const createAdminNotifications = async (
  payload: Omit<CreateNotificationInput, 'userId'>,
): Promise<void> => {
  const admins = await User.find({
    role: { $in: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN] },
    status: USER_STATUS.ACTIVE,
  }).select('_id');

  if (!admins.length) return;

  await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      metadata: payload.metadata,
    })),
    { ordered: false },
  );
};

export const listForUser = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  notifications: NotificationDocument[];
  total: number;
  unread: number;
}> => {
  const skip = (page - 1) * limit;
  const [notifications, total, unread] = await Promise.all([
    Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);
  return { notifications, total, unread };
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
