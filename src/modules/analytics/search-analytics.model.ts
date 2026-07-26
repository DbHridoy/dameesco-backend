import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface SearchAnalyticsDocument extends Document {
  query: string;
  normalizedQuery: string;
  mode: 'catalog' | 'text' | 'spotify' | 'youtube';
  source: 'catalog' | 'cyanite' | 'local-fallback';
  resultCount: number;
  matchedSongs: Types.ObjectId[];
  genres: string[];
  moods: string[];
  user?: Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const searchAnalyticsSchema = new Schema<
  SearchAnalyticsDocument,
  Model<SearchAnalyticsDocument>
>(
  {
    query: { type: String, required: true, trim: true, maxlength: 1024 },
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ['catalog', 'text', 'spotify', 'youtube'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['catalog', 'cyanite', 'local-fallback'],
      required: true,
      index: true,
    },
    resultCount: { type: Number, required: true, min: 0 },
    matchedSongs: [{ type: Schema.Types.ObjectId, ref: 'Song' }],
    genres: { type: [String], default: [], index: true },
    moods: { type: [String], default: [], index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

searchAnalyticsSchema.index({ createdAt: -1 });

const SearchAnalytics = mongoose.model<SearchAnalyticsDocument>(
  'SearchAnalytics',
  searchAnalyticsSchema,
);

export default SearchAnalytics;
