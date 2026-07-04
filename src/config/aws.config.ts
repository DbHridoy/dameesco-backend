import { S3Client } from '@aws-sdk/client-s3';
import env from './env.config';

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const S3_CONFIG = {
  bucket: env.AWS_S3_BUCKET_NAME,
  region: env.AWS_REGION,
  publicUrl: env.AWS_S3_PUBLIC_BUCKET_URL,
  signedUrlExpiresIn: 60 * 15, // 15 minutes
};