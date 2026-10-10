import { describe, expect, it } from 'vitest';
import { assertMallTestEnvironment } from '../e2e/mall-environment';

const configured = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test', NEXT_PUBLIC_USE_MOCK: 'false',
  SUPABASE_URL: 'https://dedicated-test.supabase.co',
  NEXT_PUBLIC_SUPABASE_URL: 'https://dedicated-test.supabase.co',
  DATABASE_URL: 'postgresql://postgres.dedicated-test:unused@pooler.example:5432/postgres',
  DIRECT_URL: 'postgresql://postgres.dedicated-test:unused@pooler.example:5432/postgres',
  DATABASE_ENVIRONMENT: 'test', EXPECTED_SUPABASE_PROJECT_REF: 'dedicated-test',
  E2E_ALLOWED_SUPABASE_PROJECT_REFS: 'dedicated-test',
  EXPECTED_DATABASE_HOST: 'pooler.example', E2E_ALLOWED_DATABASE_HOSTS: 'pooler.example',
  ALLOW_E2E_SEED: 'true',
});

describe('Mall live target preflight', () => {
  it('accepts matching, explicitly allowlisted test targets', () => {
    expect(() => assertMallTestEnvironment(configured())).not.toThrow();
  });
  it.each(['DATABASE_ENVIRONMENT', 'EXPECTED_SUPABASE_PROJECT_REF', 'RUN_REAL_E2E_TEST'])('cannot be enabled by %s alone', key => {
    const env = configured();
    delete env.E2E_ALLOWED_SUPABASE_PROJECT_REFS;
    delete env.E2E_ALLOWED_DATABASE_HOSTS;
    env[key] = key === 'DATABASE_ENVIRONMENT' ? 'test' : key === 'EXPECTED_SUPABASE_PROJECT_REF' ? 'localtest' : 'true';
    expect(() => assertMallTestEnvironment(env)).toThrow();
  });
  it.each(['DATABASE_URL', 'DIRECT_URL'])('rejects a different actual project in %s', key => {
    expect(() => assertMallTestEnvironment({ ...configured(), [key]: 'postgresql://postgres.shared:unused@pooler.example/postgres' })).toThrow();
  });
  it('rejects production and mismatched frontend Auth', () => {
    expect(() => assertMallTestEnvironment({ ...configured(), NODE_ENV: 'production' })).toThrow();
    expect(() => assertMallTestEnvironment({ ...configured(), NEXT_PUBLIC_SUPABASE_URL: 'https://shared.supabase.co' })).toThrow();
  });
});
