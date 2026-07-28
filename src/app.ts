import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import env from '@/config/env.config';
import { swaggerSpec } from '@/config/swagger.config';
import { generalRateLimiter } from '@/middleware/rate-limit.middleware';
import { errorHandler, notFoundHandler } from '@/middleware/error.middleware';
import routes from '@/routes';

const app: Application = express();

const corsOrigins =
  env.CORS_ORIGINS.trim() === '*'
    ? true
    : env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

// Security & utility middleware
app.use(helmet());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(compression());
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Global rate limiter
app.use(generalRateLimiter);

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// API
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Dameesco API is running',
    docs: '/api-docs',
    version: '1.0.0',
  });
});

app.use('/api/v1', routes);

// 404 + error
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
