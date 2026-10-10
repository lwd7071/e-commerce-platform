import { assertE2ESeedAllowed } from '../../backend/db/seed/e2e-seed-safety';

// Read-only preflight. Approval/allowlists must name a separately provisioned test project.
// These checks do not provision a database or turn a shared database into a test target.
function parseTarget(value: string | undefined, name: string): URL {
  try { return new URL(value || ''); }
  catch { throw new Error(`Missing or invalid ${name}`); }
}

export function assertMallTestEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.NEXT_PUBLIC_USE_MOCK !== 'false') throw new Error('Live E2E requires NEXT_PUBLIC_USE_MOCK=false');
  const auth = parseTarget(env.SUPABASE_URL, 'SUPABASE_URL');
  const browserAuth = parseTarget(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  if (auth.origin !== browserAuth.origin) throw new Error('Frontend and backend Supabase targets differ');
  const projectRef = auth.hostname.split('.')[0];
  for (const name of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const database = parseTarget(env[name], name);
    if (!['postgres:', 'postgresql:'].includes(database.protocol) ||
        !(database.username.endsWith(`.${projectRef}`) || database.hostname === `db.${projectRef}.supabase.co`)) {
      throw new Error(`${name} does not match the Supabase project`);
    }
    assertE2ESeedAllowed({
      nodeEnv: env.NODE_ENV,
      databaseEnvironment: env.DATABASE_ENVIRONMENT,
      expectedProjectRef: env.EXPECTED_SUPABASE_PROJECT_REF,
      allowedProjectRefs: env.E2E_ALLOWED_SUPABASE_PROJECT_REFS,
      expectedDatabaseHost: env.EXPECTED_DATABASE_HOST,
      allowedDatabaseHosts: env.E2E_ALLOWED_DATABASE_HOSTS,
      allowE2ESeed: env.ALLOW_E2E_SEED,
    }, { projectRef, databaseHost: database.hostname });
  }
  const api = parseTarget(env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1', 'NEXT_PUBLIC_API_URL');
  if (!['localhost', '127.0.0.1'].includes(api.hostname)) throw new Error('Run the backend locally with the verified test configuration');
}
