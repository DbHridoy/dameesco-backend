import Song from '@/modules/songs/song.model';
import User from '@/modules/users/user.model';
import Download, { DownloadDocument } from './download.model';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import { getSignedDownloadUrl } from '@/storage/s3.service';
import { SUBSCRIPTION_STATUS } from '@/constants/subscription';
import { FILE_TYPE } from '@/constants/song-status';
import { incrementDownloadsUsed } from '@/modules/users/user.service';

export interface DownloadResult {
  downloadUrl: string;
  fileType: 'original' | 'watermarked' | 'preview';
  expiresIn: number;
}

const isPaidActive = (user: {
  subscriptionStatus: string;
  paidAccessEndsAt?: Date | null;
}): boolean => {
  if (user.subscriptionStatus !== SUBSCRIPTION_STATUS.PAID) return false;
  if (user.paidAccessEndsAt && user.paidAccessEndsAt.getTime() < Date.now()) {
    return false;
  }
  return true;
};

export const requestSongDownload = async (
  userId: string,
  songId: string,
  ip: string | undefined,
  ua: string | undefined,
): Promise<DownloadResult> => {
  ensureValidObjectId(songId, 'songId');

  const [song, user] = await Promise.all([
    Song.findById(songId),
    User.findById(userId),
  ]);

  if (!song) throw new ApiError(404, 'Song not found');
  if (!user) throw new ApiError(404, 'User not found');
  if (!song.isDownloadable) {
    throw new ApiError(403, 'This song is not available for download');
  }

  const paid = isPaidActive(user);

  if (paid) {
    if (user.downloadLimit > 0 && user.downloadsUsed >= user.downloadLimit) {
      throw new ApiError(403, 'Download limit reached');
    }
    if (!song.originalAudioKey) {
      throw new ApiError(
        400,
        'Original audio is not available for this song',
      );
    }
    const url = await getSignedDownloadUrl(song.originalAudioKey, 900);
    await Download.create({
      user: user._id,
      song: song._id,
      fileType: FILE_TYPE.ORIGINAL,
      userSubscriptionStatusAtDownload: SUBSCRIPTION_STATUS.PAID,
      ipAddress: ip,
      userAgent: ua,
    });
    await incrementDownloadsUsed(user._id.toString());
    await Song.findByIdAndUpdate(song._id, { $inc: { downloadCount: 1 } });
    return { downloadUrl: url, fileType: 'original', expiresIn: 900 };
  }

  // Free users only get the watermarked version
  if (!song.watermarkedAudioKey) {
    throw new ApiError(
      400,
      'Watermarked audio is not available yet for this song',
    );
  }
  const url = await getSignedDownloadUrl(song.watermarkedAudioKey, 900);
  await Download.create({
    user: user._id,
    song: song._id,
    fileType: FILE_TYPE.WATERMARKED,
    userSubscriptionStatusAtDownload: SUBSCRIPTION_STATUS.FREE,
    ipAddress: ip,
    userAgent: ua,
  });
  return { downloadUrl: url, fileType: 'watermarked', expiresIn: 900 };
};

export const listAllDownloads = async (
  page: number = 1,
  limit: number = 20,
): Promise<{ downloads: DownloadDocument[]; total: number }> => {
  const skip = (page - 1) * limit;
  const [downloads, total] = await Promise.all([
    Download.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email subscriptionStatus')
      .populate('song', 'title artist'),
    Download.countDocuments(),
  ]);
  return { downloads, total };
};

export const getDownloadStats = async (): Promise<{
  total: number;
  original: number;
  watermarked: number;
  preview: number;
  last7Days: number;
}> => {
  const [total, original, watermarked, preview, last7] = await Promise.all([
    Download.countDocuments(),
    Download.countDocuments({ fileType: FILE_TYPE.ORIGINAL }),
    Download.countDocuments({ fileType: FILE_TYPE.WATERMARKED }),
    Download.countDocuments({ fileType: FILE_TYPE.PREVIEW }),
    Download.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ]);
  return { total, original, watermarked, preview, last7Days: last7 };
};