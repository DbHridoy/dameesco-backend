import fs from 'fs';
import path from 'path';
import { FilterQuery } from 'mongoose';
import Song, { SongDocument } from './song.model';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import { slugifyWithRandomSuffix } from '@/utils/slugify';
import {
  buildPagination,
  buildPaginatedMeta,
  PaginationOptions,
  PaginatedMeta,
} from '@/utils/pagination';
import { SONG_STATUS } from '@/constants/song-status';
import {
  buildS3Key,
  getSignedDownloadUrl,
  uploadFile,
  deleteFile,
  isS3Configured,
} from '@/storage/s3.service';
import {
  generateWatermarkedAudio,
  generatePreviewAudio,
  getAudioDuration,
  transcodeToMp3,
} from '@/audio/audio-watermark.service';
import { extractAudioMetadata } from '@/audio/audio-metadata.service';
import {
  BulkSongStatusInput,
  CreateSongInput,
  ListSongsQueryInput,
  UpdateSongInput,
} from './song.validation';
import logger from '@/config/logger.config';
import {
  createLibraryTrack,
  CyaniteAnalysisResult,
  enqueueLibraryTrack,
  getLibraryTrackAnalysis,
  requestFileUpload,
  uploadAudioToCyanite,
} from '@/modules/ai-search/cyanite.service';

interface UploadAudioResult {
  originalAudioKey: string;
  originalAudioUrl: string;
  watermarkedAudioKey: string;
  watermarkedAudioUrl: string;
  previewAudioKey: string;
  previewAudioUrl: string;
  duration: number;
  fileSize: number;
  fileType: string;
}

interface CyaniteSubmissionResult {
  libraryTrackId: string;
  status: 'pending';
  rawAnalysis: Record<string, unknown>;
}

const ensureUniqueSlug = async (base: string): Promise<string> => {
  let slug = base;
  let attempt = 0;
  // Try a few times; collisions are unlikely with random suffix
  while (await Song.exists({ slug })) {
    attempt += 1;
    slug = `${base}-${attempt}`;
    if (attempt > 5) break;
  }
  return slug;
};

export const createSong = async (
  payload: CreateSongInput,
  uploadedBy: string,
): Promise<SongDocument> => {
  const baseSlug = slugifyWithRandomSuffix(payload.title);
  const slug = await ensureUniqueSlug(baseSlug);
  const song = await Song.create({
    ...payload,
    slug,
    uploadedBy,
    tags: payload.tags ?? [],
    status: payload.status ?? SONG_STATUS.DRAFT,
  });
  return song;
};

export const updateSong = async (
  id: string,
  payload: UpdateSongInput,
): Promise<SongDocument> => {
  ensureValidObjectId(id, 'songId');
  const song = await Song.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!song) throw new ApiError(404, 'Song not found');
  return song;
};

export const deleteSong = async (id: string): Promise<void> => {
  ensureValidObjectId(id, 'songId');
  const song = await Song.findById(id);
  if (!song) throw new ApiError(404, 'Song not found');

  // Best-effort cleanup of S3 assets
  const keysToDelete = [
    song.originalAudioKey,
    song.watermarkedAudioKey,
    song.previewAudioKey,
    song.coverImageKey,
  ].filter((k): k is string => Boolean(k));

  await Promise.allSettled(keysToDelete.map((k) => deleteFile(k).catch(() => {})));

  await song.deleteOne();
};

export const getSongByIdOrSlug = async (
  idOrSlug: string,
): Promise<SongDocument> => {
  const filter: FilterQuery<SongDocument> = isValidObjectIdLike(idOrSlug)
    ? { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] }
    : { slug: idOrSlug };
  const song = await Song.findOne(filter);
  if (!song) throw new ApiError(404, 'Song not found');
  return attachFreshSongCoverUrl(song);
};

const isValidObjectIdLike = (s: string): boolean =>
  /^[a-fA-F0-9]{24}$/.test(s);

export const attachFreshSongCoverUrl = async (
  song: SongDocument,
): Promise<SongDocument> => {
  if (song.coverImageKey) {
    song.coverImageUrl = await getSignedDownloadUrl(song.coverImageKey, 900);
  }
  return song;
};

export const attachFreshSongCoverUrls = async (
  songs: SongDocument[],
): Promise<SongDocument[]> => {
  return Promise.all(songs.map((song) => attachFreshSongCoverUrl(song)));
};

