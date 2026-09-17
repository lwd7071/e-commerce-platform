import pg from 'pg';
import type { Pool } from 'pg';
import type { DatabaseConfig, DatabasePoolConfig } from './config.js';

export type DatabasePoolInput = Pick<DatabaseConfig, 'databaseUrl' | 'pool'>;

export const createDatabasePool = (config: DatabasePoolInput): Pool => {
  const poolConfig: DatabasePoolConfig = config.pool;
  return new pg.Pool({
    connectionString: config.databaseUrl.toString(),
    max: poolConfig.max,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
    idleTimeoutMillis: poolConfig.idleTimeoutMillis,
  });
};

export const closeDatabasePool = async (pool: Pool): Promise<void> => {
  await pool.end();
};
