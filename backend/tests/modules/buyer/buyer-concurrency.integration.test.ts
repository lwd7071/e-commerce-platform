import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool, PoolClient } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../../db/client.js';
import {
  ensureAuthUser,
  createFixtureUser,
} from '../../db/fixtures/database-fixtures.js';
import { PostgresVoucherRepository } from '../../../src/modules/buyer/infrastructure/postgres-voucher.repository.js';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const suite = runRemoteDbTests ? describe : describe.skip;

suite('Buyer Domain Concurrency & Race Conditions Integration (T3 Quality Gate)', () => {
  let pool: Pool | undefined;

  before(async () => {
    const config = loadDatabaseConfig(process.env);
    // Cấp pool tối đa 5 connections để chạy các test 2 connections song song
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 5 } });
  });

  after(async () => {
    if (pool) {
      await closeDatabasePool(pool);
    }
  });

  const makeTestBuyer = async (client: PoolClient) => {
    const userId = randomUUID();
    const email = `buyer_race_${randomUUID().slice(0, 8)}@example.com`;
    await ensureAuthUser(client, userId, email);
    return createFixtureUser(client, { userId, email, role: 'BUYER' });
  };

  describe('Race Condition 1: Address Default Concurrency [RB-LB05]', () => {
    it('2 PoolClients đồng thời insert default address cho cùng 1 user -> 1 pass, 1 dính 23505', async () => {
      if (!pool) throw new Error('Pool not initialized');

      // Tạo user trước
      const setupClient = await pool.connect();
      let buyer: Awaited<ReturnType<typeof makeTestBuyer>>;
      try {
        buyer = await makeTestBuyer(setupClient);
      } finally {
        setupClient.release();
      }

      // Khởi tạo 2 PoolClient RIÊNG BIỆT để tránh pg serialize tuần tự
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      const addrId1 = randomUUID();
      const addrId2 = randomUUID();

      try {
        // Barrier kích hoạt cùng lúc
        const results = await Promise.allSettled([
          client1.query(
            `INSERT INTO addresses (
               address_id, user_id, recipient_name, phone, province,
               district, ward, detail_address, is_default
             ) VALUES (
               $1, $2, 'Người nhận A', '0901111111', 'Hà Nội',
               'Hoàn Kiếm', 'Hàng Bạc', 'Số 1 Phố Cổ', TRUE
             )`,
            [addrId1, buyer.userId]
          ),
          client2.query(
            `INSERT INTO addresses (
               address_id, user_id, recipient_name, phone, province,
               district, ward, detail_address, is_default
             ) VALUES (
               $1, $2, 'Người nhận B', '0902222222', 'Hà Nội',
               'Ba Đình', 'Điện Biên', 'Số 2 Hoàng Diệu', TRUE
             )`,
            [addrId2, buyer.userId]
          ),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        assert.equal(fulfilled.length, 1, 'Đúng 1 client insert thành công default address');
        assert.equal(rejected.length, 1, 'Đúng 1 client bị reject do vi phạm partial unique index');

        const error = (rejected[0] as PromiseRejectedResult).reason;
        assert.equal(error.code, '23505', 'Mã lỗi phải là SQLSTATE 23505 Unique Violation');
        assert.match(error.message, /uq_addresses__one_default_per_user/, 'Tên constraint phải là uq_addresses__one_default_per_user');

        // Kiểm tra trong DB: user chỉ có đúng 1 default address
        const checkRes = await pool.query(
          `SELECT COUNT(*)::int AS default_count FROM addresses WHERE user_id = $1 AND is_default = TRUE`,
          [buyer.userId]
        );
        assert.equal(checkRes.rows[0].default_count, 1, 'Trong DB chỉ tồn tại duy nhất 1 default address cho user này');
      } finally {
        // Cleanup data
        await pool.query('DELETE FROM addresses WHERE user_id = $1', [buyer.userId]);
        await pool.query('DELETE FROM app_users WHERE user_id = $1', [buyer.userId]);
        client1.release();
        client2.release();
      }
    });
  });

  describe('Race Condition 2: Voucher Last Quantity Concurrency [QD09]', () => {
    it('2 PoolClients đồng thời claim voucher chỉ còn 1 lượt -> đúng 1 client thành công, quantity không âm', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const voucherId = randomUUID();
      const voucherCode = `RACE_${randomUUID().slice(0, 8).toUpperCase()}`;

      // Insert voucher có quantity = 1
      await pool.query(
        `INSERT INTO vouchers (
           voucher_id, code, voucher_name, scope, shop_id, discount_type,
           discount_value, min_order_value, quantity, start_at, end_at, status
         ) VALUES (
           $1, $2, 'Race Test Voucher', 'PLATFORM', NULL, 'FIXED',
           20000, 100000, 1, now() - interval '1 hour', now() + interval '1 day', 'ACTIVE'
         )`,
        [voucherId, voucherCode]
      );

      // Mở 2 PoolClients độc lập
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      try {
        const repo1 = new PostgresVoucherRepository(client1);
        const repo2 = new PostgresVoucherRepository(client2);

        // Barrier cùng chạy decrementQuantity đồng thời
        const [success1, success2] = await Promise.all([
          repo1.decrementQuantity(voucherId),
          repo2.decrementQuantity(voucherId),
        ]);

        // Đúng 1 worker thành công, 1 worker thất bại
        const successCount = (success1 ? 1 : 0) + (success2 ? 1 : 0);
        assert.equal(successCount, 1, 'Đúng 1 worker decrement voucher thành công');

        // Kiểm tra số lượng voucher trong database: đúng bằng 0, không bị âm
        const checkRes = await pool.query(
          `SELECT quantity FROM vouchers WHERE voucher_id = $1`,
          [voucherId]
        );
        assert.equal(checkRes.rows[0].quantity, 0, 'Quantity voucher phải bằng đúng 0, không được âm');
      } finally {
        await pool.query('DELETE FROM vouchers WHERE voucher_id = $1', [voucherId]);
        client1.release();
        client2.release();
      }
    });
  });
});
