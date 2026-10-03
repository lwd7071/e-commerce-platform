import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvConfig } from '../../src/platform/config/env-config.ts';
import { AuthConfigurationError, AppError } from '../../src/platform/errors/app-error.ts';
import { createRuntimeApp } from '../../src/platform/http/app.ts';

describe('Production Environment Config Validation & Fail-Fast (Phase 6)', () => {
  it('[CFG-01]: validates valid production environment configuration successfully', () => {
    const validProdEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/ecommerce_prod',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      TRUST_PROXY: '1',
      PORT: '8080',
      CORS_ALLOWED_ORIGINS: 'https://my-store.com, https://admin.my-store.com'
    };

    const config = validateEnvConfig(validProdEnv);
    assert.strictEqual(config.nodeEnv, 'production');
    assert.strictEqual(config.port, 8080);
    assert.strictEqual(config.supabaseUrl, 'https://project.supabase.co');
    assert.strictEqual(config.supabaseJwksUrl, 'https://project.supabase.co/auth/v1/.well-known/jwks.json');
    assert.deepStrictEqual(config.corsAllowedOrigins, ['https://my-store.com', 'https://admin.my-store.com']);
  });

  it('[CFG-02]: throws AuthConfigurationError fail-fast in production when Supabase config is missing', () => {
    const invalidProdEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/ecommerce_prod',
      CORS_ALLOWED_ORIGINS: 'https://my-store.com',
      // Missing SUPABASE_URL and SUPABASE_JWKS_URL
    };

    assert.throws(
      () => validateEnvConfig(invalidProdEnv),
      (err: unknown) => {
        assert.ok(err instanceof AuthConfigurationError);
        assert.strictEqual((err as AuthConfigurationError).code, 'AUTH_CONFIGURATION_ERROR');
        assert.ok((err as Error).message.includes('SUPABASE_URL'));
        return true;
      }
    );
  });

  it('[CFG-03]: throws configuration error fail-fast in production when DATABASE_URL is missing', () => {
    const invalidProdEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      CORS_ALLOWED_ORIGINS: 'https://my-store.com',
      // Missing DATABASE_URL
    };

    assert.throws(
      () => validateEnvConfig(invalidProdEnv),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.ok((err as Error).message.includes('DATABASE_URL'));
        return true;
      }
    );
  });

  it('[CFG-04]: applies sensible defaults in development/test environment without failing fast', () => {
    const devEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'development'
    };

    const config = validateEnvConfig(devEnv);
    assert.strictEqual(config.nodeEnv, 'development');
    assert.strictEqual(config.port, 3001);
    assert.deepStrictEqual(config.corsAllowedOrigins, ['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('[CFG-07]: production requires an explicit CORS allowlist', () => {
    const prodEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/ecommerce_prod',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      TRUST_PROXY: '1',
    };
    assert.throws(() => validateEnvConfig(prodEnv), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.strictEqual((error as AppError).code, 'CONFIGURATION_ERROR');
      assert.match((error as Error).message, /CORS_ALLOWED_ORIGINS/);
      return true;
    });
  });

  it('[CFG-05]: createRuntimeApp uses fail-fast env validation before initializing services', () => {
    const brokenEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      CORS_ALLOWED_ORIGINS: 'https://my-store.com',
      // Missing Supabase config
    };

    assert.throws(
      () => createRuntimeApp(brokenEnv),
      (err: unknown) => {
        assert.ok(err instanceof AuthConfigurationError);
        return true;
      }
    );
  });

  it('[CFG-06]: throws AppError fail-fast in production when TRUST_PROXY is missing or blank', () => {
    const missingTrustProxyEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/ecommerce_prod',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      CORS_ALLOWED_ORIGINS: 'https://my-store.com',
      // Missing TRUST_PROXY
    };

    assert.throws(
      () => validateEnvConfig(missingTrustProxyEnv),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual((err as AppError).code, 'CONFIGURATION_ERROR');
        assert.ok((err as Error).message.includes('TRUST_PROXY'));
        return true;
      }
    );
  });
});
