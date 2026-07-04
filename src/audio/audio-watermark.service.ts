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
   * How often to repeat the watermark overlay, in seconds.
   * The watermark sound will be mixed in at this interval throughout the song.
   */
  intervalSeconds?: number;
  /**
   * Volume of the watermark relative to the original (0.0 - 1.0).
   */
  watermarkVolume?: number;
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
 * Generates an audible watermarked version of an audio file by overlaying a
 * short watermark tone at regular intervals using FFmpeg's `amix` filter.
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
  const watermarkVolume = options.watermarkVolume ?? 0.15;
  const intervalSeconds = options.intervalSeconds ?? 30;

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

  return new Promise<string>((resolve, reject) => {
    let command = ffmpeg(inputPath);

    if (hasWatermarkAudio) {
      // Overlay the watermark audio, looping it over the entire duration of the original.
      command = command
        .input(watermarkPath)
        .complexFilter([
          `[1:a]aloop=loop=-1:size=1e9,atrim=0:${intervalSeconds * 5}[wm]`,
          `[0:a][wm]amix=inputs=2:duration=first:dropout_transition=0,volume=${watermarkVolume}[mix]`,
        ])
        .outputOptions(['-map [mix]']);
    } else {
      logger.warn(
        'Watermark audio not found at WATERMARK_AUDIO_PATH — applying periodic beeps via sine tone instead.',
      );
      const sineFreq = 880;
      command = command
        .complexFilter([
          `aevalsrc='sin(${sineFreq}*2*PI*t)*if(lt(mod(t,${intervalSeconds}),0.5),1,0)':d=0.3[sine]`,
          `[0:a][sine]amix=inputs=2:duration=first:dropout_transition=0,volume=${watermarkVolume}[mix]`,
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