import express, { type Application } from 'express';
import { requestIdMiddleware } from './middlewares/request-id.ts';
import { errorHandlerMiddleware } from './middlewares/error-handler.ts';
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

  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
