import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PlaylistDocument extends Document {
  user: Types.ObjectId;
  name: string;
  description?: string;
  theme?: string;
  genre?: string;
  mood?: string;
  coverImageKey?: string;
  coverImageUrl?: string;
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
    theme: { type: String, trim: true, maxlength: 80, index: true },
    genre: { type: String, trim: true, maxlength: 80, index: true },
    mood: { type: String, trim: true, maxlength: 80, index: true },
    coverImageKey: { type: String },
    coverImageUrl: { type: String },
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
