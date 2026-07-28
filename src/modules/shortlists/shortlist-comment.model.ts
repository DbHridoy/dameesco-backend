import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ShortlistCommentDocument extends Document {
  shortlist: Types.ObjectId;
  author: Types.ObjectId;
  song?: Types.ObjectId;
  body: string;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<
  ShortlistCommentDocument,
  Model<ShortlistCommentDocument>
>(
  {
    shortlist: {
      type: Schema.Types.ObjectId,
      ref: 'Shortlist',
      required: true,
      index: true,
    },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    song: { type: Schema.Types.ObjectId, ref: 'Song', index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    archivedAt: { type: Date, index: true },
  },
  { timestamps: true },
);

commentSchema.index({ shortlist: 1, createdAt: 1 });

const ShortlistComment = mongoose.model<ShortlistCommentDocument>(
  'ShortlistComment',
  commentSchema,
);

export default ShortlistComment;
