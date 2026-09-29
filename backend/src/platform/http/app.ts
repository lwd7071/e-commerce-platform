import express, { type Application, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { requestIdMiddleware } from './middlewares/request-id.ts';
import { errorHandlerMiddleware } from './middlewares/error-handler.ts';
import { createHealthRouter } from '../routes/health.ts';
import { createCatalogRouter, type T1RouteApplications } from './routes/t1-routes.ts';
import { createBuyerDomainRouter, type BuyerServices } from './routes/buyer-routes.ts';
import { createOrderDomainRouter, type OrderServices } from './routes/order-routes.ts';
import { createAdminRouter } from './routes/admin-routes.ts';
import { createDatabasePool, closeDatabasePool } from '../../../db/client.ts';
import { loadDatabaseConfig } from '../../../db/config.ts';
import { PgAuthRepository } from '../../modules/identity/repositories/pg-auth.repository.ts';
import { SupabaseJwtVerifier } from './middlewares/supabase-jwt.ts';
import { createAuthMiddleware, type ITokenVerifier } from './middlewares/auth.ts';
import { PgCheckoutService } from '../../modules/checkout/services/pg-checkout.service.ts';
import { PgCatalogHttpService } from '../../modules/catalog/services/pg-catalog-http.service.ts';
import { ModerationService } from '../../modules/moderation/services/moderation.service.ts';
import { PgModerationTargetRepository } from '../../modules/moderation/repositories/pg-target.repository.ts';
import { PgAuditRepository } from '../audit/pg-audit.repository.ts';
import { PgTransactionManager } from '../database/pg-transaction-manager.ts';
import type { IAuthRepository } from '../../modules/identity/repositories/auth.repository.ts';
import { PgOnboardingService } from '../../modules/identity/services/pg-onboarding.service.ts';
import { createIdentityRouter } from './routes/identity-routes.ts';
import { PgOrderRepository } from '../../modules/order/repositories/pg-order.repository.ts';
import { OrderQueryService } from '../../modules/order/services/order-query.service.ts';
import { AddressService } from '../../modules/buyer/services/address.service.ts';
import { ProfileService } from '../../modules/buyer/services/profile.service.ts';
import { PostgresAddressRepository } from '../../modules/buyer/infrastructure/postgres-address.repository.ts';
import { PostgresUserProfileRepository } from '../../modules/buyer/infrastructure/postgres-user-profile.repository.ts';
import { PgBuyerHttpService } from '../../modules/buyer/services/pg-buyer-http.service.ts';

import { createSecurityHeadersMiddleware, createCorsMiddleware, type CorsOptions } from './middlewares/security-headers.ts';
import { createLayeredRateLimiter } from './middlewares/rate-limiter.ts';
import { createMetricsMiddleware } from '../observability/metrics-middleware.ts';
import { generateOpenApiSpec } from '../openapi/openapi-spec.ts';

import { validateEnvConfig } from '../config/env-config.ts';
import { AuthConfigurationError } from '../errors/app-error.ts';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export interface PlatformApplications extends T1RouteApplications {
  pool?: Pool;
  buyerServices?: BuyerServices;
  orderServices?: OrderServices;
  authRepository?: IAuthRepository;
  onboardingService?: PgOnboardingService;
  rateLimiter?: RequestHandler | false;
  trustProxy?: boolean | string | number;
  cors?: CorsOptions;
}

export function createApp(applications: PlatformApplications = {}): Application {
  const app = express();

  if (applications.trustProxy !== undefined) {
    app.set('trust proxy', applications.trustProxy);
  }

  app.use(createSecurityHeadersMiddleware());
  app.use(createCorsMiddleware(applications.cors));
  app.use(createMetricsMiddleware());
  app.use(requestIdMiddleware);
  if (applications.rateLimiter !== false) {
    app.use(applications.rateLimiter ?? createLayeredRateLimiter());
  }
  app.use(express.json());

  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(generateOpenApiSpec());
  });

  app.use('/api/v1/health', createHealthRouter(applications.pool));
  const auth = applications.auth;
  app.use('/api/v1', createIdentityRouter(applications.authRepository, applications.onboardingService, auth));
  app.use('/api/v1', createCatalogRouter(applications.catalog, auth));

  const buyerTarget = applications.buyerServices ?? applications.buyer;
  app.use('/api/v1', createBuyerDomainRouter(buyerTarget, auth));

  const orderTarget = applications.orderServices ?? applications.orders;
  app.use('/api/v1', createOrderDomainRouter(orderTarget, auth));

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
export function createRuntimeApp(
  environment: NodeJS.ProcessEnv = process.env,
  runtimeOverrides: { pool?: Pool; tokenVerifier?: ITokenVerifier } = {},
): RuntimeApp {
  const envConfig = validateEnvConfig(environment);
  const config = loadDatabaseConfig(environment);
  const ownsPool = runtimeOverrides.pool === undefined;
  const pool = runtimeOverrides.pool ?? createDatabasePool(config);
  const supabaseUrl = envConfig.supabaseUrl ?? environment.SUPABASE_URL;
  const jwksUrl = envConfig.supabaseJwksUrl ?? environment.SUPABASE_JWKS_URL;
  if (!runtimeOverrides.tokenVerifier && (!supabaseUrl || !jwksUrl)) {
    throw new AuthConfigurationError('SUPABASE_URL and SUPABASE_JWKS_URL are required for runtime auth');
  }
  const authRepository = new PgAuthRepository(pool);
  const onboardingService = new PgOnboardingService(pool);
  const checkoutService = new PgCheckoutService(pool);
  const orderQueryService = new OrderQueryService(new PgOrderRepository(pool), pool);
  const verifier = runtimeOverrides.tokenVerifier ?? new SupabaseJwtVerifier({
    jwksUrl: new URL(jwksUrl!),
    issuer: new URL('/auth/v1', supabaseUrl!).toString().replace(/\/$/, ''),
    audience: envConfig.supabaseJwtAudience ?? 'authenticated',
  });
  return {
    app: createApp({
      pool,
      trustProxy: envConfig.trustProxy,
      cors: { allowedOrigins: envConfig.corsAllowedOrigins },
      auth: createAuthMiddleware(authRepository, verifier),
      authRepository,
      onboardingService,
      catalog: new PgCatalogHttpService(pool),
      buyerServices: {
        legacyHttpApplication: new PgBuyerHttpService(pool),
        addressService: new AddressService(new PostgresAddressRepository(pool)),
        profileService: new ProfileService(new PostgresUserProfileRepository(pool)),
      },
      orderServices: {
        checkoutService,
        orderQueryService,
        cancelOrder: (context, orderId, input) => checkoutService.cancelOrder(context, orderId, input),
        confirmOrder: (context, orderId) => checkoutService.confirmOrder(context, orderId),
        transitionOrder: (context, orderId, input) => checkoutService.transitionOrder(context, orderId, input),
        retryPayment: (context, orderId, input) => checkoutService.retryPayment(context, orderId, input),
      },
      moderation: new ModerationService(
        new PgModerationTargetRepository(pool),
        new PgAuditRepository(pool),
        new PgTransactionManager(pool)
      ),
    }),
    close: () => ownsPool ? closeDatabasePool(pool) : Promise.resolve(),
  };
}