const prettyTag = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const uniqueStrings = (values: Array<string | undefined | null>): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => (typeof value === 'string' ? prettyTag(value) : ''))
    .filter((value) => {
      if (!value || seen.has(value.toLowerCase())) return false;
      seen.add(value.toLowerCase());
      return true;
    });
};

const extractFreeGenreTags = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const mapCyaniteAnalysisToSongFields = (
  result: CyaniteAnalysisResult,
): Partial<Pick<SongDocument, 'bpm' | 'key' | 'genre' | 'mood' | 'tags'>> => {
  const genreTags = uniqueStrings([
    ...(result.genreTags ?? []),
    ...(result.advancedGenreTags ?? []),
    ...(result.subgenreTags ?? []),
    ...(result.advancedSubgenreTags ?? []),
    ...extractFreeGenreTags(result.freeGenreTags),
  ]);
  const moodTags = uniqueStrings([
    ...(result.moodTags ?? []),
    ...(result.moodAdvancedTags ?? []),
  ]);
  const descriptiveTags = uniqueStrings([
    ...genreTags,
    ...moodTags,
    ...(result.characterTags ?? []),
    ...(result.instrumentTags ?? []),
    ...(result.advancedInstrumentTags ?? []),
    ...(result.advancedInstrumentTagsExtended ?? []),
    ...(result.voiceTags ?? []),
    ...(result.movementTags ?? []),
    result.energyLevel,
    result.energyDynamics,
    result.emotionalDynamics,
    result.emotionalProfile,
    result.musicalEraTag,
    result.voicePresenceProfile,
  ]);

  return {
    bpm: result.bpmPrediction?.value
      ? Math.round(result.bpmPrediction.value)
      : undefined,
    key: result.keyPrediction?.value ? prettyTag(result.keyPrediction.value) : undefined,
    genre: genreTags[0],
    mood: moodTags[0],
    tags: descriptiveTags.slice(0, 30),
  };
};

const applyDefinedSongFields = (
  song: SongDocument,
  fields: Partial<Pick<SongDocument, 'bpm' | 'key' | 'genre' | 'mood' | 'tags'>>,
) => {
  if (fields.bpm) song.bpm = fields.bpm;
  if (fields.key) song.key = fields.key;
  if (fields.genre) song.genre = fields.genre;
  if (fields.mood) song.mood = fields.mood;
  if (fields.tags?.length) song.tags = fields.tags;
};

