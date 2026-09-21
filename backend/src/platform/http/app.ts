import express, { type Application } from 'express';
import { requestIdMiddleware } from './middlewares/request-id.ts';
import { errorHandlerMiddleware } from './middlewares/error-handler.ts';
import { healthRouter } from '../routes/health.ts';
import { createBuyerRouter, createCatalogRouter, createOrderRouter, type T1RouteApplications } from './routes/t1-routes.ts';
import { createAdminRouter } from './routes/admin-routes.ts';
import { createDatabasePool, closeDatabasePool } from '../../../db/client.ts';
import { loadDatabaseConfig } from '../../../db/config.ts';
import { PgAuthRepository } from '../../modules/identity/repositories/pg-auth.repository.ts';
import { SupabaseJwtVerifier } from './middlewares/supabase-jwt.ts';
import { createAuthMiddleware } from './middlewares/auth.ts';
import { PgBuyerHttpService } from '../../modules/buyer/services/pg-buyer-http.service.ts';
import { PgCheckoutService } from '../../modules/checkout/services/pg-checkout.service.ts';
import { PgCatalogHttpService } from '../../modules/catalog/services/pg-catalog-http.service.ts';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function createApp(applications: T1RouteApplications = {}): Application {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(express.json());

  app.use('/api/v1/health', healthRouter);
  const auth = applications.auth;
  app.use('/api/v1', createCatalogRouter(applications.catalog, auth));
  app.use('/api/v1', createBuyerRouter(applications.buyer, auth));
  app.use('/api/v1', createOrderRouter(applications.orders, auth));
  app.use('/api/v1', createAdminRouter(applications.moderation, auth));

  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();

export interface RuntimeApp {
  app: Application;
  close(): Promise<void>;
}

/** Runtime composition: one pool, one auth repository and a non-stub JWT verifier. */
export function createRuntimeApp(environment: NodeJS.ProcessEnv = process.env): RuntimeApp {
  const config = loadDatabaseConfig(environment);
  const pool = createDatabasePool(config);
  const supabaseUrl = environment.SUPABASE_URL;
  const jwksUrl = environment.SUPABASE_JWKS_URL;
  if (!supabaseUrl || !jwksUrl) {
    throw new Error('SUPABASE_URL and SUPABASE_JWKS_URL are required for runtime auth');
  }
  const authRepository = new PgAuthRepository(pool);
  const verifier = new SupabaseJwtVerifier({
    jwksUrl: new URL(jwksUrl),
    issuer: new URL('/auth/v1', supabaseUrl).toString().replace(/\/$/, ''),
    audience: environment.SUPABASE_JWT_AUDIENCE ?? 'authenticated',
  });
  return {
    app: createApp({
      auth: createAuthMiddleware(authRepository, verifier),
      catalog: new PgCatalogHttpService(pool),
      buyer: new PgBuyerHttpService(pool),
      orders: new PgCheckoutService(pool),
    }),
    close: () => closeDatabasePool(pool),
  };
}
