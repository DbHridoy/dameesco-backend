import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import env from '@/config/env.config';
import { connectDB, disconnectDB } from '@/config/db.config';
import User from '@/modules/users/user.model';
import { USER_ROLES } from '@/constants/roles';
import logger from '@/config/logger.config';

const seedAdmin = async (): Promise<void> => {
  try {
    await connectDB();

    const email = env.ADMIN_EMAIL.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing) {
      logger.info(`Admin user already exists: ${email}`);
      existing.password = await bcrypt.hash(
        env.ADMIN_PASSWORD,
        env.BCRYPT_SALT_ROUNDS,
      );
      if (existing.role !== USER_ROLES.ADMIN) {
        existing.role = USER_ROLES.ADMIN;
        logger.info(`Promoted existing user to ADMIN: ${email}`);
      }
      existing.emailVerified = true;
      await existing.save();
      logger.info(`Admin credentials synced: ${email}`);
      await disconnectDB();
      return;
    }

    const hashed = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);
    await User.create({
      name: 'Admin',
      email,
      password: hashed,
      role: USER_ROLES.ADMIN,
      emailVerified: true,
    });

    logger.info(`Admin user created: ${email}`);
    await disconnectDB();
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      'Admin seed failed',
    );
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

void seedAdmin();
