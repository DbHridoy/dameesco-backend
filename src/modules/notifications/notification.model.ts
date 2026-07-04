import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { NOTIFICATION_TYPE, NotificationType } from '@/constants/license-status';

export interface NotificationDocument extends Document {
  user: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<
  NotificationDocument,
  Model<NotificationDocument>
>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      default: NOTIFICATION_TYPE.SYSTEM,
    },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const Notification = mongoose.model<NotificationDocument>(
  'Notification',
  notificationSchema,
);

export default Notification;