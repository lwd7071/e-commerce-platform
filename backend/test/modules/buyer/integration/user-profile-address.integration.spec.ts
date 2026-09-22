import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresUserProfileRepository } from '../../../../src/modules/buyer/infrastructure/postgres-user-profile.repository';
import { PostgresAddressRepository } from '../../../../src/modules/buyer/infrastructure/postgres-address.repository';
import { mapUserProfile, mapAddress } from '../../../../src/modules/buyer/infrastructure/row-mappers';
import { mockUserProfile, mockAddress1, mockAddress2, mockBuyerId } from '../fixtures';
import type { IDbClient } from '../../../../src/modules/buyer/infrastructure/db-client';

/**
 * Mock DB Client mô phỏng chính xác hành vi của pg.Pool/PoolClient
 * Phục vụ unit & contract testing theo nguyên lý Dependency Inversion (SOLID: D)
 */
class MockDbClient {
  public queries: { sql: string; params: unknown[] }[] = [];
  public customHandler?: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  async query(sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    this.queries.push({ sql: sql.trim(), params });
    if (this.customHandler) {
      return this.customHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('Phase 1 — PostgresUserProfileRepository & PostgresAddressRepository (SOLID: S, L, D)', () => {
  describe('Row Mappers (SOLID: S — Single Responsibility)', () => {
    it('mapUserProfile: chuyển đổi snake_case DB row sang camelCase domain type chuẩn', () => {
      const dbRow = {
        user_id: mockBuyerId,
        full_name: 'Nguyễn Văn Mua',
        phone: '0901234567',
        avatar_url: 'https://example.com/avatar.png',
        updated_at: new Date('2026-09-17T12:00:00.000Z'),
      };

      const result = mapUserProfile(dbRow);

      assert.strictEqual(result.userId, mockBuyerId);
      assert.strictEqual(result.fullName, 'Nguyễn Văn Mua');
      assert.strictEqual(result.phone, '0901234567');
      assert.strictEqual(result.avatarUrl, 'https://example.com/avatar.png');
      assert.strictEqual(result.updatedAt, '2026-09-17T12:00:00.000Z');
    });

    it('mapAddress: chuyển đổi snake_case DB row sang Address domain type chuẩn', () => {
      const dbRow = {
        address_id: mockAddress1.addressId,
        user_id: mockBuyerId,
        recipient_name: 'Trần Văn Nhận',
        phone: '0987654321',
        province: 'Hà Nội',
        district: 'Hoàn Kiếm',
        ward: 'Hàng Trống',
        detail_address: '10 Tràng Thi',
        is_default: true,
        created_at: new Date('2026-09-16T10:00:00.000Z'),
        updated_at: new Date('2026-09-17T11:00:00.000Z'),
      };

      const result = mapAddress(dbRow);

      assert.strictEqual(result.addressId, mockAddress1.addressId);
      assert.strictEqual(result.userId, mockBuyerId);
      assert.strictEqual(result.recipientName, 'Trần Văn Nhận');
      assert.strictEqual(result.province, 'Hà Nội');
      assert.strictEqual(result.isDefault, true);
      assert.strictEqual(result.createdAt, '2026-09-16T10:00:00.000Z');
      assert.strictEqual(result.updatedAt, '2026-09-17T11:00:00.000Z');
    });
  });

  describe('PostgresUserProfileRepository (SOLID: L, D)', () => {
    it('[TEST-INT-01] findByUserId: trả về null khi không tìm thấy', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 0 });

      const repo = new PostgresUserProfileRepository(client as IDbClient);
      const profile = await repo.findByUserId(mockBuyerId);

      assert.strictEqual(profile, null);
      assert.ok(client.queries[0].sql.includes('SELECT user_id, full_name, phone, avatar_url, updated_at'));
      assert.ok(client.queries[0].sql.includes('FROM user_profiles WHERE user_id = $1'));
      assert.deepStrictEqual(client.queries[0].params, [mockBuyerId]);
    });

    it('[TEST-INT-01] upsert: thực thi ON CONFLICT (user_id) DO UPDATE đúng chuẩn', async () => {
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          user_id: params[0],
          full_name: params[1],
          phone: params[2],
          avatar_url: params[3],
          updated_at: new Date('2026-09-17T15:00:00.000Z'),
        }],
        rowCount: 1,
      });

      const repo = new PostgresUserProfileRepository(client as IDbClient);
      const updated = await repo.upsert(mockUserProfile);

      assert.strictEqual(updated.userId, mockBuyerId);
      assert.strictEqual(updated.fullName, mockUserProfile.fullName);
      assert.ok(client.queries[0].sql.includes('INSERT INTO user_profiles'));
      assert.ok(client.queries[0].sql.includes('ON CONFLICT (user_id) DO UPDATE'));
      assert.strictEqual(client.queries[0].params[0], mockBuyerId);
    });
  });

  describe('PostgresAddressRepository (SOLID: L, D)', () => {
    it('[TEST-INT-02] create: chèn địa chỉ mới và trả về Address đầy đủ', async () => {
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          address_id: params[0],
          user_id: params[1],
          recipient_name: params[2],
          phone: params[3],
          province: params[4],
          district: params[5],
          ward: params[6],
          detail_address: params[7],
          is_default: params[8],
          created_at: new Date('2026-09-16T10:00:00.000Z'),
          updated_at: new Date('2026-09-16T10:00:00.000Z'),
        }],
        rowCount: 1,
      });

      const repo = new PostgresAddressRepository(client as IDbClient);
      const result = await repo.create(mockAddress1);

      assert.strictEqual(result.addressId, mockAddress1.addressId);
      assert.strictEqual(result.recipientName, mockAddress1.recipientName);
      assert.strictEqual(result.isDefault, true);
      assert.ok(client.queries[0].sql.includes('INSERT INTO addresses'));
    });

    it('[TEST-INT-03] findByUserId: trả về danh sách địa chỉ sắp xếp theo is_default DESC, created_at DESC', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [
          {
            address_id: mockAddress1.addressId,
            user_id: mockBuyerId,
            recipient_name: mockAddress1.recipientName,
            phone: mockAddress1.phone,
            province: mockAddress1.province,
            district: mockAddress1.district,
            ward: mockAddress1.ward,
            detail_address: mockAddress1.detailAddress,
            is_default: true,
            created_at: new Date(mockAddress1.createdAt),
            updated_at: new Date(mockAddress1.updatedAt),
          },
          {
            address_id: mockAddress2.addressId,
            user_id: mockBuyerId,
            recipient_name: mockAddress2.recipientName,
            phone: mockAddress2.phone,
            province: mockAddress2.province,
            district: mockAddress2.district,
            ward: mockAddress2.ward,
            detail_address: mockAddress2.detailAddress,
            is_default: false,
            created_at: new Date(mockAddress2.createdAt),
            updated_at: new Date(mockAddress2.updatedAt),
          },
        ],
        rowCount: 2,
      });

      const repo = new PostgresAddressRepository(client as IDbClient);
      const addresses = await repo.findByUserId(mockBuyerId);

      assert.strictEqual(addresses.length, 2);
      assert.strictEqual(addresses[0].isDefault, true);
      assert.strictEqual(addresses[1].isDefault, false);
      assert.ok(client.queries[0].sql.includes('ORDER BY is_default DESC, created_at DESC'));
    });

    it('[TEST-INT-03] setDefault (RB-LB05): cập nhật địa chỉ cũ thành false, địa chỉ mới thành true trong 1 giao dịch', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 1 });

      const repo = new PostgresAddressRepository(client as IDbClient);
      await repo.setDefault(mockBuyerId, mockAddress2.addressId);

      // Cần có 2 câu lệnh cập nhật hoặc 1 lệnh CTE nguyên tử
      assert.ok(client.queries.length >= 2 || client.queries[0].sql.includes('WITH'));
      const allSql = client.queries.map(q => q.sql).join(';\n');
      assert.ok(allSql.includes('is_default = FALSE') || allSql.includes('is_default = false'));
      assert.ok(allSql.includes('is_default = TRUE') || allSql.includes('is_default = true'));
    });

    it('[TEST-INT-04] Partial unique index violation (RB-LB05): lan truyền lỗi 23505 nguyên vẹn', async () => {
      const client = new MockDbClient();
      const uniqueError = Object.assign(new Error('duplicate key value violates unique constraint "uq_addresses__one_default_per_user"'), {
        code: '23505',
        constraint: 'uq_addresses__one_default_per_user',
      });
      client.customHandler = async () => { throw uniqueError; };

      const repo = new PostgresAddressRepository(client as IDbClient);
      await assert.rejects(
        () => repo.create(mockAddress1),
        (err: unknown) => {
          const e = err as { code?: string; constraint?: string };
          return e.code === '23505' && e.constraint === 'uq_addresses__one_default_per_user';
        }
      );
    });
  });
});
