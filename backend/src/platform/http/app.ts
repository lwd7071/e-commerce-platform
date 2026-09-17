import express from 'express';

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());
  return app;
}

export const app = createApp();
