import ffmpeg from 'fluent-ffmpeg';
import env from '@/config/env.config';
import logger from '@/config/logger.config';
import { ApiError } from '@/utils/ApiError';

if (env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(env.FFMPEG_PATH);
}

export interface AudioMetadata {
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  format: string;
  codec: string;
}

/**
 * Lightweight wrapper around FFprobe for extracting basic audio metadata.
 *
 * NOTE: This service is intentionally pluggable. In the future we can plug in
 * Cyanite AI or other audio analysis providers for richer tagging (BPM, key,
 * mood, etc.) without changing callers.
 */
export const extractAudioMetadata = (
  filePath: string,
): Promise<AudioMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        logger.error({ err, filePath }, 'ffprobe failed');
        reject(new ApiError(500, 'Failed to read audio metadata'));
        return;
      }
      const audioStream = data.streams.find((s) => s.codec_type === 'audio');
      if (!audioStream) {
        reject(new ApiError(400, 'No audio stream found in file'));
        return;
      }
      resolve({
        duration: data.format?.duration ?? 0,
        bitrate: data.format?.bit_rate
          ? Number(data.format.bit_rate)
          : 0,
        sampleRate: audioStream.sample_rate
          ? Number(audioStream.sample_rate)
          : 0,
        channels: audioStream.channels ?? 0,
        format: data.format?.format_name ?? '',
        codec: audioStream.codec_name ?? '',
      });
    });
  });
};