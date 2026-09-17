import { URL } from 'node:url';

export type DatabaseConfig = {
  supabaseUrl: URL;
  databaseUrl: URL;
  directUrl: URL;
  runRemoteDbTests: boolean;
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
  return { supabaseUrl, databaseUrl, directUrl, runRemoteDbTests: parseRunRemoteDbTests(env) };
};
