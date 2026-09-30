export type MediaCleanupEnvironment = {
  nodeEnv?: string;
  databaseEnvironment?: string;
  expectedProjectRef?: string;
  allowedProjectRefs?: string;
  expectedDatabaseHost?: string;
  allowedDatabaseHosts?: string;
  allowMediaCleanup?: string;
};

const values = (csv: string | undefined): string[] =>
  (csv ?? '').split(',').map((value) => value.trim()).filter(Boolean);

export function assertMediaCleanupAllowed(
  env: MediaCleanupEnvironment,
  actual: { projectRef: string; databaseHost: string },
): void {
  if (env.nodeEnv !== 'production' || env.databaseEnvironment !== 'production') {
    throw new Error('Scheduled media cleanup requires NODE_ENV=production and DATABASE_ENVIRONMENT=production');
  }
  if (env.allowMediaCleanup !== 'true') throw new Error('Media cleanup requires ALLOW_MEDIA_CLEANUP=true');
  const expectedProjectRef = env.expectedProjectRef?.trim();
  const projectAllowlist = values(env.allowedProjectRefs);
  if (!expectedProjectRef) throw new Error('Media cleanup requires EXPECTED_SUPABASE_PROJECT_REF');
  if (!projectAllowlist.length) throw new Error('Media cleanup requires an explicit project ref allowlist');
  if (expectedProjectRef !== actual.projectRef || !projectAllowlist.includes(expectedProjectRef)) {
    throw new Error('Media cleanup project ref does not match its explicit allowlist');
  }
  const expectedDatabaseHost = env.expectedDatabaseHost?.trim().toLowerCase();
  const databaseHostAllowlist = values(env.allowedDatabaseHosts).map((host) => host.toLowerCase());
  if (!expectedDatabaseHost) throw new Error('Media cleanup requires EXPECTED_DATABASE_HOST');
  if (!databaseHostAllowlist.length) throw new Error('Media cleanup requires an explicit database host allowlist');
  if (expectedDatabaseHost !== actual.databaseHost.toLowerCase()
    || !databaseHostAllowlist.includes(expectedDatabaseHost)) {
    throw new Error('Media cleanup database host does not match its explicit allowlist');
  }
}
