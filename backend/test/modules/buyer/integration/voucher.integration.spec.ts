import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresVoucherRepository } from '../../../../src/modules/buyer/infrastructure/postgres-voucher.repository';
import { mapVoucher, mapVoucherUsage } from '../../../../src/modules/buyer/infrastructure/row-mappers';
import { mockPlatformVoucher, mockShopVoucher, mockBuyerId, mockShopId } from '../fixtures';
import type { IDbClient } from '../../../../src/modules/buyer/infrastructure/db-client';

class MockDbClient {
  public queries: { sql: string; params: any[] }[] = [];
  public customHandler?: (sql: string, params: any[]) => Promise<any>;

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    this.queries.push({ sql: sql.trim(), params });
    if (this.customHandler) {
      return this.customHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('Phase 3 — PostgresVoucherRepository (SOLID: S, L, D)', () => {
  describe('Row Mappers (SOLID: S — Single Responsibility)', () => {
    it('mapVoucher: chuyển đổi snake_case sang Voucher domain model chuẩn', () => {
      const row = {
        voucher_id: mockPlatformVoucher.voucherId,
        code: 'PLATFORM20',
        voucher_name: 'Giảm giá toàn sàn 20%',
        scope: 'PLATFORM',
        shop_id: null,
        discount_type: 'PERCENT',
        discount_value: '20.00',
        max_discount: '50000.00',
        min_order_value: '100000.00',
        quantity: 50,
        start_at: new Date('2026-09-01T00:00:00.000Z'),
        end_at: new Date('2026-09-30T23:59:59.000Z'),
        status: 'ACTIVE',
        created_at: new Date('2026-09-01T00:00:00.000Z'),
        updated_at: new Date('2026-09-01T00:00:00.000Z'),
      };
      const voucher = mapVoucher(row);
      assert.strictEqual(voucher.voucherId, mockPlatformVoucher.voucherId);
      assert.strictEqual(voucher.code, 'PLATFORM20');
      assert.strictEqual(voucher.discountValue, '20.00');
      assert.strictEqual(voucher.quantity, 50);
    });

    it('mapVoucherUsage: chuyển đổi snake_case sang VoucherUsage domain model', () => {
      const row = {
        usage_id: 'usee1111-1111-4111-8111-111111111111',
        voucher_id: mockPlatformVoucher.voucherId,
        order_id: 'ordd1111-1111-4111-8111-111111111111',
        buyer_id: mockBuyerId,
        discount_amount: '20000.00',
        used_at: new Date('2026-09-17T14:00:00.000Z'),
      };
      const usage = mapVoucherUsage(row);
      assert.strictEqual(usage.usageId, 'usee1111-1111-4111-8111-111111111111');
      assert.strictEqual(usage.discountAmount, '20000.00');
    });
  });

  describe('PostgresVoucherRepository operations (SOLID: L, D)', () => {
    it('[TEST-INT-09] findById: trả về voucher nếu tìm thấy hoặc null nếu không tồn tại', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [{
          voucher_id: mockPlatformVoucher.voucherId,
          code: mockPlatformVoucher.code,
          voucher_name: mockPlatformVoucher.voucherName,
          scope: mockPlatformVoucher.scope,
          shop_id: null,
          discount_type: mockPlatformVoucher.discountType,
          discount_value: mockPlatformVoucher.discountValue,
          max_discount: mockPlatformVoucher.maxDiscount,
          min_order_value: mockPlatformVoucher.minOrderValue,
          quantity: mockPlatformVoucher.quantity,
          start_at: new Date(mockPlatformVoucher.startAt),
          end_at: new Date(mockPlatformVoucher.endAt),
          status: mockPlatformVoucher.status,
          created_at: new Date(mockPlatformVoucher.createdAt),
          updated_at: new Date(mockPlatformVoucher.updatedAt),
        }],
        rowCount: 1,
      });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      const v = await repo.findById(mockPlatformVoucher.voucherId);

      assert.ok(v);
      assert.strictEqual(v.voucherId, mockPlatformVoucher.voucherId);
      assert.ok(client.queries[0].sql.includes('FROM vouchers WHERE voucher_id = $1'));
    });

    it('[TEST-INT-09] findByCode: tìm kiếm chính xác theo mã code', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [{
          voucher_id: mockPlatformVoucher.voucherId,
          code: 'PLATFORM20',
          voucher_name: mockPlatformVoucher.voucherName,
          scope: mockPlatformVoucher.scope,
          shop_id: null,
          discount_type: mockPlatformVoucher.discountType,
          discount_value: mockPlatformVoucher.discountValue,
          max_discount: mockPlatformVoucher.maxDiscount,
          min_order_value: mockPlatformVoucher.minOrderValue,
          quantity: mockPlatformVoucher.quantity,
          start_at: new Date(mockPlatformVoucher.startAt),
          end_at: new Date(mockPlatformVoucher.endAt),
          status: mockPlatformVoucher.status,
          created_at: new Date(mockPlatformVoucher.createdAt),
          updated_at: new Date(mockPlatformVoucher.updatedAt),
        }],
        rowCount: 1,
      });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      const v = await repo.findByCode('PLATFORM20');

      assert.ok(v);
      assert.strictEqual(v.code, 'PLATFORM20');
      assert.ok(client.queries[0].sql.includes('FROM vouchers WHERE code = $1'));
    });

    it('[TEST-INT-10] listActive: lọc theo trạng thái ACTIVE, hiệu lực thời gian và quantity > 0', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 0 });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      await repo.listActive('PLATFORM');

      const sql = client.queries[0].sql;
      assert.ok(sql.includes("status = 'ACTIVE'"));
      assert.ok(sql.includes('start_at <= now()'));
      assert.ok(sql.includes('end_at > now()'));
      assert.ok(sql.includes('quantity > 0'));
      assert.ok(sql.includes("scope = 'PLATFORM'"));
    });

    it('[TEST-INT-10] listActive: lọc theo SHOP scope và shopId cụ thể', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 0 });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      await repo.listActive('SHOP', mockShopId);

      const sql = client.queries[0].sql;
      assert.ok(sql.includes("scope = 'SHOP'"));
      assert.ok(sql.includes('shop_id = $'));
      assert.ok(client.queries[0].params.includes(mockShopId));
    });

    it('[TEST-INT-11] decrementQuantity: trừ số lượng nguyên tử và trả về true nếu thành công', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 1 });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      const success = await repo.decrementQuantity(mockPlatformVoucher.voucherId);

      assert.strictEqual(success, true);
      const sql = client.queries[0].sql;
      assert.ok(sql.includes('UPDATE vouchers'));
      assert.ok(sql.includes('quantity = quantity - 1'));
      assert.ok(sql.includes('quantity > 0'));
    });

    it('[TEST-INT-11] decrementQuantity: trả về false khi hết lượt (quantity = 0)', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 0 });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      const success = await repo.decrementQuantity(mockPlatformVoucher.voucherId);

      assert.strictEqual(success, false);
    });

    it('[TEST-INT-12] incrementQuantity: bù trừ hoàn lại lượt voucher thành công', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 1 });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      const success = await repo.incrementQuantity(mockPlatformVoucher.voucherId);

      assert.strictEqual(success, true);
      const sql = client.queries[0].sql;
      assert.ok(sql.includes('UPDATE vouchers'));
      assert.ok(sql.includes('quantity = quantity + 1'));
    });

    it('[TEST-INT-12] recordUsage: lưu lịch sử sử dụng voucher của đơn hàng', async () => {
      const client = new MockDbClient();
      const mockUsage = {
        usageId: 'usee1111-1111-4111-8111-111111111111',
        voucherId: mockPlatformVoucher.voucherId,
        orderId: 'ordd1111-1111-4111-8111-111111111111',
        buyerId: mockBuyerId,
        discountAmount: '20000.00',
        usedAt: '2026-09-17T14:00:00.000Z',
      };
      client.customHandler = async (_sql, params) => ({
        rows: [{
          usage_id: params[0],
          voucher_id: params[1],
          order_id: params[2],
          buyer_id: params[3],
          discount_amount: params[4],
          used_at: new Date('2026-09-17T14:00:00.000Z'),
        }],
        rowCount: 1,
      });

      const repo = new PostgresVoucherRepository(client as IDbClient);
      const result = await repo.recordUsage(mockUsage);

      assert.strictEqual(result.usageId, mockUsage.usageId);
      assert.strictEqual(result.discountAmount, '20000.00');
      assert.ok(client.queries[0].sql.includes('INSERT INTO voucher_usages'));
    });
  });
});
