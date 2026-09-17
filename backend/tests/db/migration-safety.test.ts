import { describe, expect, it } from 'vitest';
import { assertMigrationDeploymentAllowed, migrationTargetPreview } from '../../db/migration-safety.js';

describe('migration safety guard', () => {
  it('requires human confirmation and test environment', () => {
    expect(() => assertMigrationDeploymentAllowed({}, 'demo123')).toThrow('DATABASE_ENVIRONMENT=test');
    expect(() => assertMigrationDeploymentAllowed({ databaseEnvironment: 'test' }, 'demo123'))
      .toThrow('human-supplied EXPECTED_SUPABASE_PROJECT_REF');
    expect(() => assertMigrationDeploymentAllowed({ databaseEnvironment: 'test', expectedProjectRef: 'demo123' }, 'demo123'))
      .toThrow('ALLOW_MIGRATION_DEPLOY=true');
  });

  it('rejects a target that differs from the human-supplied project ref', () => {
    expect(() => assertMigrationDeploymentAllowed({
      databaseEnvironment: 'test',
      expectedProjectRef: 'human-chosen',
      allowMigrationDeploy: 'true',
    }, 'derived-from-url')).toThrow('does not match');
  });

  it('accepts only an explicitly confirmed matching test target', () => {
    expect(() => assertMigrationDeploymentAllowed({
      databaseEnvironment: 'test',
      expectedProjectRef: 'demo123',
      allowMigrationDeploy: 'true',
    }, 'demo123')).not.toThrow();
  });

  it('returns a sanitized preview without credentials', () => {
    expect(migrationTargetPreview(
      new URL('https://demo123.supabase.co'),
      new URL('postgresql://secret-user:secret-pass@db.demo123.supabase.co:5432/postgres'),
    )).toEqual({ hostname: 'db.demo123.supabase.co', projectRef: 'demo123', databaseName: 'postgres' });
  });
});
