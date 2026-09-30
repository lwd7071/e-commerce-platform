export type DevelopmentSeedEnvironment = {
  nodeEnv?: string;
  databaseEnvironment?: string;
  expectedProjectRef?: string;
  allowDevelopmentSeed?: string;
};

export function assertDevelopmentSeedAllowed(
  env: DevelopmentSeedEnvironment,
  actualProjectRef: string,
): void {
  if (env.nodeEnv === 'production') {
    throw new Error('Development seed is disabled when NODE_ENV=production');
  }
  if (env.databaseEnvironment !== 'development' && env.databaseEnvironment !== 'test') {
    throw new Error('Development seed requires DATABASE_ENVIRONMENT=development or test');
  }
  const expectedProjectRef = env.expectedProjectRef?.trim();
  if (!expectedProjectRef) {
    throw new Error('Development seed requires a human-supplied EXPECTED_SUPABASE_PROJECT_REF');
  }
  if (expectedProjectRef !== actualProjectRef) {
    throw new Error('Development seed target does not match EXPECTED_SUPABASE_PROJECT_REF');
  }
  if (env.allowDevelopmentSeed !== 'true') {
    throw new Error('Development seed requires explicit ALLOW_DEVELOPMENT_CATEGORY_SEED=true confirmation');
  }
}
