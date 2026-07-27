import mongoose from 'mongoose';
import env from './env.config';
import logger from './logger.config';
import { ensureSongTextIndex } from '@/modules/songs/song.model';

export const connectDB = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(env.MONGODB_URI);
    await ensureSongTextIndex();
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      'MongoDB connection error',
    );
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};
