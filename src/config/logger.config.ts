import pino from 'pino';
import env from './env.config';

const isDev = env.NODE_ENV === 'development';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: { service: 'dameesco-backend' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordResetOtp',
    ],
    censor: '[REDACTED]',
  },
});

export default logger;