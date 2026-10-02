import { AuthConfigurationError, AppError } from '../errors/app-error.ts';

export interface ValidatedEnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseJwksUrl?: string;
  supabaseJwtAudience?: string;
  corsAllowedOrigins: string[];
  trustProxy?: boolean | string | number;
  shippingProvider: 'mock' | 'ghtk';
  ghtkApiBaseUrl: string;
  ghtkApiToken?: string;
}

export function validateEnvConfig(environment: NodeJS.ProcessEnv = process.env): ValidatedEnvConfig {
  const nodeEnv = environment.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const port = parseInt(environment.PORT || '3001', 10);
  const databaseUrl = environment.DATABASE_URL;
  const supabaseUrl = environment.SUPABASE_URL;
  const supabaseJwksUrl = environment.SUPABASE_JWKS_URL;
  const supabaseJwtAudience = environment.SUPABASE_JWT_AUDIENCE || 'authenticated';
  const rawCorsOrigins = environment.CORS_ALLOWED_ORIGINS;
  const shippingProvider = environment.SHIPPING_PROVIDER?.trim().toLowerCase() || 'mock';
  if (shippingProvider !== 'mock' && shippingProvider !== 'ghtk') {
    throw new AppError(500, 'CONFIGURATION_ERROR', 'SHIPPING_PROVIDER must be mock or ghtk');
  }
  const ghtkApiBaseUrl = environment.GHTK_API_BASE_URL?.trim() || 'https://services.giaohangtietkiem.vn';
  const ghtkApiToken = environment.GHTK_API_TOKEN?.trim();
  if (shippingProvider === 'ghtk') {
    let baseUrl: URL;
    try { baseUrl = new URL(ghtkApiBaseUrl); } catch { throw new AppError(500, 'CONFIGURATION_ERROR', 'GHTK_API_BASE_URL must be a valid HTTPS URL'); }
    if (baseUrl.protocol !== 'https:' || !ghtkApiToken) {
      throw new AppError(500, 'CONFIGURATION_ERROR', 'GHTK_API_BASE_URL must use HTTPS and GHTK_API_TOKEN is required when SHIPPING_PROVIDER=ghtk');
    }
  }
  const corsAllowedOrigins = rawCorsOrigins === undefined || rawCorsOrigins.trim() === ''
    ? (isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'])
    : rawCorsOrigins.split(',').map(origin => origin.trim()).filter(Boolean).map(origin => {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new AppError(500, 'CONFIGURATION_ERROR', `Invalid origin in CORS_ALLOWED_ORIGINS: ${origin}`);
      }
      if (parsed.origin !== origin || (isProduction && parsed.protocol !== 'https:')) {
        throw new AppError(500, 'CONFIGURATION_ERROR', `CORS_ALLOWED_ORIGINS must contain exact origins${isProduction ? ' using HTTPS' : ''}: ${origin}`);
      }
      return parsed.origin;
    });

  const rawTrustProxy = environment.TRUST_PROXY;
  let trustProxy: boolean | string | number | undefined;
  if (rawTrustProxy !== undefined && rawTrustProxy.trim() !== '') {
    if (rawTrustProxy.toLowerCase() === 'true') {
      trustProxy = true;
    } else if (rawTrustProxy.toLowerCase() === 'false') {
      trustProxy = false;
    } else if (!isNaN(Number(rawTrustProxy))) {
      trustProxy = Number(rawTrustProxy);
    } else {
      trustProxy = rawTrustProxy;
    }
  }

  if (isProduction) {
    if (corsAllowedOrigins.length === 0) {
      throw new AppError(500, 'CONFIGURATION_ERROR', 'CORS_ALLOWED_ORIGINS is required in production environment');
    }
    if (!databaseUrl) {
      throw new AppError(
        500,
        'DATABASE_CONFIGURATION_ERROR',
        'DATABASE_URL is required in production environment'
      );
    }

    if (!supabaseUrl || !supabaseJwksUrl) {
      throw new AuthConfigurationError(
        'Missing required Supabase authentication configuration in production: SUPABASE_URL, SUPABASE_JWKS_URL'
      );
    }

    if (!rawTrustProxy || rawTrustProxy.trim() === '') {
      throw new AppError(
        500,
        'CONFIGURATION_ERROR',
        'TRUST_PROXY is required in production environment (e.g., "1" for single-hop reverse proxy, or specific CIDRs). Cannot safely default.'
      );
    }
  }

  return {
    nodeEnv,
    port: isNaN(port) ? 3001 : port,
    databaseUrl,
    supabaseUrl,
    supabaseJwksUrl,
    supabaseJwtAudience,
    corsAllowedOrigins,
    trustProxy,
    shippingProvider,
    ghtkApiBaseUrl,
    ghtkApiToken,
  };
}
