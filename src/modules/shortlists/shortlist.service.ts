import crypto from 'crypto';
import { Types } from 'mongoose';
import env from '@/config/env.config';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import Song from '@/modules/songs/song.model';
import User from '@/modules/users/user.model';
import * as notificationService from '@/modules/notifications/notification.service';
import { NOTIFICATION_TYPE } from '@/constants/license-status';
import { sendShortlistInvitationEmail } from '@/email/email.service';
import Shortlist, {
  SHORTLIST_KINDS,
  SHORTLIST_MEMBER_ROLES,
  ShortlistDocument,
  ShortlistMemberRole,
} from './shortlist.model';
import ShortlistInvitation, {
  INVITATION_STATUSES,
} from './shortlist-invitation.model';
import ShortlistComment from './shortlist-comment.model';
import {
  CreateShortlistInput,
  UpdateShortlistInput,
} from './shortlist.validation';
import {
  canDeleteComment,
  canEditComment,
  hasActivePaidAccess,
  normalizeInviteEmail,
  shortlistCapabilities,
  ShortlistAccessRole,
} from './shortlist.policy';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const songSelect =
  'title slug artist genre mood duration bpm key previewAudioUrl watermarkedAudioUrl originalAudioUrl isDownloadable status';
const userSelect = 'name email avatar';

type PopulatedRef = Types.ObjectId | { _id: Types.ObjectId };

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');
const createToken = (): string => crypto.randomBytes(32).toString('hex');
const refId = (value: PopulatedRef): string =>
  ('_id' in value ? value._id : value).toString();
const safeInvitation = (invitation: { toObject: (options?: object) => object }) => {
  const value = invitation.toObject({ versionKey: false }) as {
    tokenHash?: string;
    [key: string]: unknown;
  };
  delete value.tokenHash;
  return value;
};

const roleFor = (shortlist: ShortlistDocument, userId: string): ShortlistAccessRole | null => {
  if (refId(shortlist.owner as PopulatedRef) === userId) return 'owner';
  const member = shortlist.members.find(
    (item) => refId(item.user as PopulatedRef) === userId,
  );
  return member?.role ?? null;
};

const ownerHasPaidAccess = async (
  shortlist: ShortlistDocument,
): Promise<boolean> => {
  const owner = await User.findById(
    refId(shortlist.owner as PopulatedRef),
  ).select('subscriptionStatus paidAccessStartsAt paidAccessEndsAt');
  return hasActivePaidAccess(owner);
};

const serialize = async (shortlist: ShortlistDocument, userId: string) => {
  const role = roleFor(shortlist, userId);
  if (!role) throw new ApiError(403, 'Shortlist access denied');
  const [ownerPaid, pendingInvitation] = await Promise.all([
    ownerHasPaidAccess(shortlist),
    role === 'owner' && shortlist.kind === SHORTLIST_KINDS.TEAM
      ? ShortlistInvitation.exists({
          shortlist: shortlist._id,
          status: INVITATION_STATUSES.PENDING,
          expiresAt: { $gt: new Date() },
        })
      : null,
  ]);
  return {
    ...shortlist.toObject({ versionKey: false }),
    role,
    ownerHasActivePaidAccess: ownerPaid,
    isTeamReadOnly:
      shortlist.kind === SHORTLIST_KINDS.TEAM && !ownerPaid,
    capabilities: shortlistCapabilities({
      role,
      kind: shortlist.kind,
      ownerHasActivePaidAccess: ownerPaid,
      hasMembers: shortlist.members.length > 0,
      hasPendingInvitations: Boolean(pendingInvitation),
    }),
  };
};

const populateShortlist = async (shortlist: ShortlistDocument) => {
  await shortlist.populate([
    { path: 'owner', select: userSelect },
    { path: 'members.user', select: userSelect },
    { path: 'songs', select: songSelect },
  ]);
  return shortlist;
};

const requireAccess = async (
  shortlistId: string,
  userId: string,
): Promise<{ shortlist: ShortlistDocument; role: ShortlistAccessRole }> => {
  ensureValidObjectId(shortlistId, 'shortlistId');
  const shortlist = await Shortlist.findById(shortlistId);
  if (!shortlist) throw new ApiError(404, 'Shortlist not found');
  const role = roleFor(shortlist, userId);
  if (!role) throw new ApiError(403, 'Shortlist access denied');
  return { shortlist, role };
};

const requireOwner = async (
  shortlistId: string,
  userId: string,
): Promise<ShortlistDocument> => {
  const { shortlist, role } = await requireAccess(shortlistId, userId);
  if (role !== 'owner') {
    throw new ApiError(403, 'Only the shortlist owner can perform this action');
  }
  return shortlist;
};

