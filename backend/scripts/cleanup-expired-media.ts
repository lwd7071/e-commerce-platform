import '../src/platform/config/load-root-env.ts';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { createPostgresMediaCleanupStore, cleanExpiredMedia } from '../db/media-cleanup.ts';
import { assertMediaCleanupAllowed } from '../db/media-cleanup-safety.ts';
import { loadDatabaseConfig } from '../db/config.ts';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for media cleanup`);
  return value;
};

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
const databaseHost = config.directUrl.hostname;
assertMediaCleanupAllowed({
  nodeEnv: process.env.NODE_ENV,
  databaseEnvironment: process.env.DATABASE_ENVIRONMENT,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  allowedProjectRefs: process.env.MEDIA_CLEANUP_ALLOWED_PROJECT_REFS,
  expectedDatabaseHost: process.env.EXPECTED_DATABASE_HOST,
  allowedDatabaseHosts: process.env.MEDIA_CLEANUP_ALLOWED_DATABASE_HOSTS,
  allowMediaCleanup: process.env.ALLOW_MEDIA_CLEANUP,
}, { projectRef, databaseHost });

const parsedBatchSize = Number(process.env.MEDIA_CLEANUP_BATCH_SIZE ?? 100);
const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 2 });
const storageClient = createClient(config.supabaseUrl.toString(), required('SUPABASE_SECRET_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const result = await cleanExpiredMedia(
    createPostgresMediaCleanupStore(pool),
    {
      async remove(bucketId, objectPath) {
        const { error } = await storageClient.storage.from(bucketId).remove([objectPath]);
        if (error) throw error;
      },
    },
    parsedBatchSize,
  );
  process.stdout.write(JSON.stringify({ project_ref: projectRef, ...result }) + '\n');
  if (result.failed > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
