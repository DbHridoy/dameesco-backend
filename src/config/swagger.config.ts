import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import env from './env.config';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Dameesco Music Platform API',
      version: '1.0.0',
      description:
        'REST API for the Dameesco music/audio platform — users, songs, playlists, downloads, licensing, and admin endpoints.',
      contact: {
        name: 'Dameesco',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [path.join(__dirname, '../modules/**/*.routes.ts')],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);