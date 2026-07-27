import fs from 'fs';
import path from 'path';
import Stem, { StemDocument } from './stem.model';
import Song from './song.model';
import User from '@/modules/users/user.model';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import {
  buildS3Key,
  deleteFile,
  getSignedDownloadUrl,
  uploadFile,
} from '@/storage/s3.service';
import { getAudioDuration } from '@/audio/audio-watermark.service';
import { SONG_STATUS } from '@/constants/song-status';
import { SUBSCRIPTION_STATUS } from '@/constants/subscription';
import { USER_ROLES } from '@/constants/roles';

const mimeByExtension: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

export const normalizeStemFilename = (filename: string): string =>
  path.basename(filename).trim().toLowerCase();

const isPaidActive = (user: {
  subscriptionStatus?: string;
  paidAccessEndsAt?: Date | null;
} | null): boolean => {
  if (!user || user.subscriptionStatus !== SUBSCRIPTION_STATUS.PAID) return false;
  return !user.paidAccessEndsAt || user.paidAccessEndsAt.getTime() >= Date.now();
};

export const createStemFromFile = async ({
  songId,
  displayName,
  type,
  originalFilename,
  filePath,
  sortOrder = 0,
  uploadedBy,
}: {
  songId: string;
  displayName: string;
  type: string;
  originalFilename: string;
  filePath: string;
  sortOrder?: number;
  uploadedBy: string;
}): Promise<StemDocument> => {
  ensureValidObjectId(songId, 'songId');
  const song = await Song.findById(songId).select('_id');
  if (!song) throw new ApiError(404, 'Song not found');

  const normalizedFilename = normalizeStemFilename(originalFilename);
  const duplicate = await Stem.exists({ song: songId, normalizedFilename });
  if (duplicate) {
    throw new ApiError(409, 'A stem with this filename already exists for the track');
  }

  const extension = path.extname(originalFilename).toLowerCase();
  const mimeType = mimeByExtension[extension] ?? 'application/octet-stream';
  const stat = await fs.promises.stat(filePath);
  const duration = await getAudioDuration(filePath).catch(() => 0);
  const key = buildS3Key(`audio/stems/${songId}`, originalFilename);

  await uploadFile({
    key,
    body: fs.readFileSync(filePath),
    contentType: mimeType,
  });

  try {
    return await Stem.create({
      song: songId,
      displayName,
      type,
      originalFilename: path.basename(originalFilename),
      normalizedFilename,
      audioKey: key,
      mimeType,
      fileSize: stat.size,
      duration,
      sortOrder,
      uploadedBy,
    });
  } catch (error) {
    await deleteFile(key).catch(() => undefined);
    throw error;
  }
};

export const listStemMetadata = async (
  songId: string,
  userId?: string,
  role?: string,
): Promise<{
  stems: Array<{
    id: string;
    displayName: string;
    type: string;
    originalFilename: string;
    fileSize: number;
    duration: number;
    sortOrder: number;
    downloadCount?: number;
  }>;
  canDownload: boolean;
}> => {
  ensureValidObjectId(songId, 'songId');
  const isAdmin = role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;
  const song = await Song.findOne(
    isAdmin ? { _id: songId } : { _id: songId, status: SONG_STATUS.PUBLISHED },
  ).select('_id isDownloadable');
  if (!song) throw new ApiError(404, 'Song not found');

  const [stems, user] = await Promise.all([
    Stem.find({ song: songId }).sort({ sortOrder: 1, createdAt: 1 }),
    userId ? User.findById(userId).select('subscriptionStatus paidAccessEndsAt') : null,
  ]);

  return {
    stems: stems.map((stem) => ({
      id: stem._id.toString(),
      displayName: stem.displayName,
      type: stem.type,
      originalFilename: stem.originalFilename,
      fileSize: stem.fileSize,
      duration: stem.duration,
      sortOrder: stem.sortOrder,
      ...(isAdmin ? { downloadCount: stem.downloadCount } : {}),
    })),
    canDownload: Boolean(song.isDownloadable) && isPaidActive(user),
  };
};

export const getAdminStemAssetUrl = async (
  songId: string,
  stemId: string,
): Promise<{ url: string; expiresIn: number; filename: string }> => {
  ensureValidObjectId(songId, 'songId');
  ensureValidObjectId(stemId, 'stemId');
  const stem = await Stem.findOne({ _id: stemId, song: songId }).select('+audioKey');
  if (!stem) throw new ApiError(404, 'Stem not found');
  return {
    url: await getSignedDownloadUrl(stem.audioKey, 900),
    expiresIn: 900,
    filename: stem.originalFilename,
  };
};

export const deleteStem = async (songId: string, stemId: string): Promise<void> => {
  ensureValidObjectId(songId, 'songId');
  ensureValidObjectId(stemId, 'stemId');
  const stem = await Stem.findOne({ _id: stemId, song: songId }).select('+audioKey');
  if (!stem) throw new ApiError(404, 'Stem not found');
  await deleteFile(stem.audioKey).catch(() => undefined);
  await stem.deleteOne();
};

export const deleteAllSongStems = async (songId: string): Promise<void> => {
  const stems = await Stem.find({ song: songId }).select('+audioKey');
  await Promise.allSettled(
    stems.map((stem) => deleteFile(stem.audioKey).catch(() => undefined)),
  );
  await Stem.deleteMany({ song: songId });
};
