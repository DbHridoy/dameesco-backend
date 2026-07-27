export const SONG_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type SongStatus = (typeof SONG_STATUS)[keyof typeof SONG_STATUS];

export const FILE_TYPE = {
  ORIGINAL: 'original',
  WATERMARKED: 'watermarked',
  PREVIEW: 'preview',
  STEM: 'stem',
} as const;

export type FileType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE];