const submitLocalAudioToCyanite = async ({
  song,
  inputPath,
  duration,
}: {
  song: SongDocument;
  inputPath: string;
  duration: number;
}): Promise<CyaniteSubmissionResult> => {
  if (duration > 15 * 60) {
    throw new ApiError(422, 'Cyanite API uploads support tracks up to 15 minutes');
  }

  const tmpCyanite = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, path.extname(inputPath))}-cyanite.mp3`,
  );

  try {
    await transcodeToMp3(inputPath, tmpCyanite, '192k');
    const uploadRequest = await requestFileUpload();
    await uploadAudioToCyanite(uploadRequest.uploadUrl, fs.readFileSync(tmpCyanite));
    const libraryTrack = await createLibraryTrack({
      uploadId: uploadRequest.id,
      title: song.title,
      externalId: song._id.toString(),
    });

    return {
      libraryTrackId: libraryTrack.id,
      status: 'pending',
      rawAnalysis: {
        submittedAt: new Date().toISOString(),
        enqueueStatus: libraryTrack.enqueueStatus,
      },
    };
  } finally {
    fs.unlink(tmpCyanite, () => undefined);
  }
};

const downloadOriginalAudioToTmp = async (song: SongDocument): Promise<string> => {
  if (!song.originalAudioKey) {
    throw new ApiError(400, 'No original audio uploaded for this song');
  }

  const { Readable } = await import('stream');
  const { pipeline } = await import('stream/promises');
  const originalUrl = await getSignedDownloadUrl(song.originalAudioKey, 300);
  const response = await fetch(originalUrl);

  if (!response.ok || !response.body) {
    throw new ApiError(500, 'Failed to fetch original audio');
  }

  const tmpDir = path.resolve(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpIn = path.join(tmpDir, `${song.slug}-cyanite-source-${Date.now()}.mp3`);

  await pipeline(
    Readable.fromWeb(
      response.body as unknown as import('stream/web').ReadableStream,
    ),
    fs.createWriteStream(tmpIn),
  );

  return tmpIn;
};

export const listPublishedSongs = async (
  query: ListSongsQueryInput,
): Promise<{ songs: SongDocument[]; meta: PaginatedMeta }> => {
  const filter: FilterQuery<SongDocument> = { status: SONG_STATUS.PUBLISHED };
  applySongFilters(filter, query);

  const pagination: PaginationOptions = {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy ?? 'createdAt',
    sortOrder: query.sortOrder ?? 'desc',
  };
  const { page, limit, skip, sort } = buildPagination(pagination, [
    'createdAt',
    'title',
    'downloadCount',
  ]);

  const [songs, total] = await Promise.all([
    Song.find(filter).sort(sort).skip(skip).limit(limit),
    Song.countDocuments(filter),
  ]);

  return {
    songs: await attachFreshSongCoverUrls(songs),
    meta: buildPaginatedMeta(page, limit, total),
  };
};

export const listAllSongsAdmin = async (
  query: ListSongsQueryInput,
): Promise<{ songs: SongDocument[]; meta: PaginatedMeta }> => {
  const filter: FilterQuery<SongDocument> = {};
  applySongFilters(filter, query);

  const pagination: PaginationOptions = {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy ?? 'createdAt',
    sortOrder: query.sortOrder ?? 'desc',
  };
  const { page, limit, skip, sort } = buildPagination(pagination, [
    'createdAt',
    'title',
    'downloadCount',
  ]);

  const [songs, total] = await Promise.all([
    Song.find(filter).sort(sort).skip(skip).limit(limit),
    Song.countDocuments(filter),
  ]);

  return {
    songs: await attachFreshSongCoverUrls(songs),
    meta: buildPaginatedMeta(page, limit, total),
  };
};

const applySongFilters = (
  filter: FilterQuery<SongDocument>,
  query: ListSongsQueryInput,
): void => {
  if (query.search) {
    const s = String(query.search).trim();
    filter.$or = [
      { title: { $regex: s, $options: 'i' } },
      { artist: { $regex: s, $options: 'i' } },
      { album: { $regex: s, $options: 'i' } },
      { genre: { $regex: s, $options: 'i' } },
      { mood: { $regex: s, $options: 'i' } },
      { tags: { $regex: s, $options: 'i' } },
    ];
  }
  if (query.genre) filter.genre = query.genre;
  if (query.mood) filter.mood = query.mood;
  if (query.artist) filter.artist = query.artist;
  if (query.status) filter.status = query.status;
  if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured;
};

export const searchSongs = async (
  search: string,
  query: ListSongsQueryInput,
): Promise<{ songs: SongDocument[]; meta: PaginatedMeta }> => {
  const merged: ListSongsQueryInput = { ...query, search };
  return listPublishedSongs(merged);
};

export const listFeatured = async (
  limit: number = 10,
): Promise<SongDocument[]> => {
  const songs = await Song.find({
    status: SONG_STATUS.PUBLISHED,
    isFeatured: true,
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 50));
  return attachFreshSongCoverUrls(songs);
};

export const getAdminSongAssetUrl = async (
  songId: string,
  type: 'preview' | 'download' | 'watermarked',
): Promise<{ url: string; fileType: 'preview' | 'original' | 'watermarked' }> => {
  ensureValidObjectId(songId, 'songId');
  const song = await Song.findById(songId);
  if (!song) throw new ApiError(404, 'Song not found');

  if (type === 'preview') {
    const key = song.previewAudioKey ?? song.watermarkedAudioKey ?? song.originalAudioKey;
    if (!key) throw new ApiError(400, 'No preview audio is available for this song');
    const fileType = song.previewAudioKey
      ? 'preview'
      : song.watermarkedAudioKey
        ? 'watermarked'
        : 'original';
    return {
      url: await getSignedDownloadUrl(key, 900),
      fileType,
    };
  }

  if (type === 'watermarked') {
    const key = song.watermarkedAudioKey ?? song.previewAudioKey ?? song.originalAudioKey;
    if (!key) throw new ApiError(400, 'No watermarked audio is available for this song');
    const fileType = song.watermarkedAudioKey
      ? 'watermarked'
      : song.previewAudioKey
        ? 'preview'
        : 'original';
    return {
      url: await getSignedDownloadUrl(key, 900),
      fileType,
    };
  }

  const key = song.originalAudioKey ?? song.watermarkedAudioKey ?? song.previewAudioKey;
  if (!key) throw new ApiError(400, 'No downloadable audio is available for this song');
  const fileType = song.originalAudioKey
    ? 'original'
    : song.watermarkedAudioKey
      ? 'watermarked'
      : 'preview';
  return {
    url: await getSignedDownloadUrl(key, 900),
    fileType,
  };
};

export const getPublicSongPreviewUrl = async (
  songId: string,
): Promise<{ url: string; fileType: 'preview' | 'watermarked' | 'original'; expiresIn: number }> => {
  ensureValidObjectId(songId, 'songId');
  const song = await Song.findOne({
    _id: songId,
    status: SONG_STATUS.PUBLISHED,
  });
  if (!song) throw new ApiError(404, 'Song not found');

  const key = song.previewAudioKey ?? song.watermarkedAudioKey ?? song.originalAudioKey;
  if (!key) throw new ApiError(400, 'No preview audio is available for this song');

  const fileType = song.previewAudioKey
    ? 'preview'
    : song.watermarkedAudioKey
      ? 'watermarked'
      : 'original';

  return {
    url: await getSignedDownloadUrl(key, 900),
    fileType,
    expiresIn: 900,
  };
};

export const setStatus = async (
  id: string,
  status: keyof typeof SONG_STATUS,
): Promise<SongDocument> => {
  ensureValidObjectId(id, 'songId');
  const song = await Song.findById(id);
  if (!song) throw new ApiError(404, 'Song not found');
  song.status = SONG_STATUS[status];
  await song.save();
  return song;
};

export const bulkSetStatus = async (
  payload: BulkSongStatusInput,
): Promise<{
  requested: number;
  matched: number;
  modified: number;
  missing: number;
  status: BulkSongStatusInput['status'];
}> => {
  const result = await Song.updateMany(
    { _id: { $in: payload.songIds } },
    { $set: { status: payload.status } },
  );

  return {
    requested: payload.songIds.length,
    matched: result.matchedCount,
    modified: result.modifiedCount,
    missing: payload.songIds.length - result.matchedCount,
    status: payload.status,
  };
};

export const uploadCoverImage = async (
  songId: string,
  file: Express.Multer.File,
): Promise<SongDocument> => {
  try {
    ensureValidObjectId(songId, 'songId');
    const song = await Song.findById(songId);
    if (!song) throw new ApiError(404, 'Song not found');

    if (!isS3Configured()) {
      throw new ApiError(500, 'S3 storage is not configured');
    }

    const key = buildS3Key('covers', file.originalname);
    const buffer = fs.readFileSync(file.path);
    const uploaded = await uploadFile({
      key,
      body: buffer,
      contentType: file.mimetype,
      isPublic: true,
    });

    // Remove previous cover (best-effort)
    if (song.coverImageKey && song.coverImageKey !== uploaded.key) {
      await deleteFile(song.coverImageKey).catch(() => undefined);
    }

    song.coverImageKey = uploaded.key;
    song.coverImageUrl = await getSignedDownloadUrl(uploaded.key, 900);
    await song.save();

    return song;
  } finally {
    fs.unlink(file.path, () => undefined);
  }
};

/**
 * Uploads an original audio file, generates the watermarked version + preview,
 * stores all variants in S3, and updates the song document.
 *
 * If FFmpeg processing fails, the song is NOT updated and the user receives
 * a clean error.
 */
export const uploadAndProcessAudio = async (
  songId: string,
  file: Express.Multer.File,
  options: { triggerCyanite?: boolean } = {},
): Promise<SongDocument> => {
  ensureValidObjectId(songId, 'songId');
  const song = await Song.findById(songId);
  if (!song) throw new ApiError(404, 'Song not found');

  if (!isS3Configured()) {
    throw new ApiError(500, 'S3 storage is not configured');
  }

  const tmpInput = file.path;
  const tmpWatermark = path.join(
    path.dirname(tmpInput),
    `${path.basename(tmpInput, path.extname(tmpInput))}-wm.mp3`,
  );
  const tmpPreview = path.join(
    path.dirname(tmpInput),
    `${path.basename(tmpInput, path.extname(tmpInput))}-preview.mp3`,
  );

  let processed: UploadAudioResult;
  let cyaniteSubmission: CyaniteSubmissionResult | null = null;
  let cyaniteError: string | null = null;
  try {
    // 1. Generate watermarked version locally
    await generateWatermarkedAudio({
      inputPath: tmpInput,
      outputPath: tmpWatermark,
    });

    // 2. Generate preview clip
    await generatePreviewAudio(tmpInput, tmpPreview, 30);

    // 3. Extract metadata for duration etc.
    let duration = 0;
    try {
      const meta = await extractAudioMetadata(tmpInput);
      duration = meta.duration;
    } catch {
      duration = await getAudioDuration(tmpInput);
    }

    // 4. Upload original
    const originalKey = buildS3Key('audio/original', file.originalname);
    const originalUpload = await uploadFile({
      key: originalKey,
      body: fs.readFileSync(tmpInput),
      contentType: 'audio/mpeg',
    });

    // 5. Upload watermarked
    const wmKey = buildS3Key(
      'audio/watermarked',
      path.basename(tmpWatermark),
    );
    const wmUpload = await uploadFile({
      key: wmKey,
      body: fs.readFileSync(tmpWatermark),
      contentType: 'audio/mpeg',
    });

    // 6. Upload preview
    const previewKey = buildS3Key(
      'audio/preview',
      path.basename(tmpPreview),
    );
    const previewUpload = await uploadFile({
      key: previewKey,
      body: fs.readFileSync(tmpPreview),
      contentType: 'audio/mpeg',
    });

    processed = {
      originalAudioKey: originalUpload.key,
      originalAudioUrl: originalUpload.url,
      watermarkedAudioKey: wmUpload.key,
      watermarkedAudioUrl: wmUpload.url,
      previewAudioKey: previewKey,
      previewAudioUrl: previewUpload.url,
      duration,
      fileSize: file.size,
      fileType: file.mimetype,
    };

    if (options.triggerCyanite !== false) {
      try {
        cyaniteSubmission = await submitLocalAudioToCyanite({
          song,
          inputPath: tmpInput,
          duration,
        });
      } catch (error) {
        cyaniteError =
          error instanceof Error ? error.message : 'Cyanite submission failed';
        logger.warn({ error: cyaniteError, songId }, 'Cyanite auto tagging submission failed');
      }
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error, songId },
      'Audio processing failed',
    );
    throw new ApiError(
      500,
      error instanceof ApiError ? error.message : 'Audio processing failed',
    );
  } finally {
    // Cleanup temp files regardless of outcome
    fs.unlink(tmpInput, () => undefined);
    fs.unlink(tmpWatermark, () => undefined);
    fs.unlink(tmpPreview, () => undefined);
  }

  // Clean up old audio assets
  const oldKeys = [
    song.originalAudioKey,
    song.watermarkedAudioKey,
    song.previewAudioKey,
  ].filter((k): k is string => Boolean(k) && k !== processed.originalAudioKey);
  await Promise.allSettled(
    oldKeys.map((k) => deleteFile(k).catch(() => undefined)),
  );

  song.originalAudioKey = processed.originalAudioKey;
  song.originalAudioUrl = processed.originalAudioUrl;
  song.watermarkedAudioKey = processed.watermarkedAudioKey;
  song.watermarkedAudioUrl = processed.watermarkedAudioUrl;
  song.previewAudioKey = processed.previewAudioKey;
  song.previewAudioUrl = processed.previewAudioUrl;
  song.duration = processed.duration || song.duration;
  song.fileSize = processed.fileSize;
  song.fileType = processed.fileType;
  if (cyaniteSubmission) {
    song.cyaniteLibraryTrackId = cyaniteSubmission.libraryTrackId;
    song.cyaniteAnalysisStatus = cyaniteSubmission.status;
    song.cyaniteRawAnalysis = cyaniteSubmission.rawAnalysis;
  } else if (cyaniteError) {
    song.cyaniteAnalysisStatus = 'failed';
    song.cyaniteRawAnalysis = {
      error: cyaniteError,
      failedAt: new Date().toISOString(),
    };
  }
  await song.save();

  return song;
};

export const refreshCyaniteAnalysisForSong = async (
  song: SongDocument,
): Promise<SongDocument> => {
  if (!song.cyaniteLibraryTrackId) {
    throw new ApiError(400, 'This song has not been submitted to Cyanite yet');
  }

  const analysis = await getLibraryTrackAnalysis(song.cyaniteLibraryTrackId);

  if (analysis.status === 'finished' && analysis.result) {
    applyDefinedSongFields(song, mapCyaniteAnalysisToSongFields(analysis.result));
    song.cyaniteAnalysisStatus = 'finished';
    song.cyaniteRawAnalysis = analysis.result as Record<string, unknown>;
  } else if (analysis.status === 'failed') {
    song.cyaniteAnalysisStatus = 'failed';
    song.cyaniteRawAnalysis = {
      error: analysis.error ?? 'Cyanite analysis failed',
      failedAt: new Date().toISOString(),
    };
  } else {
    if (analysis.status === 'not_started') {
      await enqueueLibraryTrack(song.cyaniteLibraryTrackId);
    }
    song.cyaniteAnalysisStatus = 'pending';
    song.cyaniteRawAnalysis = {
      ...(song.cyaniteRawAnalysis ?? {}),
      lastCheckedAt: new Date().toISOString(),
      cyaniteStatus: analysis.status,
    };
  }

  await song.save();
  return song;
};

export const generateAiTags = async (songId: string): Promise<SongDocument> => {
  ensureValidObjectId(songId, 'songId');
  const song = await Song.findById(songId);
  if (!song) throw new ApiError(404, 'Song not found');

  if (song.cyaniteLibraryTrackId && song.cyaniteAnalysisStatus !== 'failed') {
    return refreshCyaniteAnalysisForSong(song);
  }

  const tmpInput = await downloadOriginalAudioToTmp(song);
  try {
    const duration = song.duration || (await getAudioDuration(tmpInput));
    const submission = await submitLocalAudioToCyanite({
      song,
      inputPath: tmpInput,
      duration,
    });
    song.cyaniteLibraryTrackId = submission.libraryTrackId;
    song.cyaniteAnalysisStatus = submission.status;
    song.cyaniteRawAnalysis = submission.rawAnalysis;
    await song.save();
    return song;
  } finally {
    fs.unlink(tmpInput, () => undefined);
  }
};

export const handleCyaniteAnalysisWebhook = async (
  libraryTrackId: string,
): Promise<SongDocument | null> => {
  const song = await Song.findOne({ cyaniteLibraryTrackId: libraryTrackId });
  if (song) {
    return refreshCyaniteAnalysisForSong(song);
  }

  const analysis = await getLibraryTrackAnalysis(libraryTrackId);
  if (!analysis.externalId || !isValidObjectIdLike(analysis.externalId)) {
    logger.warn({ libraryTrackId }, 'Cyanite webhook did not match a local song');
    return null;
  }

  const songByExternalId = await Song.findById(analysis.externalId);
  if (!songByExternalId) {
    logger.warn(
      { libraryTrackId, externalId: analysis.externalId },
      'Cyanite webhook external id did not match a local song',
    );
    return null;
  }

  songByExternalId.cyaniteLibraryTrackId = libraryTrackId;
  return refreshCyaniteAnalysisForSong(songByExternalId);
};

export const regenerateWatermark = async (
  songId: string,
): Promise<SongDocument> => {
  ensureValidObjectId(songId, 'songId');
  const song = await Song.findById(songId);
  if (!song) throw new ApiError(404, 'Song not found');

  if (!song.originalAudioKey) {
    throw new ApiError(400, 'No original audio uploaded for this song');
  }

  // Download the original to a tmp path, then re-generate watermark
  // For simplicity we generate a fresh signed URL and download via fetch.
  const { Readable } = await import('stream');
  const { pipeline } = await import('stream/promises');

  const originalUrl = await getSignedDownloadUrl(song.originalAudioKey, 300);
  const response = await fetch(originalUrl);
  if (!response.ok || !response.body) {
    throw new ApiError(500, 'Failed to fetch original audio');
  }

  const tmpDir = path.resolve(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpIn = path.join(tmpDir, `${song.slug}-original-${Date.now()}.mp3`);
  const tmpOut = path.join(tmpDir, `${song.slug}-wm-${Date.now()}.mp3`);
  await pipeline(
    Readable.fromWeb(
      response.body as unknown as import('stream/web').ReadableStream,
    ),
    fs.createWriteStream(tmpIn),
  );

  try {
    await generateWatermarkedAudio({
      inputPath: tmpIn,
      outputPath: tmpOut,
    });

    const newKey = buildS3Key('audio/watermarked', path.basename(tmpOut));
    const uploaded = await uploadFile({
      key: newKey,
      body: fs.readFileSync(tmpOut),
      contentType: 'audio/mpeg',
    });

    if (song.watermarkedAudioKey && song.watermarkedAudioKey !== newKey) {
      await deleteFile(song.watermarkedAudioKey).catch(() => undefined);
    }

    song.watermarkedAudioKey = uploaded.key;
    song.watermarkedAudioUrl = uploaded.url;
    await song.save();
  } finally {
    fs.unlink(tmpIn, () => undefined);
    fs.unlink(tmpOut, () => undefined);
  }

  return song;
};
