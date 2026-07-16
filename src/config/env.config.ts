import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optional = (key: string, fallback: string = ''): string => {
  return process.env[key] ?? fallback;
};

const env = {
  PORT: parseInt(optional('PORT', '5000'), 10),
  NODE_ENV: optional('NODE_ENV', 'development'),

  MONGODB_URI: required('MONGODB_URI', 'mongodb://localhost:27017/dameesco'),

  JWT_ACCESS_SECRET: required(
    'JWT_ACCESS_SECRET',
    'dev_access_secret_change_me',
  ),
  JWT_REFRESH_SECRET: required(
    'JWT_REFRESH_SECRET',
    'dev_refresh_secret_change_me',
  ),
  JWT_ACCESS_EXPIRES_IN: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  BCRYPT_SALT_ROUNDS: parseInt(optional('BCRYPT_SALT_ROUNDS', '10'), 10),

  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:3000'),

  ADMIN_EMAIL: optional('ADMIN_EMAIL', 'admin@dameesco.com'),
  ADMIN_PASSWORD: optional('ADMIN_PASSWORD', 'ChangeMe123!'),

  AWS_ACCESS_KEY_ID: optional('AWS_ACCESS_KEY_ID', ''),
  AWS_SECRET_ACCESS_KEY: optional('AWS_SECRET_ACCESS_KEY', ''),
  AWS_REGION: optional('AWS_REGION', 'us-east-1'),
  AWS_S3_BUCKET_NAME: optional('AWS_S3_BUCKET_NAME', ''),
  AWS_S3_PUBLIC_BUCKET_URL: optional('AWS_S3_PUBLIC_BUCKET_URL', ''),

  RESEND_API_KEY: optional('RESEND_API_KEY', ''),
  RESEND_FROM_NAME: optional('RESEND_FROM_NAME', 'SUNAR'),
  RESEND_FROM_EMAIL: optional('RESEND_FROM_EMAIL', 'no-reply@sunarmusic.ai'),
  RESEND_FROM: optional('RESEND_FROM', ''),

  SMTP_HOST: optional('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: parseInt(optional('SMTP_PORT', '587'), 10),
  SMTP_USER: optional('SMTP_USER', ''),
  SMTP_PASS: optional('SMTP_PASS', ''),
  SMTP_FROM: optional('SMTP_FROM', 'Dameesco <no-reply@dameesco.com>'),

  FFMPEG_PATH: optional('FFMPEG_PATH', '/usr/bin/ffmpeg'),
  WATERMARK_AUDIO_PATH: optional(
    'WATERMARK_AUDIO_PATH',
    './assets/watermark.wav',
  ),
  WATERMARK_DELAY_SECONDS: parseFloat(optional('WATERMARK_DELAY_SECONDS', '10')),
  WATERMARK_DUCK_VOLUME: parseFloat(optional('WATERMARK_DUCK_VOLUME', '0')),

  CYANITE_WEBHOOK_SECRET: optional('CYANITE_WEBHOOK_SECRET', ''),
} as const;

export default env;
