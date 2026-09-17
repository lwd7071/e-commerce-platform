import express, { type Application } from 'express';
import { requestIdMiddleware } from './middlewares/request-id.ts';
import { healthRouter } from '../routes/health.ts';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function createApp(): Application {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(express.json());

  app.use('/api/v1/health', healthRouter);

  return app;
}

export const app = createApp();
