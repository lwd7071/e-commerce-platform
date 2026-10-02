import express, { type Application, type RequestHandler } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Pool } from 'pg';
import { requestIdMiddleware } from './middlewares/request-id.ts';
import { errorHandlerMiddleware } from './middlewares/error-handler.ts';
import { createHealthRouter } from '../routes/health.ts';
import { createCatalogRouter, type T1RouteApplications } from './routes/t1-routes.ts';
import { createBuyerDomainRouter, type BuyerServices } from './routes/buyer-routes.ts';
import { createOrderDomainRouter, type OrderServices } from './routes/order-routes.ts';
import { createAdminRouter } from './routes/admin-routes.ts';
import { createMediaRouter } from './routes/media-routes.ts';
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
import { PostgresReviewRepository } from '../../modules/buyer/infrastructure/postgres-review.repository.ts';
import { PostgresNotificationRepository } from '../../modules/buyer/infrastructure/postgres-notification.repository.ts';
import { ReviewService } from '../../modules/buyer/services/review.service.ts';
import { NotificationService } from '../../modules/buyer/services/notification.service.ts';
import { InMemoryTransactionEventPort } from '../../modules/buyer/ports/buyer-event.port.ts';
import { PgBuyerHttpService } from '../../modules/buyer/services/pg-buyer-http.service.ts';
import { createSellerShopRouter } from './routes/seller-shop-routes.ts';
import { SellerShopService } from '../../modules/shop/services/seller-shop.service.ts';
import { PgSellerShopRepository } from '../../modules/shop/repositories/pg-seller-shop.repository.ts';
import { createSellerAnalyticsRouter } from './routes/seller-analytics-routes.ts';
import { SellerKpiService } from '../../modules/reporting/services/seller-kpi.service.ts';
import { PgSellerKpiRepository } from '../../modules/reporting/repositories/pg-seller-kpi.repository.ts';
import { createSellerVoucherRouter } from './routes/seller-voucher-routes.ts';
import { SellerVoucherService } from '../../modules/voucher/services/seller-voucher.service.ts';
import { PgSellerVoucherRepository } from '../../modules/voucher/repositories/pg-seller-voucher.repository.ts';
import { createSellerReportingRouter } from './routes/seller-reporting-routes.ts';
import { SellerRevenueService } from '../../modules/reporting/services/seller-revenue.service.ts';
import { ReportingService } from '../../modules/reporting/services/reporting.service.ts';
import { AdminReadService } from '../../modules/moderation/services/admin-read.service.ts';
import { AdminVoucherService } from '../../modules/voucher/services/admin-voucher.service.ts';
import { AdminNotificationCampaignService } from '../../modules/moderation/services/admin-notification-campaign.service.ts';

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
  mediaStorage?: SupabaseClient;
  buyerServices?: BuyerServices;
  orderServices?: OrderServices;
  authRepository?: IAuthRepository;
  onboardingService?: PgOnboardingService;
  sellerShop?: Pick<SellerShopService, 'get' | 'update'>;
  sellerKpi?: Pick<SellerKpiService, 'get'>;
  sellerVouchers?: Pick<SellerVoucherService, 'list' | 'get' | 'create' | 'update' | 'setStatus'>;
  sellerRevenue?: Pick<SellerRevenueService, 'get'>;
  adminCampaigns?: AdminNotificationCampaignService;
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
  app.use('/api/v1', createSellerShopRouter(applications.sellerShop, auth));
  app.use('/api/v1', createSellerAnalyticsRouter(applications.sellerKpi, auth));
  app.use('/api/v1', createSellerVoucherRouter(applications.sellerVouchers, auth));
  app.use('/api/v1', createSellerReportingRouter(applications.sellerRevenue, auth));

  const buyerTarget = applications.buyerServices ?? applications.buyer;
  app.use('/api/v1', createBuyerDomainRouter(buyerTarget, auth));

  const orderTarget = applications.orderServices ?? applications.orders;
  app.use('/api/v1', createOrderDomainRouter(orderTarget, auth));

  const orderServices = applications.orderServices ?? applications.orders;
  const adminOrderQueries = orderServices && 'orderQueryService' in orderServices ? orderServices.orderQueryService : undefined;
  app.use('/api/v1', createAdminRouter(applications.moderation, auth, applications.catalog, applications.pool ? new AdminReadService(applications.pool) : undefined, applications.pool ? new AdminVoucherService(applications.pool) : undefined, applications.adminCampaigns, adminOrderQueries, orderServices?.transitionOrder));
  app.use('/api/v1', createMediaRouter(
    auth,
    applications.pool && applications.mediaStorage
      ? { pool: applications.pool, storage: applications.mediaStorage }
      : undefined,
  ));

  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();

