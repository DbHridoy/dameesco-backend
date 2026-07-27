import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface StemDocument extends Document {
  song: Types.ObjectId;
  displayName: string;
  type: string;
  originalFilename: string;
  normalizedFilename: string;
  audioKey: string;
  mimeType: string;
  fileSize: number;
  duration: number;
  sortOrder: number;
  uploadedBy: Types.ObjectId;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const stemSchema = new Schema<StemDocument, Model<StemDocument>>(
  {
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    originalFilename: { type: String, required: true, trim: true },
    normalizedFilename: { type: String, required: true, trim: true },
    audioKey: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    duration: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

stemSchema.index({ song: 1, normalizedFilename: 1 }, { unique: true });
stemSchema.index({ song: 1, sortOrder: 1, createdAt: 1 });

const Stem = mongoose.model<StemDocument>('Stem', stemSchema);

export default Stem;
