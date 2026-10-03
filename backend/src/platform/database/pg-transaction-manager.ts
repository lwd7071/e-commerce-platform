import type { Pool, PoolClient } from 'pg';
import type { ITransactionManager } from '../../modules/moderation/domain/moderation.types.ts';

export class PgTransactionManager implements ITransactionManager {
  constructor(private readonly pool: Pool) {}

  async withTransaction<T>(fn: (trx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