const requireTrackManager = async (
  shortlistId: string,
  userId: string,
): Promise<ShortlistDocument> => {
  const { shortlist, role } = await requireAccess(shortlistId, userId);
  if (
    shortlist.kind === SHORTLIST_KINDS.TEAM &&
    !(await ownerHasPaidAccess(shortlist))
  ) {
    throw new ApiError(
      403,
      'Team shortlist editing is paused until the owner renews paid access',
    );
  }
  if (role === SHORTLIST_MEMBER_ROLES.VIEWER) {
    throw new ApiError(403, 'Viewer access cannot change shortlist tracks');
  }
  return shortlist;
};

const requireActiveTeamOwner = async (
  shortlistId: string,
  userId: string,
): Promise<ShortlistDocument> => {
  const shortlist = await requireOwner(shortlistId, userId);
  if (!(await ownerHasPaidAccess(shortlist))) {
    throw new ApiError(403, 'Active paid access is required for team shortlists');
  }
  return shortlist;
};

const requireActiveTeamAccess = async (
  shortlistId: string,
  userId: string,
) => {
  const access = await requireAccess(shortlistId, userId);
  if (
    access.shortlist.kind !== SHORTLIST_KINDS.TEAM ||
    !(await ownerHasPaidAccess(access.shortlist))
  ) {
    throw new ApiError(403, 'Comments require an active team shortlist');
  }
  return access;
};

export const createShortlist = async (
  ownerId: string,
  payload: CreateShortlistInput,
) => {
  const shortlist = await Shortlist.create({
    owner: ownerId,
    name: payload.name,
    description: payload.description,
  });
  await populateShortlist(shortlist);
  return serialize(shortlist, ownerId);
};

export const listShortlists = async (userId: string) => {
  const shortlists = await Shortlist.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  }).sort({ updatedAt: -1 });
  await Promise.all(shortlists.map(populateShortlist));
  return Promise.all(shortlists.map((shortlist) => serialize(shortlist, userId)));
};

export const getShortlist = async (shortlistId: string, userId: string) => {
  const { shortlist } = await requireAccess(shortlistId, userId);
  await populateShortlist(shortlist);
  return serialize(shortlist, userId);
};

export const updateShortlist = async (
  shortlistId: string,
  userId: string,
  payload: UpdateShortlistInput,
) => {
  const shortlist = await requireOwner(shortlistId, userId);
  if (
    shortlist.kind === SHORTLIST_KINDS.TEAM &&
    !(await ownerHasPaidAccess(shortlist))
  ) {
    throw new ApiError(
      403,
      'Team shortlist editing is paused until paid access is renewed',
    );
  }
  if (payload.name !== undefined) shortlist.name = payload.name;
  if (payload.description !== undefined) {
    shortlist.description = payload.description;
  }
  await shortlist.save();
  await populateShortlist(shortlist);
  return serialize(shortlist, userId);
};

export const deleteShortlist = async (
  shortlistId: string,
  userId: string,
): Promise<void> => {
  await requireOwner(shortlistId, userId);
  await Promise.all([
    Shortlist.deleteOne({ _id: shortlistId }),
    ShortlistInvitation.deleteMany({ shortlist: shortlistId }),
    ShortlistComment.deleteMany({ shortlist: shortlistId }),
  ]);
};

export const addSong = async (
  shortlistId: string,
  songId: string,
  userId: string,
) => {
  ensureValidObjectId(songId, 'songId');
  const shortlist = await requireTrackManager(shortlistId, userId);
  const song = await Song.findById(songId).select('_id');
  if (!song) throw new ApiError(404, 'Song not found');
  if (!shortlist.songs.some((item) => item.toString() === songId)) {
    shortlist.songs.push(song._id);
    await shortlist.save();
  }
  await populateShortlist(shortlist);
  return serialize(shortlist, userId);
};

export const removeSong = async (
  shortlistId: string,
  songId: string,
  userId: string,
) => {
  const shortlist = await requireTrackManager(shortlistId, userId);
  shortlist.songs = shortlist.songs.filter(
    (item) => item.toString() !== songId,
  ) as typeof shortlist.songs;
  await shortlist.save();
  await populateShortlist(shortlist);
  return serialize(shortlist, userId);
};

const sendInvitation = async (
  email: string,
  inviterName: string,
  shortlistName: string,
  role: ShortlistMemberRole,
  token: string,
) => {
  const inviteUrl = `${env.FRONTEND_URL}/shortlist-invitations/${token}`;
  await sendShortlistInvitationEmail({
    to: email,
    subject: `${inviterName} invited you to a SUNAR shortlist`,
    inviterName,
    shortlistName,
    role,
    inviteUrl,
    expiryDays: 7,
  });
};

