import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import Song from '@/modules/songs/song.model';
import User from '@/modules/users/user.model';
import Download from '@/modules/downloads/download.model';
import env from '@/config/env.config';
import logger from '@/config/logger.config';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import { SUBSCRIPTION_STATUS } from '@/constants/subscription';
import { FILE_TYPE } from '@/constants/song-status';
import {
  buildS3Key,
  getSignedDownloadUrl,
  isS3Configured,
  uploadFile,
} from '@/storage/s3.service';

if (env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(env.FFMPEG_PATH);
}

interface RenderVideoPreviewInput {
  userId: string;
  songId: string;
  videoFile: Express.Multer.File | undefined;
  ip?: string;
  userAgent?: string;
}

interface RenderVideoPreviewResult {
  downloadUrl: string;
  fileType: 'preview';
  expiresIn: number;
  generatedKey: string;
}

const tmpDir = path.resolve(process.cwd(), 'tmp');

const cleanup = (filePath?: string): void => {
  if (!filePath) return;
  fs.unlink(filePath, () => undefined);
};

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

const renderLowResPreview = async (
  videoPath: string,
  audioUrl: string,
  outputPath: string,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioUrl)
      .outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        '-vf scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2',
        '-c:v libx264',
        '-preset veryfast',
        '-crf 28',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
        '-shortest',
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
};

export const renderVideoPreview = async ({
  userId,
  songId,
  videoFile,
  ip,
  userAgent,
}: RenderVideoPreviewInput): Promise<RenderVideoPreviewResult> => {
  ensureValidObjectId(songId, 'songId');

  if (!videoFile) {
    throw new ApiError(400, 'Video file is required');
  }

  if (!isS3Configured()) {
    cleanup(videoFile.path);
    throw new ApiError(500, 'S3 storage is not configured');
  }

  const outputPath = path.join(
    tmpDir,
    `video-sync-${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`,
  );

  try {
    const [user, song] = await Promise.all([
      User.findById(userId),
      Song.findById(songId),
    ]);

    if (!user) throw new ApiError(404, 'User not found');
    if (!song) throw new ApiError(404, 'Song not found');
    if (!isPaidActive(user)) {
      throw new ApiError(403, 'Paid access is required to download video previews');
    }

    const audioKey =
      song.originalAudioKey ??
      song.watermarkedAudioKey ??
      song.previewAudioKey;

    if (!audioKey) {
      throw new ApiError(400, 'No audio is available for this song');
    }

    const audioUrl = await getSignedDownloadUrl(audioKey, 900);
    await renderLowResPreview(videoFile.path, audioUrl, outputPath);

    const generatedKey = buildS3Key(
      'video-sync/previews',
      `${song.slug || song._id.toString()}-preview.mp4`,
    );

    await uploadFile({
      key: generatedKey,
      body: fs.createReadStream(outputPath),
      contentType: 'video/mp4',
      isPublic: false,
    });

    await Download.create({
      user: user._id,
      song: song._id,
      fileType: FILE_TYPE.PREVIEW,
      userSubscriptionStatusAtDownload: SUBSCRIPTION_STATUS.PAID,
      ipAddress: ip,
      userAgent,
    });

    const downloadUrl = await getSignedDownloadUrl(generatedKey, 900);

    return {
      downloadUrl,
      fileType: 'preview',
      expiresIn: 900,
      generatedKey,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        userId,
        songId,
      },
      'Video sync preview render failed',
    );
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to render video preview');
  } finally {
    cleanup(videoFile.path);
    cleanup(outputPath);
  }
};
