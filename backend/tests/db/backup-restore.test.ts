import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import {
  computeSchemaFingerprint,
  compareSchemaSnapshots,
  extractSchemaSnapshotMetadata,
  type SchemaSnapshotMetadata,
} from '../../db/backup-restore.js';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';

describe('Backup & Restore Verification (T3 Unit)', () => {
  const dummyBaseline: SchemaSnapshotMetadata = {
    tables: ['app_users', 'orders'],
    columns: [
      { tableName: 'app_users', columnName: 'user_id', dataType: 'uuid', isNullable: false },
      { tableName: 'orders', columnName: 'order_id', dataType: 'uuid', isNullable: false },
    ],
    primaryKeys: [
      { tableName: 'app_users', constraintName: 'pk_app_users', columnName: 'user_id' },
      { tableName: 'orders', constraintName: 'pk_orders', columnName: 'order_id' },
    ],
    foreignKeys: [],
    checkConstraints: [],
    indexes: [
      { tableName: 'app_users', indexName: 'idx_app_users__email', isUnique: true },
    ],
    rls: [{ tableName: 'app_users', enabled: true, forced: false }],
    policies: [],
    grants: [],
  };

  it('computes identical fingerprint for identical metadata regardless of insertion order', () => {
    const permuted: SchemaSnapshotMetadata = {
      tables: ['orders', 'app_users'],
      columns: [...dummyBaseline.columns].reverse(),
      primaryKeys: [...dummyBaseline.primaryKeys].reverse(),
      foreignKeys: [],
      checkConstraints: [],
      indexes: [...dummyBaseline.indexes],
      rls: [...dummyBaseline.rls],
      policies: [],
      grants: [],
    };

    const hash1 = computeSchemaFingerprint(dummyBaseline);
    const hash2 = computeSchemaFingerprint(permuted);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects missing tables and columns in candidate snapshot', () => {
    const deficientCandidate: SchemaSnapshotMetadata = {
      tables: ['app_users'], // Thiếu orders
      columns: [
        { tableName: 'app_users', columnName: 'user_id', dataType: 'uuid', isNullable: false },
      ],
      primaryKeys: [
        { tableName: 'app_users', constraintName: 'pk_app_users', columnName: 'user_id' },
      ],
      foreignKeys: [],
      checkConstraints: [],
      indexes: [], // Thiếu index
      rls: [...dummyBaseline.rls],
      policies: [],
      grants: [],
    };

    const diff = compareSchemaSnapshots(dummyBaseline, deficientCandidate);
    expect(diff.isIdentical).toBe(false);
    expect(diff.missingTables).toContain('orders');
    expect(diff.missingColumns).toContain('orders.order_id');
    expect(diff.missingIndexes).toContain('idx_app_users__email');
    expect(diff.violations.length).toBeGreaterThan(0);
  });

  it('reports isIdentical true when both snapshots have identical definitions', () => {
    const diff = compareSchemaSnapshots(dummyBaseline, dummyBaseline);
    expect(diff.isIdentical).toBe(true);
    expect(diff.violations).toHaveLength(0);
  });

  it('detects changes to RLS, policies and table grants', () => {
    const candidates: SchemaSnapshotMetadata[] = [
      { ...dummyBaseline, rls: [{ tableName: 'app_users', enabled: false, forced: false }] },
      { ...dummyBaseline, policies: [{
        tableName: 'app_users', policyName: 'allow_all', permissive: 'PERMISSIVE',
        roles: ['PUBLIC'], command: 'ALL', qualification: 'true', withCheck: null,
      }] },
      { ...dummyBaseline, grants: [{
        tableName: 'app_users', grantee: 'anon', privilegeType: 'SELECT', isGrantable: false,
      }] },
    ];

    for (const candidate of candidates) {
      expect(computeSchemaFingerprint(candidate)).not.toBe(computeSchemaFingerprint(dummyBaseline));
      expect(compareSchemaSnapshots(dummyBaseline, candidate).isIdentical).toBe(false);
    }
  });
});

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('Live Schema Snapshot & Restore Verification (T3 Remote)', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  it('extracts real schema snapshot metadata and computes a valid 64-char fingerprint', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const metadata = await extractSchemaSnapshotMetadata(pool, 'public');

    // Kiểm tra có đủ ít nhất 22 bảng nghiệp vụ
    expect(metadata.tables.length).toBeGreaterThanOrEqual(22);
    expect(metadata.tables).toContain('app_users');
    expect(metadata.tables).toContain('orders');
    expect(metadata.tables).toContain('payments');

    // Kiểm tra có đầy đủ primary keys và indexes
    expect(metadata.primaryKeys.length).toBeGreaterThanOrEqual(22);
    expect(metadata.indexes.length).toBeGreaterThan(0);
    expect(metadata.rls.length).toBeGreaterThanOrEqual(22);
    expect(metadata.grants.length).toBeGreaterThan(0);

    const fingerprint = computeSchemaFingerprint(metadata);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);

    // Tự đối chiếu với chính nó -> hoàn toàn đồng nhất
    const diff = compareSchemaSnapshots(metadata, metadata);
    expect(diff.isIdentical).toBe(true);
    expect(diff.violations).toHaveLength(0);
  }, 20_000);
});
