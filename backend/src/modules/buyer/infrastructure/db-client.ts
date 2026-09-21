/**
 * SOLID Design Principles:
 * - Dependency Inversion Principle (D): High-level repository modules phụ thuộc vào
 *   abstraction IDbClient thay vì low-level driver cụ thể (pg.Pool hay pg.PoolClient).
 * - Interface Segregation Principle (I): Chỉ yêu cầu method query cần thiết cho repository.
 */
export interface IDbClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}
