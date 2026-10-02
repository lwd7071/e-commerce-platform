import express, { type Application, type RequestHandler } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Pool } from 'pg';
import { requestIdMiddleware } from './middlewares/request-id.ts';
import { errorHandlerMiddleware } from './middlewares/error-handler.ts';
import { createHealthRouter } from '../routes/health.ts';
import { createLocationRouter } from './routes/location-routes.ts';
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
import { GhtkFeeProvider, MockFeeProvider } from '../../modules/shipping/providers.ts';
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
import { LoyaltyService } from '../../modules/loyalty/services/loyalty.service.ts';
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
import { createFlashSaleRouter } from '../../modules/flash-sale/routes/flash-sale.routes.ts';
import { FlashSaleService } from '../../modules/flash-sale/services/flash-sale.service.ts';
import { PgFlashSaleRepository } from '../../modules/flash-sale/repositories/pg-flash-sale.repository.ts';
import { getRedisClient } from '../../modules/flash-sale/infrastructure/redis.client.ts';
import { PgWalletRepository } from '../../modules/wallet/repositories/pg-wallet.repository.ts';
import { EscrowService } from '../../modules/wallet/services/escrow.service.ts';
import { ShopWalletService } from '../../modules/wallet/services/shop-wallet.service.ts';
import { AdminFinanceService } from '../../modules/wallet/services/admin-finance.service.ts';
import { PayosService } from '../../modules/wallet/services/payos.service.ts';
import { createSellerWalletRouter } from './routes/seller-wallet-routes.ts';
import { createAdminFinanceRouter } from './routes/admin-finance-routes.ts';
import { createPayosPaymentRouter } from './routes/payos-payment-routes.ts';

import { createSecurityHeadersMiddleware, createCorsMiddleware, type CorsOptions } from './middlewares/security-headers.ts';
import { createLayeredRateLimiter } from './middlewares/rate-limiter.ts';
import { createMetricsMiddleware } from '../observability/metrics-middleware.ts';
import { generateOpenApiSpec } from '../openapi/openapi-spec.ts';
import { createChatRouter } from './routes/chat-routes.ts';
import { PgChatService } from '../../modules/chat/services/pg-chat.service.ts';

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
  sellerWallet?: ShopWalletService;
  adminFinance?: AdminFinanceService;
  payosService?: PayosService;
  escrowService?: EscrowService;
  adminCampaigns?: AdminNotificationCampaignService;
  chatService?: PgChatService;
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
  app.use('/api/v1', createLocationRouter());
  const auth = applications.auth;
  app.use('/api/v1', createIdentityRouter(applications.authRepository, applications.onboardingService, auth));
  app.use('/api/v1', createCatalogRouter(applications.catalog, auth));
  app.use('/api/v1', createSellerShopRouter(applications.sellerShop, auth));
  app.use('/api/v1', createSellerAnalyticsRouter(applications.sellerKpi, auth));
  app.use('/api/v1', createSellerVoucherRouter(applications.sellerVouchers, auth));
  app.use('/api/v1', createSellerReportingRouter(applications.sellerRevenue, auth));
  app.use('/api/v1', createSellerWalletRouter(applications.sellerWallet, auth));
  app.use('/api/v1', createAdminFinanceRouter(applications.adminFinance, auth));
  app.use('/api/v1', createPayosPaymentRouter(applications.pool, applications.payosService, applications.escrowService, auth));

  const chatService = applications.chatService ?? (applications.pool ? new PgChatService(applications.pool) : undefined);
  app.use('/api/v1', createChatRouter(chatService, auth));

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

  if (applications.pool) {
    const flashSaleRepo = new PgFlashSaleRepository(applications.pool);
    const flashSaleService = new FlashSaleService(applications.pool, getRedisClient());
    app.use('/api/v1/flash-sales', createFlashSaleRouter(flashSaleService, flashSaleRepo));
  }

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
  const shippingFeeProvider = envConfig.shippingProvider === 'ghtk'
    ? new GhtkFeeProvider({ baseUrl: envConfig.ghtkApiBaseUrl, token: envConfig.ghtkApiToken! })
    : new MockFeeProvider();
  const loyaltyService = new LoyaltyService(pool);
  const checkoutService = new PgCheckoutService(pool, undefined, shippingFeeProvider, loyaltyService);
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
  const walletRepo = new PgWalletRepository(pool);
  const escrowService = new EscrowService(walletRepo);
  const shopWallet = new ShopWalletService(walletRepo);
  const adminFinance = new AdminFinanceService(walletRepo);
  const payosService = new PayosService({
    clientId: process.env.PAYOS_CLIENT_ID || '0cc855e6-ed8b-4eb5-a5a9-f5a4cee21208',
    apiKey: process.env.PAYOS_API_KEY || '61bf9bfc-9aca-4729-ae1d-458a26e2f121',
    checksumKey: process.env.PAYOS_CHECKSUM_KEY || '6083ce0b91cc434588afe5ce44becee7d71e1d4a5a426828cde6a77c43f214a9',
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
      sellerWallet: shopWallet,
      adminFinance,
      payosService,
      escrowService,
      catalog: new PgCatalogHttpService(pool),
      chatService: new PgChatService(pool),
      buyerServices: {
        legacyHttpApplication: new PgBuyerHttpService(pool),
        addressService: new AddressService(new PostgresAddressRepository(pool)),
        profileService: new ProfileService(new PostgresUserProfileRepository(pool)),
        loyaltyService,
        reviewService,
        notificationService,
      },
      orderServices: {
        checkoutService,
        orderQueryService,
        cancelOrder: async (context, orderId, input) => {
          const res = await checkoutService.cancelOrder(context, orderId, input);
          try { await escrowService.refundEscrow(orderId); } catch { /* ignore if not exists */ }
          return res;
        },
        confirmOrder: (context, orderId, reason) => checkoutService.confirmOrder(context, orderId, reason),
        confirmReceived: async (context, orderId, reason) => {
          const result = await checkoutService.confirmReceived(context, orderId, reason);
          try { await escrowService.settleEscrow(orderId); } catch (e) { console.error('[Escrow Auto-Settle]:', e); }
          return result;
        },
        transitionOrder: async (context, orderId, input) => {
          const result = await checkoutService.transitionOrder(context, orderId, input);
          if (input?.to === 'COMPLETED') {
            try { await escrowService.settleEscrow(orderId); } catch (e) { console.error('[Escrow Auto-Settle]:', e); }
          } else if (input?.to === 'CANCELLED') {
            try { await escrowService.refundEscrow(orderId); } catch (e) { console.error('[Escrow Auto-Refund]:', e); }
          }
          return result;
        },
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
