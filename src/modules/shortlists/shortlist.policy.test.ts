import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAcceptInvitation,
  canDeleteComment,
  canEditComment,
  hasActivePaidAccess,
  normalizeInviteEmail,
  shortlistCapabilities,
} from './shortlist.policy';

const capabilities = (
  role: 'owner' | 'editor' | 'viewer',
  kind: 'personal' | 'team',
  paid: boolean,
  hasMembers = false,
  hasPendingInvitations = false,
) =>
  shortlistCapabilities({
    role,
    kind,
    ownerHasActivePaidAccess: paid,
    hasMembers,
    hasPendingInvitations,
  });

test('personal shortlist capabilities allow free ownership but not collaboration', () => {
  const free = capabilities('owner', 'personal', false);
  assert.equal(free.canEditMetadata, true);
  assert.equal(free.canManageTracks, true);
  assert.equal(free.canInvite, false);
  assert.equal(free.canComment, false);
  assert.equal(free.canEnableTeam, false);

  const paid = capabilities('owner', 'personal', true);
  assert.equal(paid.canEnableTeam, true);
  assert.equal(paid.canInvite, false);
});

test('active team applies viewer and editor roles', () => {
  const editor = capabilities('editor', 'team', true, true);
  const viewer = capabilities('viewer', 'team', true, true);
  assert.equal(editor.canManageTracks, true);
  assert.equal(editor.canManageMembers, false);
  assert.equal(viewer.canManageTracks, false);
  assert.equal(viewer.canComment, true);
});

test('expired team freezes collaboration but allows owner cleanup', () => {
  const owner = capabilities('owner', 'team', false, true, true);
  const editor = capabilities('editor', 'team', false, true);
  assert.equal(owner.isTeamReadOnly, true);
  assert.equal(owner.canManageTracks, false);
  assert.equal(owner.canInvite, false);
  assert.equal(owner.canRemoveMembers, true);
  assert.equal(owner.canRevokeInvitations, true);
  assert.equal(owner.canDelete, true);
  assert.equal(editor.canManageTracks, false);
  assert.equal(editor.canComment, false);
});

test('team converts only when members and pending invitations are absent', () => {
  assert.equal(capabilities('owner', 'team', false).canConvertToPersonal, true);
  assert.equal(
    capabilities('owner', 'team', true, true).canConvertToPersonal,
    false,
  );
  assert.equal(
    capabilities('owner', 'team', true, false, true).canConvertToPersonal,
    false,
  );
});

test('active paid access honors status and access window', () => {
  const now = new Date('2026-07-28T00:00:00Z');
  assert.equal(hasActivePaidAccess({ subscriptionStatus: 'free' }, now), false);
  assert.equal(hasActivePaidAccess({ subscriptionStatus: 'paid' }, now), true);
  assert.equal(
    hasActivePaidAccess(
      {
        subscriptionStatus: 'paid',
        paidAccessStartsAt: '2026-07-29T00:00:00Z',
      },
      now,
    ),
    false,
  );
  assert.equal(
    hasActivePaidAccess(
      {
        subscriptionStatus: 'paid',
        paidAccessEndsAt: '2026-07-27T00:00:00Z',
      },
      now,
    ),
    false,
  );
});

test('invitation acceptance requires paid owner, pending state, and matching email', () => {
  const now = new Date('2026-07-28T00:00:00Z');
  const expiry = new Date('2026-07-29T00:00:00Z');
  assert.equal(normalizeInviteEmail(' Person@Example.COM '), 'person@example.com');
  assert.equal(
    canAcceptInvitation(
      'person@example.com',
      'Person@Example.com',
      'pending',
      expiry,
      true,
      now,
    ),
    true,
  );
  assert.equal(
    canAcceptInvitation(
      'person@example.com',
      'person@example.com',
      'pending',
      expiry,
      false,
      now,
    ),
    false,
  );
  assert.equal(
    canAcceptInvitation(
      'person@example.com',
      'other@example.com',
      'pending',
      expiry,
      true,
      now,
    ),
    false,
  );
});

test('archived comments are immutable while owners moderate active comments', () => {
  assert.equal(canEditComment('author', 'author'), true);
  assert.equal(canEditComment('author', 'author', true), false);
  assert.equal(canDeleteComment('owner', 'author', 'owner'), true);
  assert.equal(canDeleteComment('owner', 'author', 'owner', true), false);
});
