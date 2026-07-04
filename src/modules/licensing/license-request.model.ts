import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { LICENSE_STATUS, LicenseStatus } from '@/constants/license-status';

export interface LicenseRequestDocument extends Document {
  user: Types.ObjectId;
  song: Types.ObjectId;
  fullName: string;
  email: string;
  companyName?: string;
  projectName?: string;
  usageType: string;
  usageDescription?: string;
  budget?: number;
  message?: string;
  status: LicenseStatus;
  adminNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const licenseRequestSchema = new Schema<
  LicenseRequestDocument,
  Model<LicenseRequestDocument>
>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    email: { type: String, required: true, trim: true, lowercase: true },
    companyName: { type: String, trim: true, maxlength: 150 },
    projectName: { type: String, trim: true, maxlength: 150 },
    usageType: { type: String, required: true, trim: true, maxlength: 100 },
    usageDescription: { type: String, trim: true, maxlength: 2000 },
    budget: { type: Number },
    message: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(LICENSE_STATUS),
      default: LICENSE_STATUS.PENDING,
      index: true,
    },
    adminNote: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

const LicenseRequest = mongoose.model<LicenseRequestDocument>(
  'LicenseRequest',
  licenseRequestSchema,
);

export default LicenseRequest;