import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { SONG_STATUS, SongStatus } from '@/constants/song-status';

export interface SongDocument extends Document {
  title: string;
  slug: string;
  artist: string;
  album?: string;
  description?: string;
  genre?: string;
  mood?: string;
  tags: string[];
  bpm?: number;
  key?: string;
  duration: number;
  language?: string;
  releaseDate?: Date;
  coverImageKey?: string;
  coverImageUrl?: string;
  originalAudioKey?: string;
  originalAudioUrl?: string;
  watermarkedAudioKey?: string;
  watermarkedAudioUrl?: string;
  previewAudioKey?: string;
  previewAudioUrl?: string;
  cyaniteLibraryTrackId?: string;
  cyaniteAnalysisStatus?: 'not_started' | 'pending' | 'finished' | 'failed';
  cyaniteRawAnalysis?: Record<string, unknown>;
  fileType?: string;
  fileSize?: number;
  isFeatured: boolean;
  isDownloadable: boolean;
  status: SongStatus;
  uploadedBy: Types.ObjectId;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<SongDocument, Model<SongDocument>>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    artist: { type: String, required: true, trim: true, index: true },
    album: { type: String, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 2000 },
    genre: { type: String, trim: true, index: true },
    mood: { type: String, trim: true, index: true },
    tags: { type: [String], default: [], index: true },
    bpm: { type: Number },
    key: { type: String, trim: true },
    duration: { type: Number, default: 0 },
    language: { type: String, trim: true },
    releaseDate: { type: Date },
    coverImageKey: { type: String },
    coverImageUrl: { type: String },
    originalAudioKey: { type: String },
    originalAudioUrl: { type: String },
    watermarkedAudioKey: { type: String },
    watermarkedAudioUrl: { type: String },
    previewAudioKey: { type: String },
    previewAudioUrl: { type: String },
    cyaniteLibraryTrackId: { type: String, index: true },
    cyaniteAnalysisStatus: {
      type: String,
      enum: ['not_started', 'pending', 'finished', 'failed'],
      default: 'not_started',
      index: true,
    },
    cyaniteRawAnalysis: { type: Schema.Types.Mixed },
    fileType: { type: String },
    fileSize: { type: Number },
    isFeatured: { type: Boolean, default: false },
    isDownloadable: { type: Boolean, default: true },
    status: {
      type: String,
      enum: Object.values(SONG_STATUS),
      default: SONG_STATUS.DRAFT,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

songSchema.index({
  title: 'text',
  artist: 'text',
  album: 'text',
  genre: 'text',
  mood: 'text',
  tags: 'text',
}, {
  default_language: 'none',
  language_override: 'textSearchLanguage',
});

const Song = mongoose.model<SongDocument>('Song', songSchema);

export const ensureSongTextIndex = async (): Promise<void> => {
  const indexes = await Song.collection.indexes();
  const textIndex = indexes.find((index) =>
    Object.values(index.key ?? {}).includes('text'),
  );

  if (
    textIndex?.name &&
    textIndex.language_override !== 'textSearchLanguage'
  ) {
    await Song.collection.dropIndex(textIndex.name);
  }

  await Song.createIndexes();
};

export default Song;
