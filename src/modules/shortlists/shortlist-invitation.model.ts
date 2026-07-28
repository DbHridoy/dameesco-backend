import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { ShortlistMemberRole } from './shortlist.model';

export const INVITATION_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
} as const;

export type InvitationStatus =
  (typeof INVITATION_STATUSES)[keyof typeof INVITATION_STATUSES];

export interface ShortlistInvitationDocument extends Document {
  shortlist: Types.ObjectId;
  inviter: Types.ObjectId;
  email: string;
  role: ShortlistMemberRole;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedBy?: Types.ObjectId;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<
  ShortlistInvitationDocument,
  Model<ShortlistInvitationDocument>
>(
  {
    shortlist: {
      type: Schema.Types.ObjectId,
      ref: 'Shortlist',
      required: true,
      index: true,
    },
    inviter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['viewer', 'editor'],
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: Object.values(INVITATION_STATUSES),
      default: INVITATION_STATUSES.PENDING,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: { type: Date },
  },
  { timestamps: true },
);

invitationSchema.index(
  { shortlist: 1, email: 1, status: 1 },
  { partialFilterExpression: { status: 'pending' } },
);

const ShortlistInvitation = mongoose.model<ShortlistInvitationDocument>(
  'ShortlistInvitation',
  invitationSchema,
);

export default ShortlistInvitation;
