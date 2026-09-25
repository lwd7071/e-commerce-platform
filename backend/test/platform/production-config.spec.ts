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
      PORT: '8080',
      CORS_ORIGIN: 'https://my-store.com'
    };

    const config = validateEnvConfig(validProdEnv);
    assert.strictEqual(config.nodeEnv, 'production');
    assert.strictEqual(config.port, 8080);
    assert.strictEqual(config.supabaseUrl, 'https://project.supabase.co');
    assert.strictEqual(config.supabaseJwksUrl, 'https://project.supabase.co/auth/v1/.well-known/jwks.json');
    assert.strictEqual(config.corsOrigin, 'https://my-store.com');
  });

  it('[CFG-02]: throws AuthConfigurationError fail-fast in production when Supabase config is missing', () => {
    const invalidProdEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/ecommerce_prod',
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
    assert.strictEqual(config.port, 3000);
    assert.ok(config.corsOrigin !== undefined);
  });

  it('[CFG-05]: createRuntimeApp uses fail-fast env validation before initializing services', () => {
    const brokenEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db'
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
});
