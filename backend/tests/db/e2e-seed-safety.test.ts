import { describe, expect, it } from 'vitest';
import { assertE2ESeedAllowed } from '../../db/seed/e2e-seed-safety.js';

const allowed = {
  nodeEnv: 'test',
  databaseEnvironment: 'test',
  expectedProjectRef: 'e2e-project',
  allowedProjectRefs: 'local-project,e2e-project',
  expectedDatabaseHost: 'db.e2e-project.supabase.co',
  allowedDatabaseHosts: 'db.e2e-project.supabase.co,127.0.0.1',
  allowE2ESeed: 'true',
};

describe('assertE2ESeedAllowed', () => {
  it('allows only an explicitly enabled test target in both allowlists', () => {
    expect(() => assertE2ESeedAllowed(allowed, {
      projectRef: 'e2e-project',
      databaseHost: 'db.e2e-project.supabase.co',
    })).not.toThrow();
  });

  it.each([
    ['production runtime', { ...allowed, nodeEnv: 'production' }, 'production'],
    ['production database', { ...allowed, databaseEnvironment: 'production' }, 'DATABASE_ENVIRONMENT=test'],
    ['missing project allowlist', { ...allowed, allowedProjectRefs: '' }, 'E2E_ALLOWED_SUPABASE_PROJECT_REFS'],
    ['missing database host allowlist', { ...allowed, allowedDatabaseHosts: '' }, 'E2E_ALLOWED_DATABASE_HOSTS'],
    ['missing project ref', { ...allowed, expectedProjectRef: '' }, 'EXPECTED_SUPABASE_PROJECT_REF'],
    ['missing database host', { ...allowed, expectedDatabaseHost: '' }, 'EXPECTED_DATABASE_HOST'],
    ['missing explicit confirmation', { ...allowed, allowE2ESeed: 'false' }, 'ALLOW_E2E_SEED=true'],
  ])('rejects %s before database work', (_caseName, env, expectedMessage) => {
    expect(() => assertE2ESeedAllowed(env, {
      projectRef: 'e2e-project',
      databaseHost: 'db.e2e-project.supabase.co',
    })).toThrow(expectedMessage);
  });

  it('rejects a matching expected target that is absent from the allowlist', () => {
    expect(() => assertE2ESeedAllowed({ ...allowed, allowedProjectRefs: 'another-project' }, {
      projectRef: 'e2e-project',
      databaseHost: 'db.e2e-project.supabase.co',
    })).toThrow('not in E2E_ALLOWED_SUPABASE_PROJECT_REFS');
  });

  it('rejects a matching database host that is absent from its allowlist', () => {
    expect(() => assertE2ESeedAllowed({ ...allowed, allowedDatabaseHosts: '127.0.0.1' }, {
      projectRef: 'e2e-project',
      databaseHost: 'db.e2e-project.supabase.co',
    })).toThrow('not in E2E_ALLOWED_DATABASE_HOSTS');
  });

  it('rejects URL-derived target drift for either project or database host', () => {
    expect(() => assertE2ESeedAllowed(allowed, {
      projectRef: 'different-project',
      databaseHost: 'db.e2e-project.supabase.co',
    })).toThrow('does not match the configured project ref');
    expect(() => assertE2ESeedAllowed(allowed, {
      projectRef: 'e2e-project',
      databaseHost: 'other.example.test',
    })).toThrow('does not match the configured database host');
  });
});
