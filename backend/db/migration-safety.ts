import type { URL } from 'node:url';

export type MigrationTargetPreview = {
  hostname: string;
  projectRef: string;
  databaseName: string;
};

export type MigrationSafetyEnvironment = {
  databaseEnvironment?: string;
  expectedProjectRef?: string;
  allowMigrationDeploy?: string;
};

export const migrationTargetPreview = (supabaseUrl: URL, databaseUrl: URL): MigrationTargetPreview => ({
  hostname: databaseUrl.hostname,
  projectRef: supabaseUrl.hostname.split('.')[0],
  databaseName: databaseUrl.pathname.replace(/^\//, '') || '<default>',
});

export const assertMigrationDeploymentAllowed = (
  env: MigrationSafetyEnvironment,
  actualProjectRef: string,
): void => {
  if (env.databaseEnvironment !== 'test') {
    throw new Error('Migration deploy requires DATABASE_ENVIRONMENT=test');
  }
  const expected = env.expectedProjectRef?.trim();
  if (!expected) throw new Error('Migration deploy requires a human-supplied EXPECTED_SUPABASE_PROJECT_REF');
  if (expected !== actualProjectRef) {
    throw new Error('Migration target does not match EXPECTED_SUPABASE_PROJECT_REF');
  }
  if (env.allowMigrationDeploy !== 'true') {
    throw new Error('Migration deploy requires explicit ALLOW_MIGRATION_DEPLOY=true confirmation');
  }
};
