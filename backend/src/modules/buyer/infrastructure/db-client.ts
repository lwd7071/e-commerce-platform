/**
 * SOLID Design Principles:
 * - Dependency Inversion Principle (D): High-level repository modules phụ thuộc vào
 *   abstraction IDbClient thay vì low-level driver cụ thể (pg.Pool hay pg.PoolClient).
 * - Interface Segregation Principle (I): Chỉ yêu cầu method query cần thiết cho repository.
 */
export interface IDbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}
