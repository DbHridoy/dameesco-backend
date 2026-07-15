import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import env from '@/config/env.config';
import logger from '@/config/logger.config';
import { ApiError } from '@/utils/ApiError';

// Optional: set ffmpeg path if provided
if (env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(env.FFMPEG_PATH);
}

export interface WatermarkOptions {
  inputPath: string;
  outputPath: string;
  watermarkAudioPath?: string;
  /**
   * Deprecated. Watermarks are now mixed only once.
   */
  intervalSeconds?: number;
  /**
   * Volume of the watermark relative to the original (0.0 - 1.0).
   */
  watermarkVolume?: number;
  /**
   * Delay before the one-time watermark starts, in seconds.
   */
  watermarkDelaySeconds?: number;
  /**
   * Original track volume while the watermark is playing (0.0 - 1.0).
   */
  watermarkDuckVolume?: number;
}

export interface AudioDurationResult {
  duration: number;
}

const ffprobeDuration = (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format?.duration ?? 0);
    });
  });
};

/**
 * Generates an audible watermarked version of an audio file by overlaying one
 * watermark audio clip using FFmpeg's `amix` filter.
 *
 * This implementation is intentionally isolated so it can be swapped later
 * (e.g. for Cyanite or a more advanced DSP pipeline) without touching callers.
 */
export const generateWatermarkedAudio = async (
  options: WatermarkOptions,
): Promise<string> => {
  const inputPath = options.inputPath;
  const outputPath = options.outputPath;
  const watermarkPath =
    options.watermarkAudioPath ?? env.WATERMARK_AUDIO_PATH;
  const watermarkVolume = options.watermarkVolume ?? 2;
  const watermarkDelayMs = Math.max(
    0,
    Math.round((options.watermarkDelaySeconds ?? env.WATERMARK_DELAY_SECONDS) * 1000),
  );
  const watermarkDuckVolume = Math.min(
    1,
    Math.max(0, options.watermarkDuckVolume ?? env.WATERMARK_DUCK_VOLUME),
  );

  if (!fs.existsSync(inputPath)) {
    throw new ApiError(400, 'Original audio file not found');
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const hasWatermarkAudio =
    !!watermarkPath && fs.existsSync(watermarkPath);
  const watermarkDurationSeconds = hasWatermarkAudio
    ? Math.max(0.5, await getAudioDuration(watermarkPath))
    : 0.5;
  const watermarkStartSeconds = watermarkDelayMs / 1000;
  const watermarkEndSeconds = watermarkStartSeconds + watermarkDurationSeconds;
  const duckOriginalFilter =
    `[0:a]volume=if(between(t\\,${watermarkStartSeconds}\\,${watermarkEndSeconds})\\,${watermarkDuckVolume}\\,1)[music]`;

  return new Promise<string>((resolve, reject) => {
    let command = ffmpeg(inputPath);

    if (hasWatermarkAudio) {
      // Overlay the watermark audio once after the configured delay.
      command = command
        .input(watermarkPath)
        .complexFilter([
          duckOriginalFilter,
          `[1:a]volume=${watermarkVolume},adelay=${watermarkDelayMs}:all=1[wm]`,
          '[music][wm]amix=inputs=2:duration=first:dropout_transition=0[mix]',
        ])
        .outputOptions(['-map [mix]']);
    } else {
      logger.warn(
        'Watermark audio not found at WATERMARK_AUDIO_PATH — applying a single beep tone instead.',
      );
      const sineFreq = 880;
      command = command
        .complexFilter([
          duckOriginalFilter,
          `sine=frequency=${sineFreq}:duration=0.5,volume=${watermarkVolume},adelay=${watermarkDelayMs}:all=1[sine]`,
          '[music][sine]amix=inputs=2:duration=first:dropout_transition=0[mix]',
        ])
        .outputOptions(['-map [mix]']);
    }

    command
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .format('mp3')
      .on('start', (cmdLine) => {
        logger.info({ cmdLine }, 'Watermark FFmpeg started');
      })
      .on('error', (err) => {
        logger.error({ err }, 'Watermark FFmpeg failed');
        reject(new ApiError(500, `Watermark generation failed: ${err.message}`));
      })
      .on('end', () => {
        resolve(outputPath);
      })
      .save(outputPath);
  });
};

/**
 * Generates a short preview clip from the original audio.
 */
export const generatePreviewAudio = async (
  inputPath: string,
  outputPath: string,
  durationSeconds: number = 30,
): Promise<string> => {
  if (!fs.existsSync(inputPath)) {
    throw new ApiError(400, 'Original audio file not found');
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(0)
      .setDuration(durationSeconds)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .on('error', (err) => {
        logger.error({ err }, 'Preview FFmpeg failed');
        reject(new ApiError(500, `Preview generation failed: ${err.message}`));
      })
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
};

export const getAudioDuration = async (
  filePath: string,
): Promise<number> => {
  try {
    return await ffprobeDuration(filePath);
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : error, filePath },
      'Could not read audio duration',
    );
    return 0;
  }
};

// Re-export promisify in case future utilities need it
export { promisify };
