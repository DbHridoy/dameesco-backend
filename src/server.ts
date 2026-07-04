import app from './app';
import env from '@/config/env.config';
import { connectDB } from '@/config/db.config';
import logger from '@/config/logger.config';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    const server = app.listen(env.PORT, () => {
      logger.info(
        `Dameesco API listening on port ${env.PORT} (${env.NODE_ENV})`,
      );
      logger.info(`Swagger docs: http://localhost:${env.PORT}/api-docs`);
    });

    const shutdown = (signal: string) => {
      logger.info(`${signal} received. Shutting down...`);
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled promise rejection');
    });
    process.on('uncaughtException', (err) => {
      logger.error({ err }, 'Uncaught exception');
      process.exit(1);
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      'Failed to start server',
    );
    process.exit(1);
  }
};

void startServer();