import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const BULK_IMPORT_STATUS = {
  VALIDATED: 'validated',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const BULK_IMPORT_ROW_STATUS = {
  VALID: 'valid',
  INVALID: 'invalid',
  SKIPPED: 'skipped',
  IMPORTING: 'importing',
  IMPORTED: 'imported',
  FAILED: 'failed',
} as const;

export type BulkImportStatus =
  (typeof BULK_IMPORT_STATUS)[keyof typeof BULK_IMPORT_STATUS];
export type BulkImportRowStatus =
  (typeof BULK_IMPORT_ROW_STATUS)[keyof typeof BULK_IMPORT_ROW_STATUS];

export interface BulkImportRow {
  rowNumber: number;
  audioFilename: string;
  matchedFilePath?: string;
  title: string;
  artist: string;
  album?: string;
  description?: string;
  genre?: string;
  mood?: string;
  tags: string[];
  bpm?: number;
  key?: string;
  language?: string;
  releaseDate?: Date;
  isDownloadable: boolean;
  status: 'draft' | 'published' | 'archived';
  rowStatus: BulkImportRowStatus;
  errors: string[];
  warnings: string[];
  importedSong?: Types.ObjectId;
  processedAt?: Date;
}

export interface BulkImportJobDocument extends Document {
  createdBy: Types.ObjectId;
  status: BulkImportStatus;
  originalZipName: string;
  originalMetadataName: string;
  zipPath: string;
  metadataPath: string;
  extractDir: string;
  rows: BulkImportRow[];
  unmatchedFiles: string[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    imported: number;
    skipped: number;
    failed: number;
  };
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bulkImportRowSchema = new Schema<BulkImportRow>(
  {
    rowNumber: { type: Number, required: true },
    audioFilename: { type: String, required: true, trim: true },
    matchedFilePath: { type: String },
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    album: { type: String, trim: true },
    description: { type: String, trim: true },
    genre: { type: String, trim: true },
    mood: { type: String, trim: true },
    tags: { type: [String], default: [] },
    bpm: { type: Number },
    key: { type: String, trim: true },
    language: { type: String, trim: true },
    releaseDate: { type: Date },
    isDownloadable: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    rowStatus: {
      type: String,
      enum: Object.values(BULK_IMPORT_ROW_STATUS),
      default: BULK_IMPORT_ROW_STATUS.VALID,
    },
    errors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    importedSong: { type: Schema.Types.ObjectId, ref: 'Song' },
    processedAt: { type: Date },
  },
  { _id: false },
);

const bulkImportJobSchema = new Schema<
  BulkImportJobDocument,
  Model<BulkImportJobDocument>
>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(BULK_IMPORT_STATUS),
      default: BULK_IMPORT_STATUS.VALIDATED,
      index: true,
    },
    originalZipName: { type: String, required: true },
    originalMetadataName: { type: String, required: true },
    zipPath: { type: String, required: true },
    metadataPath: { type: String, required: true },
    extractDir: { type: String, required: true },
    rows: { type: [bulkImportRowSchema], default: [] },
    unmatchedFiles: { type: [String], default: [] },
    summary: {
      total: { type: Number, default: 0 },
      valid: { type: Number, default: 0 },
      invalid: { type: Number, default: 0 },
      warnings: { type: Number, default: 0 },
      imported: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true },
);

const BulkImportJob = mongoose.model<BulkImportJobDocument>(
  'BulkImportJob',
  bulkImportJobSchema,
);

export default BulkImportJob;