export const createInvitation = async (
  shortlistId: string,
  userId: string,
  emailInput: string,
  role: ShortlistMemberRole,
) => {
  const shortlist = await requireActiveTeamOwner(shortlistId, userId);
  const email = normalizeInviteEmail(emailInput);
  const [owner, existingUser] = await Promise.all([
    User.findById(userId).select(userSelect),
    User.findByEmail(email),
  ]);
  if (!owner) throw new ApiError(404, 'Inviter not found');
  if (owner.email === email) throw new ApiError(400, 'You already own this shortlist');
  if (
    existingUser &&
    shortlist.members.some((member) => member.user.toString() === existingUser.id)
  ) {
    throw new ApiError(409, 'This user is already a shortlist member');
  }

  const pending = await ShortlistInvitation.findOne({
    shortlist: shortlistId,
    email,
    status: INVITATION_STATUSES.PENDING,
  });
  if (pending && pending.expiresAt > new Date()) {
    throw new ApiError(409, 'A pending invitation already exists for this email');
  }
  if (pending) {
    pending.status = INVITATION_STATUSES.EXPIRED;
    await pending.save();
  }

  const token = createToken();
  const invitation = await ShortlistInvitation.create({
    shortlist: shortlistId,
    inviter: userId,
    email,
    role,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  });
  if (shortlist.kind === SHORTLIST_KINDS.PERSONAL) {
    shortlist.kind = SHORTLIST_KINDS.TEAM;
    await shortlist.save();
  }

  if (existingUser) {
    await notificationService.createNotification({
      userId: existingUser.id,
      title: 'Shortlist invitation',
      message: `${owner.name} invited you to “${shortlist.name}”.`,
      type: NOTIFICATION_TYPE.SHORTLIST_INVITATION,
      metadata: {
        shortlistId,
        invitationId: invitation.id,
        inviteUrl: `/shortlist-invitations/${token}`,
      },
    });
  }
  await sendInvitation(email, owner.name, shortlist.name, role, token);
  return safeInvitation(invitation);
};

export const listInvitations = async (shortlistId: string, userId: string) => {
  await requireOwner(shortlistId, userId);
  await ShortlistInvitation.updateMany(
    {
      shortlist: shortlistId,
      status: INVITATION_STATUSES.PENDING,
      expiresAt: { $lte: new Date() },
    },
    { status: INVITATION_STATUSES.EXPIRED },
  );
  return ShortlistInvitation.find({ shortlist: shortlistId })
    .select('-tokenHash')
    .sort({ createdAt: -1 });
};

const invitationByToken = async (token: string) => {
  const invitation = await ShortlistInvitation.findOne({
    tokenHash: hashToken(token),
  }).select('+tokenHash');
  if (!invitation) throw new ApiError(404, 'Invitation not found');
  if (
    invitation.status === INVITATION_STATUSES.PENDING &&
    invitation.expiresAt <= new Date()
  ) {
    invitation.status = INVITATION_STATUSES.EXPIRED;
    await invitation.save();
  }
  return invitation;
};

export const inspectInvitation = async (token: string) => {
  const invitation = await invitationByToken(token);
  const shortlistRecord = await Shortlist.findById(invitation.shortlist).select(
    'owner kind',
  );
  const ownerPaid = shortlistRecord
    ? await ownerHasPaidAccess(shortlistRecord)
    : false;
  await invitation.populate([
    { path: 'shortlist', select: 'name description' },
    { path: 'inviter', select: 'name avatar' },
  ]);
  const value = invitation.toObject({ versionKey: false });
  delete (value as { tokenHash?: string }).tokenHash;
  return { ...value, ownerHasActivePaidAccess: ownerPaid };
};

