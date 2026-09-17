import { Router, type Request, type Response } from 'express';
import { buildSuccessEnvelope } from '../http/envelope.ts';

export const healthRouter: Router = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  const requestId = req.requestId || 'req_unknown';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(
    buildSuccessEnvelope(
      {
        status: 'ok',
        timestamp: new Date().toISOString()
      },
      requestId
    )
  );
});
