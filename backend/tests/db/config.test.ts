import { describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';

const validEnv = {
  SUPABASE_URL: 'https://demo123.supabase.co',
  DATABASE_URL: 'postgresql://postgres.demo123:secret@aws-0-region.pooler.supabase.com:5432/postgres',
  DIRECT_URL: 'postgresql://postgres.demo123:secret@aws-0-region.pooler.supabase.com:5432/postgres',
  RUN_REMOTE_DB_TESTS: 'false',
};

describe('loadDatabaseConfig', () => {
  it('defaults remote database tests to false when the flag is missing', () => {
    expect(parseRunRemoteDbTests({})).toBe(false);
  });

  it('rejects a whitespace-only remote database test flag', () => {
    expect(() => parseRunRemoteDbTests({ RUN_REMOTE_DB_TESTS: '   ' })).toThrow('RUN_REMOTE_DB_TESTS');
  });

  it('accepts case-insensitive boolean remote database test flags', () => {
    expect(parseRunRemoteDbTests({ RUN_REMOTE_DB_TESTS: ' TRUE ' })).toBe(true);
    expect(parseRunRemoteDbTests({ RUN_REMOTE_DB_TESTS: 'False' })).toBe(false);
  });

  it('loads valid project URLs without exposing secrets', () => {
    const config = loadDatabaseConfig(validEnv);
    expect(config.supabaseUrl.hostname).toBe('demo123.supabase.co');
    expect(config.databaseUrl.port).toBe('5432');
    expect(config.runRemoteDbTests).toBe(false);
    expect(config.databaseUrl.password).toBe('secret');
  });

  it('rejects missing database URL', () => {
    const env = { ...validEnv, DATABASE_URL: '' };
    expect(() => loadDatabaseConfig(env)).toThrow('DATABASE_URL');
  });

  it('rejects a database URL targeting another project', () => {
    const env = { ...validEnv, DIRECT_URL: 'postgresql://postgres.other:secret@aws-0-region.pooler.supabase.com:5432/postgres' };
    expect(() => loadDatabaseConfig(env)).toThrow('target the SUPABASE_URL project');
  });

  it('rejects an invalid remote-test flag', () => {
    const env = { ...validEnv, RUN_REMOTE_DB_TESTS: 'yes' };
    expect(() => loadDatabaseConfig(env)).toThrow('RUN_REMOTE_DB_TESTS');
  });
});
