import { URL } from 'node:url';

export type DatabaseConfig = {
  supabaseUrl: URL;
  databaseUrl: URL;
  directUrl: URL;
  runRemoteDbTests: boolean;
  pool: DatabasePoolConfig;
};

export type DatabasePoolConfig = {
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
};

const boundedInteger = (env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number => {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
};

export const parseRunRemoteDbTests = (env: NodeJS.ProcessEnv): boolean => {
  const raw = env.RUN_REMOTE_DB_TESTS;
  if (raw === undefined) return false;

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('RUN_REMOTE_DB_TESTS must be true or false');
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const parseUrl = (name: string, value: string, schemes: string[]): URL => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${name}: expected an absolute URL`);
  }
  if (!schemes.includes(parsed.protocol.replace(':', ''))) {
    throw new Error(`Invalid ${name}: unsupported protocol`);
  }
  return parsed;
};

export const loadDatabaseConfig = (env: NodeJS.ProcessEnv): DatabaseConfig => {
  const supabaseUrl = parseUrl('SUPABASE_URL', required(env, 'SUPABASE_URL'), ['https']);
  const databaseUrl = parseUrl('DATABASE_URL', required(env, 'DATABASE_URL'), ['postgres', 'postgresql']);
  const directUrl = parseUrl('DIRECT_URL', required(env, 'DIRECT_URL'), ['postgres', 'postgresql']);
  const projectRef = supabaseUrl.hostname.split('.')[0];
  const databaseUsers = [databaseUrl.username, directUrl.username];
  if (!databaseUsers.every((username) => username.endsWith(`.${projectRef}`))) {
    throw new Error('DATABASE_URL and DIRECT_URL must target the SUPABASE_URL project');
  }
  return {
    supabaseUrl,
    databaseUrl,
    directUrl,
    runRemoteDbTests: parseRunRemoteDbTests(env),
    pool: {
      max: boundedInteger(env, 'DB_POOL_MAX', 10, 1, 50),
      connectionTimeoutMillis: boundedInteger(env, 'DB_CONNECTION_TIMEOUT_MS', 30_000, 1_000, 60_000),
      idleTimeoutMillis: boundedInteger(env, 'DB_IDLE_TIMEOUT_MS', 30_000, 1_000, 120_000),
    },
  };
};