export const acceptInvitation = async (
  token: string,
  userId: string,
  userEmail: string,
) => {
  const invitation = await invitationByToken(token);
  if (invitation.status !== INVITATION_STATUSES.PENDING) {
    throw new ApiError(409, `Invitation is ${invitation.status}`);
  }
  if (normalizeInviteEmail(userEmail) !== invitation.email) {
    throw new ApiError(403, 'Sign in with the email address that was invited');
  }
  const shortlist = await Shortlist.findById(invitation.shortlist);
  if (!shortlist) throw new ApiError(404, 'Shortlist not found');
  if (
    shortlist.kind !== SHORTLIST_KINDS.TEAM ||
    !(await ownerHasPaidAccess(shortlist))
  ) {
    throw new ApiError(
      403,
      'This team invitation is paused until the owner renews paid access',
    );
  }
  if (shortlist.owner.toString() !== userId) {
    const existing = shortlist.members.find(
      (member) => member.user.toString() === userId,
    );
    if (existing) {
      existing.role = invitation.role;
    } else {
      shortlist.members.push({
        user: new Types.ObjectId(userId),
        role: invitation.role,
        joinedAt: new Date(),
      });
    }
    await shortlist.save();
  }
  invitation.status = INVITATION_STATUSES.ACCEPTED;
  invitation.acceptedBy = new Types.ObjectId(userId);
  invitation.acceptedAt = new Date();
  await invitation.save();
  return getShortlist(shortlist.id, userId);
};

export const declineInvitation = async (
  token: string,
  userEmail: string,
): Promise<void> => {
  const invitation = await invitationByToken(token);
  if (invitation.status !== INVITATION_STATUSES.PENDING) {
    throw new ApiError(409, `Invitation is ${invitation.status}`);
  }
  if (normalizeInviteEmail(userEmail) !== invitation.email) {
    throw new ApiError(403, 'Sign in with the email address that was invited');
  }
  invitation.status = INVITATION_STATUSES.DECLINED;
  await invitation.save();
};

export const resendInvitation = async (
  shortlistId: string,
  invitationId: string,
  userId: string,
) => {
  const shortlist = await requireActiveTeamOwner(shortlistId, userId);
  const invitation = await ShortlistInvitation.findOne({
    _id: invitationId,
    shortlist: shortlistId,
    status: INVITATION_STATUSES.PENDING,
  }).select('+tokenHash');
  if (!invitation) throw new ApiError(404, 'Pending invitation not found');
  const owner = await User.findById(userId).select(userSelect);
  if (!owner) throw new ApiError(404, 'Inviter not found');
  const token = createToken();
  invitation.tokenHash = hashToken(token);
  invitation.expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  await invitation.save();
  await sendInvitation(
    invitation.email,
    owner.name,
    shortlist.name,
    invitation.role,
    token,
  );
  const recipient = await User.findByEmail(invitation.email);
  if (recipient) {
    await notificationService.createNotification({
      userId: recipient.id,
      title: 'Shortlist invitation resent',
      message: `${owner.name} invited you to “${shortlist.name}”.`,
      type: NOTIFICATION_TYPE.SHORTLIST_INVITATION,
      metadata: {
        shortlistId,
        invitationId: invitation.id,
        inviteUrl: `/shortlist-invitations/${token}`,
      },
    });
  }
  return safeInvitation(invitation);
};

export const revokeInvitation = async (
  shortlistId: string,
  invitationId: string,
  userId: string,
): Promise<void> => {
  await requireOwner(shortlistId, userId);
  const invitation = await ShortlistInvitation.findOne({
    _id: invitationId,
    shortlist: shortlistId,
    status: INVITATION_STATUSES.PENDING,
  });
  if (!invitation) throw new ApiError(404, 'Pending invitation not found');
  invitation.status = INVITATION_STATUSES.REVOKED;
  await invitation.save();
};

export const updateMemberRole = async (
  shortlistId: string,
  memberId: string,
  userId: string,
  role: ShortlistMemberRole,
) => {
  const shortlist = await requireActiveTeamOwner(shortlistId, userId);
  const member = shortlist.members.find(
    (item) => item.user.toString() === memberId,
  );
  if (!member) throw new ApiError(404, 'Shortlist member not found');
  member.role = role;
  await shortlist.save();
  return getShortlist(shortlistId, userId);
};

export const removeMember = async (
  shortlistId: string,
  memberId: string,
  userId: string,
): Promise<void> => {
  const shortlist = await requireOwner(shortlistId, userId);
  const before = shortlist.members.length;
  shortlist.members = shortlist.members.filter(
    (member) => member.user.toString() !== memberId,
  ) as typeof shortlist.members;
  if (shortlist.members.length === before) {
    throw new ApiError(404, 'Shortlist member not found');
  }
  await shortlist.save();
};

export const leaveShortlist = async (
  shortlistId: string,
  userId: string,
): Promise<void> => {
  const { shortlist, role } = await requireAccess(shortlistId, userId);
  if (role === 'owner') throw new ApiError(400, 'Owners cannot leave their shortlist');
  shortlist.members = shortlist.members.filter(
    (member) => member.user.toString() !== userId,
  ) as typeof shortlist.members;
  await shortlist.save();
};

