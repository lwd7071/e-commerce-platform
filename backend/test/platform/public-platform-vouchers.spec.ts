import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { VoucherService } from '../../src/modules/buyer/services/voucher.service.ts';
import type { IVoucherRepository } from '../../src/modules/buyer/domain/repositories.ts';
import type { Voucher } from '../../src/modules/buyer/domain/types.ts';

const now = Date.now();
const timestamp = (offset: number) => new Date(now + offset).toISOString();

function voucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    voucherId: '00000000-0000-4000-8000-000000000001',
    code: 'PLATFORM50',
    voucherName: 'Ưu đãi toàn sàn',
    scope: 'PLATFORM',
    shopId: null,
    discountType: 'FIXED',
    discountValue: '50000.00',
    maxDiscount: null,
    minOrderValue: '300000.00',
    quantity: 10,
    startAt: timestamp(-60_000),
    endAt: timestamp(60_000),
    status: 'ACTIVE',
    createdAt: timestamp(-120_000),
    updatedAt: timestamp(-120_000),
    ...overrides,
  };
}

describe('Public platform vouchers HTTP route', () => {
  it('shows only eligible public platform vouchers without requiring a Buyer session', async () => {
    const activeVoucher = voucher();
    const repository = {
      async listActive() {
        return [
          activeVoucher,
          voucher({ voucherId: 'shop', code: 'SHOP50', scope: 'SHOP', shopId: 'shop-1' }),
          voucher({ voucherId: 'expired', code: 'EXPIRED', endAt: timestamp(-1) }),
          voucher({ voucherId: 'future', code: 'FUTURE', startAt: timestamp(60_000) }),
          voucher({ voucherId: 'inactive', code: 'INACTIVE', status: 'INACTIVE' }),
          voucher({ voucherId: 'empty', code: 'EMPTY', quantity: 0 }),
          voucher({ voucherId: 'private', code: 'PRIVATE', loyaltyOwnerId: 'buyer-1' }),
        ];
      },
    } as unknown as IVoucherRepository;
    const app = createApp({ buyerServices: { publicVoucherService: new VoucherService(repository) } });

    const response = await request(app).get('/api/v1/vouchers/public').expect(200);
    await request(app).get('/api/v1/vouchers/applicable').expect(401);

    assert.deepStrictEqual(response.body.data, [{
      voucherId: '00000000-0000-4000-8000-000000000001',
      code: 'PLATFORM50',
      voucherName: 'Ưu đãi toàn sàn',
      discountType: 'FIXED',
      discountValue: '50000.00',
      maxDiscount: null,
      minOrderValue: '300000.00',
      startAt: activeVoucher.startAt,
      endAt: activeVoucher.endAt,
    }]);
  });
});
