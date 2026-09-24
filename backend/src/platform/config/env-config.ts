import { AuthConfigurationError, AppError } from '../errors/app-error.ts';

export interface ValidatedEnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseJwksUrl?: string;
  supabaseJwtAudience?: string;
  corsOrigin: string;
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
  }

  return {
    nodeEnv,
    port: isNaN(port) ? 3000 : port,
    databaseUrl,
    supabaseUrl,
    supabaseJwksUrl,
    supabaseJwtAudience,
    corsOrigin,
  };
}
