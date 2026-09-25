import { AuthConfigurationError, AppError } from '../errors/app-error.ts';

export interface ValidatedEnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseJwksUrl?: string;
  supabaseJwtAudience?: string;
  corsOrigin: string;
  trustProxy?: boolean | string | number;
}

export function validateEnvConfig(environment: NodeJS.ProcessEnv = process.env): ValidatedEnvConfig {
  const nodeEnv = environment.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const port = parseInt(environment.PORT || '3000', 10);
  const databaseUrl = environment.DATABASE_URL;
  const supabaseUrl = environment.SUPABASE_URL;
  const supabaseJwksUrl = environment.SUPABASE_JWKS_URL;
  const supabaseJwtAudience = environment.SUPABASE_JWT_AUDIENCE || 'authenticated';
  const corsOrigin = environment.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:3000');

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
    port: isNaN(port) ? 3000 : port,
    databaseUrl,
    supabaseUrl,
    supabaseJwksUrl,
    supabaseJwtAudience,
    corsOrigin,
    trustProxy,
  };
}
