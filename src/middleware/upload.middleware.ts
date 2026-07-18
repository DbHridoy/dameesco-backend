import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { ApiError } from '@/utils/ApiError';

const tmpDir = path.resolve(process.cwd(), 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const audioFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const allowedMime = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/x-flac',
    'audio/aac',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
  ];
  const allowedExt = /\.(mp3|wav|flac|aac|m4a|ogg)$/i;
  if (allowedMime.includes(file.mimetype) || allowedExt.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only audio files are allowed'));
  }
};

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const allowedMime = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
  ];
  const allowedExt = /\.(jpg|jpeg|png|webp)$/i;
  if (allowedMime.includes(file.mimetype) || allowedExt.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image files are allowed'));
  }
};

const documentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const allowedMime = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/pdf',
  ];
  const allowedExt = /\.(jpg|jpeg|png|webp|pdf)$/i;
  if (allowedMime.includes(file.mimetype) || allowedExt.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image or PDF files are allowed'));
  }
};

const videoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const allowedMime = [
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',
  ];
  const allowedExt = /\.(mp4|mov|webm|avi)$/i;
  if (allowedMime.includes(file.mimetype) || allowedExt.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only video files are allowed'));
  }
};

export const uploadAudio = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

export const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const uploadDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const uploadVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});
