import { ShortlistKind, ShortlistMemberRole } from './shortlist.model';

export type ShortlistAccessRole = 'owner' | ShortlistMemberRole;

export interface PaidAccessSubject {
  subscriptionStatus?: string;
  paidAccessStartsAt?: Date | string | null;
  paidAccessEndsAt?: Date | string | null;
}

export const normalizeInviteEmail = (email: string): string =>
  email.trim().toLowerCase();

export const hasActivePaidAccess = (
  user: PaidAccessSubject | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!user || user.subscriptionStatus !== 'paid') return false;
  if (
    user.paidAccessStartsAt &&
    new Date(user.paidAccessStartsAt).getTime() > now.getTime()
  ) {
    return false;
  }
  if (
    user.paidAccessEndsAt &&
    new Date(user.paidAccessEndsAt).getTime() < now.getTime()
  ) {
    return false;
  }
  return true;
};

export const shortlistCapabilities = ({
  role,
  kind,
  ownerHasActivePaidAccess,
  hasMembers,
  hasPendingInvitations,
}: {
  role: ShortlistAccessRole;
  kind: ShortlistKind;
  ownerHasActivePaidAccess: boolean;
  hasMembers: boolean;
  hasPendingInvitations: boolean;
}) => {
  const owner = role === 'owner';
  const personal = kind === 'personal';
  const activeTeam = kind === 'team' && ownerHasActivePaidAccess;
  const frozenTeam = kind === 'team' && !ownerHasActivePaidAccess;

  return {
    canEditMetadata: owner && (personal || activeTeam),
    canManageTracks:
      (personal && owner) ||
      (activeTeam && (owner || role === 'editor')),
    canManageMembers: owner && kind === 'team',
    canInvite: owner && activeTeam,
    canResendInvitations: owner && activeTeam,
    canRevokeInvitations: owner && kind === 'team',
    canChangeMemberRoles: owner && activeTeam,
    canRemoveMembers: owner && kind === 'team',
    canDelete: owner,
    canComment: activeTeam,
    canEnableTeam: owner && personal && ownerHasActivePaidAccess,
    canConvertToPersonal:
      owner &&
      kind === 'team' &&
      !hasMembers &&
      !hasPendingInvitations,
    canLeave: !owner && kind === 'team',
    isTeamReadOnly: frozenTeam,
  };
};

export const canAcceptInvitation = (
  invitationEmail: string,
  accountEmail: string,
  status: string,
  expiresAt: Date,
  ownerHasActivePaidAccess: boolean = true,
  now: Date = new Date(),
): boolean =>
  ownerHasActivePaidAccess &&
  status === 'pending' &&
  expiresAt > now &&
  normalizeInviteEmail(invitationEmail) === normalizeInviteEmail(accountEmail);

export const canEditComment = (
  authorId: string,
  userId: string,
  archived: boolean = false,
): boolean => !archived && authorId === userId;

export const canDeleteComment = (
  role: ShortlistAccessRole,
  authorId: string,
  userId: string,
  archived: boolean = false,
): boolean => !archived && (role === 'owner' || authorId === userId);
