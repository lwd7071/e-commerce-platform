import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { IAuthRepository } from '../../../modules/identity/repositories/auth.repository.ts';
import type { PgOnboardingService } from '../../../modules/identity/services/pg-onboarding.service.ts';

const context = (req: Request): RequestContext => {
  if (!req.context) throw new UnauthorizedError();
  return req.context;
};

const asyncRoute = (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => { void handler(req, res, next).catch(next); };

export function createIdentityRouter(
  authRepo?: IAuthRepository,
  onboardingService?: PgOnboardingService,
  auth?: RequestHandler,
) {
  const router = Router();
  const protectedByAuth = auth ? [auth] : [];

  router.get('/auth/me', ...protectedByAuth, asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!authRepo) throw new Error('Auth repository is not configured');
    const user = await authRepo.findUserById(ctx.user_id);
    if (!user) throw new UnauthorizedError('AUTH_INVALID_TOKEN', 'Authenticated user is not provisioned');
    res.json(buildSuccessEnvelope({
      user_id: user.id,
      email: user.email,
      role: user.role,
      profile_completed: (await onboardingService?.isProfileCompleted(user.id)) ?? false,
      shop_id: ctx.role === 'SELLER' ? ctx.shop_id ?? null : null,
      shop_status: ctx.role === 'SELLER' ? ctx.shop_status ?? null : null,
    }, req.requestId ?? 'req_unknown'));
  }));

  router.post('/auth/onboarding', ...protectedByAuth, asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!onboardingService) throw new Error('Onboarding service is not configured');
    if (ctx.role !== 'BUYER' && ctx.role !== 'SELLER') throw new ForbiddenError('ROLE_REQUIRED', 'Only Buyer or Seller onboarding is allowed');
    const result = await onboardingService.completeOnboarding(ctx.user_id, req.body);
    res.status(200).json(buildSuccessEnvelope(result, req.requestId ?? 'req_unknown'));
  }));

  return router;
}
