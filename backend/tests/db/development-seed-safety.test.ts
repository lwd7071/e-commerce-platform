import { describe, expect, it } from 'vitest';
import { assertDevelopmentSeedAllowed } from '../../db/seed/development-seed-safety.js';

const safeEnvironment = {
  nodeEnv: 'development',
  databaseEnvironment: 'development',
  expectedProjectRef: 'local-dev-project',
  allowDevelopmentSeed: 'true',
};

describe('assertDevelopmentSeedAllowed', () => {
  it('allows an explicitly confirmed development target with matching project ref', () => {
    expect(() => assertDevelopmentSeedAllowed(safeEnvironment, 'local-dev-project')).not.toThrow();
  });

  it.each([
    ['production runtime', { ...safeEnvironment, nodeEnv: 'production' }, 'local-dev-project', 'NODE_ENV=production'],
    ['unspecified database environment', { ...safeEnvironment, databaseEnvironment: undefined }, 'local-dev-project', 'DATABASE_ENVIRONMENT'],
    ['missing expected project ref', { ...safeEnvironment, expectedProjectRef: ' ' }, 'local-dev-project', 'EXPECTED_SUPABASE_PROJECT_REF'],
    ['wrong project ref', safeEnvironment, 'another-project', 'does not match'],
    ['missing explicit confirmation', { ...safeEnvironment, allowDevelopmentSeed: undefined }, 'local-dev-project', 'ALLOW_DEVELOPMENT_CATEGORY_SEED=true'],
  ])('rejects %s', (_scenario, env, actualProjectRef, message) => {
    expect(() => assertDevelopmentSeedAllowed(env, actualProjectRef)).toThrow(message);
  });
});
