import { Router, type Request } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { listProvinces, listWards } from '../../../modules/shipping/locations.ts';

export function createLocationRouter(): Router {
  const router = Router();
  router.get('/locations/provinces', (_req, res) => {
    res.json(buildSuccessEnvelope(listProvinces(), requestId(_req)));
  });
  router.get('/locations/provinces/:province_code/wards', (req, res, next) => {
    try { res.json(buildSuccessEnvelope(listWards(req.params.province_code), requestId(req))); }
    catch (error) { next(error); }
  });
  return router;
}

function requestId(req: Request): string { return req.requestId ?? 'req_unknown'; }
