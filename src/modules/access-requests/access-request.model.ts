import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestStatus,
} from '@/constants/license-status';
import { SUBSCRIPTION_PLAN, SubscriptionPlan } from '@/constants/subscription';

export interface AccessRequestDocument extends Document {
  user: Types.ObjectId;
  requestedPlan: SubscriptionPlan;
  paymentMethod: string;
  transactionReference?: string;
  paymentProofUrl?: string;
  paymentProofKey?: string;
  message?: string;
  status: AccessRequestStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const accessRequestSchema = new Schema<
  AccessRequestDocument,
  Model<AccessRequestDocument>
>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestedPlan: {
      type: String,
      enum: [
        SUBSCRIPTION_PLAN.STANDARD,
        SUBSCRIPTION_PLAN.PREMIUM,
        SUBSCRIPTION_PLAN.CUSTOM,
      ],
      required: true,
    },
    paymentMethod: { type: String, required: true, trim: true, maxlength: 80 },
    transactionReference: { type: String, trim: true, maxlength: 200 },
    paymentProofUrl: { type: String },
    paymentProofKey: { type: String },
    message: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(ACCESS_REQUEST_STATUS),
      default: ACCESS_REQUEST_STATUS.PENDING,
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    adminNote: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

const AccessRequest = mongoose.model<AccessRequestDocument>(
  'AccessRequest',
  accessRequestSchema,
);

export default AccessRequest;