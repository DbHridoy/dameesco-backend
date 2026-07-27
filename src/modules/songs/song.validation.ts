import { z } from 'zod';
import { SONG_STATUS } from '@/constants/song-status';

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const createSongSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(150),
  album: z.string().max(150).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(80).optional(),
  mood: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).optional(),
  bpm: z.coerce.number().int().min(20).max(400).optional(),
  key: z.string().max(20).optional(),
  language: z.string().max(40).optional(),
  releaseDate: z.string().datetime().optional(),
  isFeatured: z.boolean().optional(),
  isDownloadable: z.boolean().optional(),
  status: z
    .enum([
      SONG_STATUS.DRAFT,
      SONG_STATUS.PUBLISHED,
      SONG_STATUS.ARCHIVED,
    ])
    .optional(),
});

export const updateSongSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  artist: z.string().min(1).max(150).optional(),
  album: z.string().max(150).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(80).optional(),
  mood: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).optional(),
  bpm: z.coerce.number().int().min(20).max(400).optional(),
  key: z.string().max(20).optional(),
  language: z.string().max(40).optional(),
  releaseDate: z.string().datetime().optional(),
  isFeatured: z.boolean().optional(),
  isDownloadable: z.boolean().optional(),
});

export const songIdParamSchema = z.object({
  id: objectIdSchema,
});

export const idOrSlugParamSchema = z.object({
  idOrSlug: z.string().min(1),
});

export const listSongsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  genre: z.string().optional(),
  mood: z.string().optional(),
  artist: z.string().optional(),
  status: z
    .enum([
      SONG_STATUS.DRAFT,
      SONG_STATUS.PUBLISHED,
      SONG_STATUS.ARCHIVED,
    ])
    .optional(),
  isFeatured: z.coerce.boolean().optional(),
  sortBy: z
    .enum(['createdAt', 'title', 'downloadCount'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const publishSongSchema = z.object({
  status: z.enum([SONG_STATUS.PUBLISHED, SONG_STATUS.ARCHIVED]),
});

export const bulkSongStatusSchema = z.object({
  songIds: z
    .array(objectIdSchema)
    .min(1, 'Select at least one track')
    .max(500, 'A maximum of 500 tracks can be updated at once')
    .refine(
      (songIds) => new Set(songIds).size === songIds.length,
      'Duplicate track ids are not allowed',
    ),
  status: z.enum([SONG_STATUS.PUBLISHED, SONG_STATUS.DRAFT]),
});

export type CreateSongInput = z.infer<typeof createSongSchema>;
export type UpdateSongInput = z.infer<typeof updateSongSchema>;
export type ListSongsQueryInput = z.infer<typeof listSongsQuerySchema>;
export type PublishSongInput = z.infer<typeof publishSongSchema>;
export type BulkSongStatusInput = z.infer<typeof bulkSongStatusSchema>;
