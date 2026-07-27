import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { FILE_TYPE, FileType } from '@/constants/song-status';

export interface DownloadDocument extends Document {
  user: Types.ObjectId;
  song: Types.ObjectId;
  stem?: Types.ObjectId;
  fileType: FileType;
  userSubscriptionStatusAtDownload: 'free' | 'paid';
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const downloadSchema = new Schema<DownloadDocument, Model<DownloadDocument>>(
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
    stem: {
      type: Schema.Types.ObjectId,
      ref: 'Stem',
      index: true,
    },
    fileType: {
      type: String,
      enum: Object.values(FILE_TYPE),
      required: true,
    },
    userSubscriptionStatusAtDownload: {
      type: String,
      enum: ['free', 'paid'],
      required: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const Download = mongoose.model<DownloadDocument>(
  'Download',
  downloadSchema,
);

export default Download;
