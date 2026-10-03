import type { QueryResult, QueryResultRow } from 'pg';

/** Minimal database contract shared by pools, transaction clients and repository test doubles. */
export interface DatabaseExecutor {
  query<R extends QueryResultRow = QueryResultRow, I extends unknown[] = unknown[]>(
    queryText: string,
    values?: I,
  ): Promise<QueryResult<R>>;
}
