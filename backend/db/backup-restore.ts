import crypto from 'node:crypto';
import type { DatabaseExecutor } from './types.ts';

export type Queryable = DatabaseExecutor;

export interface ColumnMetadata {
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
}

export interface PrimaryKeyMetadata {
  tableName: string;
  constraintName: string;
  columnName: string;
}

export interface ForeignKeyMetadata {
  tableName: string;
  constraintName: string;
  columnName: string;
  foreignTable: string;
  foreignColumn: string;
  deleteRule: string;
}

export interface CheckConstraintMetadata {
  tableName: string;
  constraintName: string;
}

export interface IndexMetadata {
  tableName: string;
  indexName: string;
  isUnique: boolean;
}

export interface RlsMetadata {
  tableName: string;
  enabled: boolean;
  forced: boolean;
}

export interface PolicyMetadata {
  tableName: string;
  policyName: string;
  permissive: string;
  roles: string[];
  command: string;
  qualification: string | null;
  withCheck: string | null;
}

export interface GrantMetadata {
  tableName: string;
  grantee: string;
  privilegeType: string;
  isGrantable: boolean;
}

export interface SchemaSnapshotMetadata {
  tables: string[];
  columns: ColumnMetadata[];
  primaryKeys: PrimaryKeyMetadata[];
  foreignKeys: ForeignKeyMetadata[];
  checkConstraints: CheckConstraintMetadata[];
  indexes: IndexMetadata[];
  rls: RlsMetadata[];
  policies: PolicyMetadata[];
  grants: GrantMetadata[];
}

export interface SchemaDiffResult {
  isIdentical: boolean;
  missingTables: string[];
  unexpectedTables: string[];
  missingColumns: string[];
  missingPrimaryKeys: string[];
  missingForeignKeys: string[];
  missingIndexes: string[];
  violations: string[];
}

/**
 * Trích xuất toàn bộ metadata cấu trúc schema phục vụ xác thực backup/restore
 */
