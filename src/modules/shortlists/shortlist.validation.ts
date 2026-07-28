import { z } from 'zod';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');
const role = z.enum(['viewer', 'editor']);

export const shortlistIdParams = z.object({ id: objectId });
export const shortlistSongParams = z.object({ id: objectId, songId: objectId });
export const shortlistMemberParams = z.object({ id: objectId, userId: objectId });
export const shortlistInvitationParams = z.object({
  id: objectId,
  invitationId: objectId,
});
export const shortlistCommentParams = z.object({
  id: objectId,
  commentId: objectId,
});
export const invitationTokenParams = z.object({ token: z.string().min(32).max(200) });

export const createShortlistSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
});

export const updateShortlistSchema = createShortlistSchema.partial();

export const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  role,
});

export const memberRoleSchema = z.object({ role });

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  songId: objectId.optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export type CreateShortlistInput = z.infer<typeof createShortlistSchema>;
export type UpdateShortlistInput = z.infer<typeof updateShortlistSchema>;
