import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const createPlaylistSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
  songs: z.array(objectIdSchema).optional(),
});

export const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export const playlistIdParamSchema = z.object({
  id: objectIdSchema,
});

export const playlistSongParamSchema = z.object({
  id: objectIdSchema,
  songId: objectIdSchema,
});

export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;