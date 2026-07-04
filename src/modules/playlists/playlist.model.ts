import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PlaylistDocument extends Document {
  user: Types.ObjectId;
  name: string;
  description?: string;
  songs: Types.ObjectId[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const playlistSchema = new Schema<PlaylistDocument, Model<PlaylistDocument>>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    songs: [{ type: Schema.Types.ObjectId, ref: 'Song' }],
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Playlist = mongoose.model<PlaylistDocument>(
  'Playlist',
  playlistSchema,
);

export default Playlist;