const notifyComment = async (
  shortlist: ShortlistDocument,
  authorId: string,
  authorName: string,
) => {
  const recipientIds = new Set([
    refId(shortlist.owner as PopulatedRef),
    ...shortlist.members.map((member) => refId(member.user as PopulatedRef)),
  ]);
  recipientIds.delete(authorId);
  await Promise.all(
    [...recipientIds].map((recipientId) =>
      notificationService.createNotification({
        userId: recipientId,
        title: 'New shortlist comment',
        message: `${authorName} commented on “${shortlist.name}”.`,
        type: NOTIFICATION_TYPE.SHORTLIST_COMMENT,
        metadata: { shortlistId: shortlist.id },
      }),
    ),
  );
};

export const listComments = async (shortlistId: string, userId: string) => {
  const { shortlist, role } = await requireAccess(shortlistId, userId);
  if (shortlist.kind === SHORTLIST_KINDS.PERSONAL && role !== 'owner') {
    throw new ApiError(403, 'Personal shortlist notes are private');
  }
  const filter =
    shortlist.kind === SHORTLIST_KINDS.PERSONAL
      ? { shortlist: shortlistId, archivedAt: { $exists: true } }
      : { shortlist: shortlistId };
  return ShortlistComment.find(filter)
    .populate('author', userSelect)
    .sort({ createdAt: 1 });
};

export const createComment = async (
  shortlistId: string,
  userId: string,
  body: string,
  songId?: string,
) => {
  const { shortlist } = await requireActiveTeamAccess(shortlistId, userId);
  if (
    songId &&
    !shortlist.songs.some((song) => song.toString() === songId)
  ) {
    throw new ApiError(400, 'Comments can only reference tracks in this shortlist');
  }
  const author = await User.findById(userId).select(userSelect);
  if (!author) throw new ApiError(404, 'Comment author not found');
  const comment = await ShortlistComment.create({
    shortlist: shortlistId,
    author: userId,
    song: songId,
    body,
  });
  await Promise.all([
    comment.populate('author', userSelect),
    notifyComment(shortlist, userId, author.name),
  ]);
  return comment;
};

export const updateComment = async (
  shortlistId: string,
  commentId: string,
  userId: string,
  body: string,
) => {
  await requireActiveTeamAccess(shortlistId, userId);
  const comment = await ShortlistComment.findOne({
    _id: commentId,
    shortlist: shortlistId,
  });
  if (!comment) throw new ApiError(404, 'Comment not found');
  if (
    !canEditComment(
      comment.author.toString(),
      userId,
      Boolean(comment.archivedAt),
    )
  ) {
    throw new ApiError(403, 'You can only edit your own comments');
  }
  comment.body = body;
  await comment.save();
  await comment.populate('author', userSelect);
  return comment;
};

export const deleteComment = async (
  shortlistId: string,
  commentId: string,
  userId: string,
): Promise<void> => {
  const { role } = await requireActiveTeamAccess(shortlistId, userId);
  const comment = await ShortlistComment.findOne({
    _id: commentId,
    shortlist: shortlistId,
  });
  if (!comment) throw new ApiError(404, 'Comment not found');
  if (
    !canDeleteComment(
      role,
      comment.author.toString(),
      userId,
      Boolean(comment.archivedAt),
    )
  ) {
    throw new ApiError(403, 'You cannot delete this comment');
  }
  await comment.deleteOne();
};

export const convertToPersonal = async (
  shortlistId: string,
  userId: string,
) => {
  const shortlist = await requireOwner(shortlistId, userId);
  if (shortlist.kind !== SHORTLIST_KINDS.TEAM) {
    throw new ApiError(400, 'Shortlist is already personal');
  }
  if (shortlist.members.length > 0) {
    throw new ApiError(409, 'Remove all members before converting to personal');
  }
  await ShortlistInvitation.updateMany(
    {
      shortlist: shortlistId,
      status: INVITATION_STATUSES.PENDING,
      expiresAt: { $lte: new Date() },
    },
    { status: INVITATION_STATUSES.EXPIRED },
  );
  const pending = await ShortlistInvitation.exists({
    shortlist: shortlistId,
    status: INVITATION_STATUSES.PENDING,
  });
  if (pending) {
    throw new ApiError(
      409,
      'Revoke all pending invitations before converting to personal',
    );
  }
  await ShortlistComment.updateMany(
    { shortlist: shortlistId, archivedAt: { $exists: false } },
    { archivedAt: new Date() },
  );
  shortlist.kind = SHORTLIST_KINDS.PERSONAL;
  await shortlist.save();
  await populateShortlist(shortlist);
  return serialize(shortlist, userId);
};
