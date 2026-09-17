import type { Request, Response, NextFunction } from 'express';
import type { IAuthRepository } from '../../../modules/identity/repositories/auth.repository.ts';
import { createRequestContext, type RequestContext } from '../../context/request-context.ts';
import {
  UnauthorizedError,
  UserLockedError,
  AuthConfigurationError
} from '../../errors/app-error.ts';

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export interface TokenPayload {
  userId: string;
}

export interface ITokenVerifier {
  verifyToken(token: string): Promise<TokenPayload>;
}

export class StubTokenVerifier implements ITokenVerifier {
  public async verifyToken(token: string): Promise<TokenPayload> {
    if (!token || !token.startsWith('stub-token-')) {
      throw new UnauthorizedError('AUTH_INVALID_TOKEN', 'Invalid or malformed Bearer token');
    }
    const userId = token.replace('stub-token-', '').trim();
    if (!userId) {
      throw new UnauthorizedError('AUTH_INVALID_TOKEN', 'Token does not contain valid user identifier');
    }
    return { userId };
  }
}

export function createAuthMiddleware(
  authRepo: IAuthRepository,
  tokenVerifier: ITokenVerifier = new StubTokenVerifier()
) {
  // Fail-fast in production if stub verifier is attempted to be used
  if (process.env.NODE_ENV === 'production' && tokenVerifier instanceof StubTokenVerifier) {
    throw new AuthConfigurationError(
      'StubTokenVerifier cannot be used in production environment. Live Supabase JWT Verifier must be configured.'
    );
  }

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required. Missing Bearer token.');
      }

      const token = authHeader.substring(7).trim();
      if (!token) {
        throw new UnauthorizedError('AUTH_INVALID_TOKEN', 'Bearer token is empty.');
      }

      const payload = await tokenVerifier.verifyToken(token);
      const user = await authRepo.findUserById(payload.userId);

      if (!user) {
        throw new UnauthorizedError('AUTH_INVALID_TOKEN', 'User corresponding to token was not found.');
      }

      // Enforce QD03 & auth-rbac-rls.md: LOCKED user is rejected at all protected endpoints
      if (user.status === 'LOCKED') {
        throw new UserLockedError('User account is locked');
      }

      let shopId: string | undefined = undefined;
      if (user.role === 'SELLER') {
        const foundShop = await authRepo.findShopByOwnerId(user.id);
        shopId = foundShop || undefined;
      }

      const requestId = req.requestId || 'req_unknown';

      req.context = createRequestContext({
        request_id: requestId,
        user_id: user.id,
        role: user.role,
        shop_id: shopId
      });

      next();
    } catch (err) {
      next(err);
    }
  };
}
