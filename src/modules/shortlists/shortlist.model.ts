import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const SHORTLIST_MEMBER_ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
} as const;

export type ShortlistMemberRole =
  (typeof SHORTLIST_MEMBER_ROLES)[keyof typeof SHORTLIST_MEMBER_ROLES];

export const SHORTLIST_KINDS = {
  PERSONAL: 'personal',
  TEAM: 'team',
} as const;

export type ShortlistKind =
  (typeof SHORTLIST_KINDS)[keyof typeof SHORTLIST_KINDS];

export interface ShortlistMember {
  user: Types.ObjectId;
  role: ShortlistMemberRole;
  joinedAt: Date;
}

export interface ShortlistDocument extends Document {
  owner: Types.ObjectId;
  kind: ShortlistKind;
  name: string;
  description?: string;
  songs: Types.ObjectId[];
  members: ShortlistMember[];
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<ShortlistMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: Object.values(SHORTLIST_MEMBER_ROLES),
      required: true,
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const shortlistSchema = new Schema<
  ShortlistDocument,
  Model<ShortlistDocument>
>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: Object.values(SHORTLIST_KINDS),
      default: SHORTLIST_KINDS.PERSONAL,
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    songs: [{ type: Schema.Types.ObjectId, ref: 'Song' }],
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

shortlistSchema.index({ 'members.user': 1 });

const Shortlist = mongoose.model<ShortlistDocument>(
  'Shortlist',
  shortlistSchema,
);

export default Shortlist;
