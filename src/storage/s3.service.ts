import { Readable } from 'stream';
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_CONFIG } from '@/config/aws.config';
import env from '@/config/env.config';
import { ApiError } from '@/utils/ApiError';
import logger from '@/config/logger.config';

export interface UploadFileOptions {
  key: string;
  body: Buffer | Readable | string;
  contentType?: string;
  isPublic?: boolean;
}

const ensureBucket = (): string => {
  if (!S3_CONFIG.bucket) {
    throw new ApiError(500, 'AWS S3 bucket is not configured');
  }
  return S3_CONFIG.bucket;
};

export const uploadFile = async (
  options: UploadFileOptions,
): Promise<{ key: string; url: string }> => {
  const bucket = ensureBucket();
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
        ACL: options.isPublic ? 'public-read' : undefined,
      }),
    );

    return {
      key: options.key,
      url: options.isPublic
        ? getPublicUrl(options.key)
        : await getSignedDownloadUrl(options.key),
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error, key: options.key },
      'S3 upload failed',
    );
    throw new ApiError(500, 'Failed to upload file to storage');
  }
};

export const deleteFile = async (key: string): Promise<void> => {
  const bucket = ensureBucket();
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error, key },
      'S3 delete failed',
    );
    throw new ApiError(500, 'Failed to delete file from storage');
  }
};

export const getSignedDownloadUrl = async (
  key: string,
  expiresIn: number = S3_CONFIG.signedUrlExpiresIn,
): Promise<string> => {
  const bucket = ensureBucket();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
};

export const getPublicUrl = (key: string): string => {
  if (S3_CONFIG.publicUrl) {
    return `${S3_CONFIG.publicUrl.replace(/\/$/, '')}/${key}`;
  }
  if (!S3_CONFIG.bucket) return '';
  return `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
};

export const buildS3Key = (
  folder: string,
  filename: string,
): string => {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${Date.now()}-${safeName}`;
};

export const isS3Configured = (): boolean => {
  return Boolean(
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && S3_CONFIG.bucket,
  );
};