export type E2ESeedEnvironment = {
  nodeEnv?: string;
  databaseEnvironment?: string;
  expectedProjectRef?: string;
  allowedProjectRefs?: string;
  expectedDatabaseHost?: string;
  allowedDatabaseHosts?: string;
  allowE2ESeed?: string;
};

export type E2ESeedTarget = {
  projectRef: string;
  databaseHost: string;
};

const csvValues = (value: string | undefined): Set<string> => new Set(
  (value ?? '').split(',').map((part) => part.trim()).filter(Boolean),
);

export function assertE2ESeedAllowed(env: E2ESeedEnvironment, actual: E2ESeedTarget): void {
  if (env.nodeEnv === 'production') {
    throw new Error('E2E seed is disabled when NODE_ENV=production');
  }
  if (env.databaseEnvironment !== 'test') {
    throw new Error('E2E seed requires DATABASE_ENVIRONMENT=test');
  }

  const expectedProjectRef = env.expectedProjectRef?.trim();
  const allowedProjectRefs = csvValues(env.allowedProjectRefs);
  if (!allowedProjectRefs.size) {
    throw new Error('E2E seed requires E2E_ALLOWED_SUPABASE_PROJECT_REFS allowlist');
  }
  if (!expectedProjectRef) {
    throw new Error('E2E seed requires EXPECTED_SUPABASE_PROJECT_REF');
  }
  if (expectedProjectRef !== actual.projectRef) {
    throw new Error('E2E seed URL does not match the configured project ref');
  }
  if (!allowedProjectRefs.has(expectedProjectRef)) {
    throw new Error('E2E seed project is not in E2E_ALLOWED_SUPABASE_PROJECT_REFS');
  }

  const expectedDatabaseHost = env.expectedDatabaseHost?.trim().toLowerCase();
  const allowedDatabaseHosts = new Set([...csvValues(env.allowedDatabaseHosts)].map((host) => host.toLowerCase()));
  if (!allowedDatabaseHosts.size) {
    throw new Error('E2E seed requires E2E_ALLOWED_DATABASE_HOSTS allowlist');
  }
  if (!expectedDatabaseHost) {
    throw new Error('E2E seed requires EXPECTED_DATABASE_HOST');
  }
  if (expectedDatabaseHost !== actual.databaseHost.toLowerCase()) {
    throw new Error('E2E seed URL does not match the configured database host');
  }
  if (!allowedDatabaseHosts.has(expectedDatabaseHost)) {
    throw new Error('E2E seed database host is not in E2E_ALLOWED_DATABASE_HOSTS');
  }
  if (env.allowE2ESeed !== 'true') {
    throw new Error('E2E seed requires ALLOW_E2E_SEED=true');
  }
}