export interface RuntimeApp {
  app: Application;
  eventPort?: InMemoryTransactionEventPort;
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
  const supabaseSecretKey = environment.SUPABASE_SECRET_KEY;
  const jwksUrl = envConfig.supabaseJwksUrl ?? environment.SUPABASE_JWKS_URL;
  if (!runtimeOverrides.tokenVerifier && (!supabaseUrl || !jwksUrl)) {
    throw new AuthConfigurationError('SUPABASE_URL and SUPABASE_JWKS_URL are required for runtime auth');
  }
  if (environment.NODE_ENV === 'production' && (!supabaseUrl || !supabaseSecretKey)) {
    throw new AuthConfigurationError('SUPABASE_URL and SUPABASE_SECRET_KEY are required for runtime media storage');
  }
  const mediaStorage = supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : undefined;
  const authRepository = new PgAuthRepository(pool);
  const onboardingService = new PgOnboardingService(pool);
  const checkoutService = new PgCheckoutService(pool);
  const orderQueryService = new OrderQueryService(new PgOrderRepository(pool), pool);
  const sharedEventPort = new InMemoryTransactionEventPort();
  const reviewService = new ReviewService(new PostgresReviewRepository(pool, supabaseUrl), orderQueryService);
  const notificationService = new NotificationService(new PostgresNotificationRepository(pool), sharedEventPort, orderQueryService);
  const adminCampaigns = new AdminNotificationCampaignService(pool);
  const stopAdminCampaignWorker = adminCampaigns.startWorker();
  const verifier = runtimeOverrides.tokenVerifier ?? new SupabaseJwtVerifier({
    jwksUrl: new URL(jwksUrl!),
    issuer: new URL('/auth/v1', supabaseUrl!).toString().replace(/\/$/, ''),
    audience: envConfig.supabaseJwtAudience ?? 'authenticated',
  });
  return {
    app: createApp({
      pool,
      adminCampaigns,
      mediaStorage,
      trustProxy: envConfig.trustProxy,
      cors: { allowedOrigins: envConfig.corsAllowedOrigins },
      auth: createAuthMiddleware(authRepository, verifier),
      authRepository,
      onboardingService,
      sellerShop: new SellerShopService(new PgSellerShopRepository(pool)),
      sellerKpi: new SellerKpiService(new PgSellerKpiRepository(pool)),
      sellerVouchers: new SellerVoucherService(new PgSellerVoucherRepository(pool)),
      sellerRevenue: new SellerRevenueService(new ReportingService({ orderRepo: new PgOrderRepository(pool) })),
      catalog: new PgCatalogHttpService(pool),
      buyerServices: {
        legacyHttpApplication: new PgBuyerHttpService(pool),
        addressService: new AddressService(new PostgresAddressRepository(pool)),
        profileService: new ProfileService(new PostgresUserProfileRepository(pool)),
        reviewService,
        notificationService,
      },
      orderServices: {
        checkoutService,
        orderQueryService,
        cancelOrder: (context, orderId, input) => checkoutService.cancelOrder(context, orderId, input),
        confirmOrder: (context, orderId, reason) => checkoutService.confirmOrder(context, orderId, reason),
        transitionOrder: (context, orderId, input) => checkoutService.transitionOrder(context, orderId, input),
        retryPayment: (context, orderId, input) => checkoutService.retryPayment(context, orderId, input),
      },
      moderation: new ModerationService(
        new PgModerationTargetRepository(pool),
        new PgAuditRepository(pool),
        new PgTransactionManager(pool)
      ),
    }),
    eventPort: sharedEventPort,
    close: async () => { stopAdminCampaignWorker(); if (ownsPool) await closeDatabasePool(pool); },
  };
}