export async function extractSchemaSnapshotMetadata(
  client: Queryable,
  schema = 'public',
): Promise<SchemaSnapshotMetadata> {
  // 1. Danh sách bảng
  const tablesRes = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema],
  );
  const tables = tablesRes.rows.map((r) => r.table_name);

  // 2. Danh sách cột
  const columnsRes = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = $1
     ORDER BY table_name, column_name`,
    [schema],
  );
  const columns: ColumnMetadata[] = columnsRes.rows.map((r) => ({
    tableName: r.table_name,
    columnName: r.column_name,
    dataType: r.data_type,
    isNullable: r.is_nullable === 'YES',
  }));

  // 3. Khóa chính
  const pkRes = await client.query<{
    table_name: string;
    constraint_name: string;
    column_name: string;
  }>(
    `SELECT tc.table_name, tc.constraint_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1 AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY tc.table_name, kcu.column_name`,
    [schema],
  );
  const primaryKeys: PrimaryKeyMetadata[] = pkRes.rows.map((r) => ({
    tableName: r.table_name,
    constraintName: r.constraint_name,
    columnName: r.column_name,
  }));

  // 4. Khóa ngoại kèm delete rule
  const fkRes = await client.query<{
    table_name: string;
    constraint_name: string;
    column_name: string;
    foreign_table: string;
    foreign_column: string;
    delete_rule: string;
  }>(
    `SELECT
       tc.table_name,
       tc.constraint_name,
       kcu.column_name,
       ccu.table_name AS foreign_table,
       ccu.column_name AS foreign_column,
       rc.delete_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     JOIN information_schema.referential_constraints rc
       ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
     WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY'
     ORDER BY tc.table_name, tc.constraint_name`,
    [schema],
  );
  const foreignKeys: ForeignKeyMetadata[] = fkRes.rows.map((r) => ({
    tableName: r.table_name,
    constraintName: r.constraint_name,
    columnName: r.column_name,
    foreignTable: r.foreign_table,
    foreignColumn: r.foreign_column,
    deleteRule: r.delete_rule,
  }));

  // 5. Check constraints
  const ckRes = await client.query<{
    table_name: string;
    constraint_name: string;
  }>(
    `SELECT table_name, constraint_name
     FROM information_schema.table_constraints
     WHERE table_schema = $1 AND constraint_type = 'CHECK'
     ORDER BY table_name, constraint_name`,
    [schema],
  );
  const checkConstraints: CheckConstraintMetadata[] = ckRes.rows.map((r) => ({
    tableName: r.table_name,
    constraintName: r.constraint_name,
  }));

  // 6. Indexes
  const idxRes = await client.query<{
    tablename: string;
    indexname: string;
    indisunique: boolean;
  }>(
    `SELECT c.relname AS tablename, i.relname AS indexname, x.indisunique
     FROM pg_index x
     JOIN pg_class c ON c.oid = x.indrelid
     JOIN pg_class i ON i.oid = x.indexrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind = 'r'
     ORDER BY c.relname, i.relname`,
    [schema],
  );
  const indexes: IndexMetadata[] = idxRes.rows.map((r) => ({
    tableName: r.tablename,
    indexName: r.indexname,
    isUnique: r.indisunique,
  }));

  const rlsRes = await client.query<{ table_name: string; enabled: boolean; forced: boolean }>(
    `SELECT c.relname AS table_name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY c.relname`,
    [schema],
  );
  const rls: RlsMetadata[] = rlsRes.rows.map((r) => ({
    tableName: r.table_name, enabled: r.enabled, forced: r.forced,
  }));

  const policyRes = await client.query<{
    tablename: string; policyname: string; permissive: string; roles: string[];
    cmd: string; qual: string | null; with_check: string | null;
  }>(
    `SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies WHERE schemaname = $1 ORDER BY tablename, policyname`,
    [schema],
  );
  const policies: PolicyMetadata[] = policyRes.rows.map((r) => ({
    tableName: r.tablename, policyName: r.policyname, permissive: r.permissive,
    roles: [...r.roles].sort(), command: r.cmd, qualification: r.qual, withCheck: r.with_check,
  }));

  const grantRes = await client.query<{
    table_name: string; grantee: string; privilege_type: string; is_grantable: boolean;
  }>(
    `SELECT c.relname AS table_name,
            COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
            acl.privilege_type, acl.is_grantable
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
     LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE n.nspname = $1 AND c.relkind = 'r'
     ORDER BY c.relname, grantee, acl.privilege_type`,
    [schema],
  );
  const grants: GrantMetadata[] = grantRes.rows.map((r) => ({
    tableName: r.table_name, grantee: r.grantee,
    privilegeType: r.privilege_type, isGrantable: r.is_grantable,
  }));

  return {
    tables,
    columns,
    primaryKeys,
    foreignKeys,
    checkConstraints,
    indexes,
    rls,
    policies,
    grants,
  };
}

/**
 * Sinh SHA-256 fingerprint chuẩn hóa cho metadata schema
 */
export function computeSchemaFingerprint(metadata: SchemaSnapshotMetadata): string {
  const normalized = JSON.stringify({
    tables: [...metadata.tables].sort(),
    columns: [...metadata.columns].sort((a, b) => `${a.tableName}.${a.columnName}`.localeCompare(`${b.tableName}.${b.columnName}`)),
    primaryKeys: [...metadata.primaryKeys].sort((a, b) => a.constraintName.localeCompare(b.constraintName)),
    foreignKeys: [...metadata.foreignKeys].sort((a, b) => a.constraintName.localeCompare(b.constraintName)),
    checkConstraints: [...metadata.checkConstraints].sort((a, b) => a.constraintName.localeCompare(b.constraintName)),
    indexes: [...metadata.indexes].sort((a, b) => a.indexName.localeCompare(b.indexName)),
    rls: [...metadata.rls].sort((a, b) => a.tableName.localeCompare(b.tableName)),
    policies: [...metadata.policies].map((p) => ({ ...p, roles: [...p.roles].sort() }))
      .sort((a, b) => `${a.tableName}.${a.policyName}`.localeCompare(`${b.tableName}.${b.policyName}`)),
    grants: [...metadata.grants].sort((a, b) =>
      `${a.tableName}.${a.grantee}.${a.privilegeType}`.localeCompare(`${b.tableName}.${b.grantee}.${b.privilegeType}`)),
  });

  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * So sánh 2 bản snapshot cấu trúc schema để phát hiện sai lệch
 */
export function compareSchemaSnapshots(
  baseline: SchemaSnapshotMetadata,
  candidate: SchemaSnapshotMetadata,
): SchemaDiffResult {
  const violations: string[] = [];

  // So sánh bảng
  const baseTableSet = new Set(baseline.tables);
  const candTableSet = new Set(candidate.tables);
  const missingTables = baseline.tables.filter((t) => !candTableSet.has(t));
  const unexpectedTables = candidate.tables.filter((t) => !baseTableSet.has(t));

  for (const t of missingTables) {
    violations.push(`Missing table in candidate schema: ${t}`);
  }

  // So sánh cột
  const candColSet = new Set(candidate.columns.map((c) => `${c.tableName}.${c.columnName}`));
  const missingColumns = baseline.columns
    .filter((c) => !candColSet.has(`${c.tableName}.${c.columnName}`))
    .map((c) => `${c.tableName}.${c.columnName}`);

  for (const c of missingColumns) {
    violations.push(`Missing column in candidate schema: ${c}`);
  }

  // So sánh khóa chính
  const candPkSet = new Set(candidate.primaryKeys.map((p) => `${p.tableName}.${p.constraintName}`));
  const missingPrimaryKeys = baseline.primaryKeys
    .filter((p) => !candPkSet.has(`${p.tableName}.${p.constraintName}`))
    .map((p) => `${p.tableName}.${p.constraintName}`);

  for (const p of missingPrimaryKeys) {
    violations.push(`Missing primary key in candidate schema: ${p}`);
  }

  // So sánh khóa ngoại
  const candFkSet = new Set(candidate.foreignKeys.map((f) => `${f.tableName}.${f.constraintName}`));
  const missingForeignKeys = baseline.foreignKeys
    .filter((f) => !candFkSet.has(`${f.tableName}.${f.constraintName}`))
    .map((f) => `${f.tableName}.${f.constraintName}`);

  for (const f of missingForeignKeys) {
    violations.push(`Missing foreign key in candidate schema: ${f}`);
  }

  // So sánh indexes
  const candIdxSet = new Set(candidate.indexes.map((i) => i.indexName));
  const missingIndexes = baseline.indexes
    .filter((i) => !candIdxSet.has(i.indexName))
    .map((i) => i.indexName);

  for (const idx of missingIndexes) {
    violations.push(`Missing index in candidate schema: ${idx}`);
  }

  if (computeSchemaFingerprint(baseline) !== computeSchemaFingerprint(candidate)) {
    violations.push('Schema fingerprint differs, including structural or security definitions');
  }

  return {
    isIdentical: violations.length === 0,
    missingTables,
    unexpectedTables,
    missingColumns,
    missingPrimaryKeys,
    missingForeignKeys,
    missingIndexes,
    violations,
  };
}
