import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import * as controller from './shortlist.controller';
import {
  commentSchema,
  createShortlistSchema,
  invitationTokenParams,
  inviteSchema,
  memberRoleSchema,
  shortlistCommentParams,
  shortlistIdParams,
  shortlistInvitationParams,
  shortlistMemberParams,
  shortlistSongParams,
  updateCommentSchema,
  updateShortlistSchema,
} from './shortlist.validation';

const router = Router();

router.get(
  '/invitations/:token',
  validate(invitationTokenParams, 'params'),
  controller.inspectInvitation,
);
router.post(
  '/invitations/:token/accept',
  authenticate,
  validate(invitationTokenParams, 'params'),
  controller.acceptInvitation,
);
router.post(
  '/invitations/:token/decline',
  authenticate,
  validate(invitationTokenParams, 'params'),
  controller.declineInvitation,
);

router.use(authenticate);
router.post('/', validate(createShortlistSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', validate(shortlistIdParams, 'params'), controller.get);
router.patch(
  '/:id',
  validate(shortlistIdParams, 'params'),
  validate(updateShortlistSchema),
  controller.update,
);
router.delete('/:id', validate(shortlistIdParams, 'params'), controller.remove);
router.post(
  '/:id/songs/:songId',
  validate(shortlistSongParams, 'params'),
  controller.addSong,
);
router.delete(
  '/:id/songs/:songId',
  validate(shortlistSongParams, 'params'),
  controller.removeSong,
);
router.get(
  '/:id/invitations',
  validate(shortlistIdParams, 'params'),
  controller.invitations,
);
router.post(
  '/:id/invitations',
  validate(shortlistIdParams, 'params'),
  validate(inviteSchema),
  controller.invite,
);
router.post(
  '/:id/invitations/:invitationId/resend',
  validate(shortlistInvitationParams, 'params'),
  controller.resendInvitation,
);
router.delete(
  '/:id/invitations/:invitationId',
  validate(shortlistInvitationParams, 'params'),
  controller.revokeInvitation,
);
router.patch(
  '/:id/members/:userId',
  validate(shortlistMemberParams, 'params'),
  validate(memberRoleSchema),
  controller.updateMember,
);
router.delete(
  '/:id/members/:userId',
  validate(shortlistMemberParams, 'params'),
  controller.removeMember,
);
router.post(
  '/:id/leave',
  validate(shortlistIdParams, 'params'),
  controller.leave,
);
router.post(
  '/:id/convert-to-personal',
  validate(shortlistIdParams, 'params'),
  controller.convertToPersonal,
);
router.get(
  '/:id/comments',
  validate(shortlistIdParams, 'params'),
  controller.comments,
);
router.post(
  '/:id/comments',
  validate(shortlistIdParams, 'params'),
  validate(commentSchema),
  controller.createComment,
);
router.patch(
  '/:id/comments/:commentId',
  validate(shortlistCommentParams, 'params'),
  validate(updateCommentSchema),
  controller.updateComment,
);
router.delete(
  '/:id/comments/:commentId',
  validate(shortlistCommentParams, 'params'),
  controller.deleteComment,
);

export default router;
