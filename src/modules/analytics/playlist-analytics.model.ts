import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface PlaylistAnalyticsDocument extends Document {
  playlist: Types.ObjectId;
  user?: Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const playlistAnalyticsSchema = new Schema<
  PlaylistAnalyticsDocument,
  Model<PlaylistAnalyticsDocument>
>(
  {
    playlist: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
      index: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

playlistAnalyticsSchema.index({ createdAt: -1 });

const PlaylistAnalytics = mongoose.model<PlaylistAnalyticsDocument>(
  'PlaylistAnalytics',
  playlistAnalyticsSchema,
);

export default PlaylistAnalytics;
