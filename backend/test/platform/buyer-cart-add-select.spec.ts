import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { PgBuyerHttpService } from '../../src/modules/buyer/services/pg-buyer-http.service.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const CART_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_ID = '33333333-3333-4333-8333-333333333333';

describe('Buyer Cart - Add Item Selection (TDD)', () => {
  it('đánh dấu is_selected = true khi thêm sản phẩm vào giỏ hàng để sẵn sàng checkout ngay', async () => {
    let capturedInsertIsSelected: boolean | undefined;

    const mockClient = {
      query: async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT') && sql.includes('FROM carts')) {
          return {
            rows: [{ cart_id: CART_ID, buyer_id: BUYER_ID }],
            rowCount: 1,
          };
        }

        if (sql.includes('INSERT INTO cart_items')) {
          capturedInsertIsSelected = params[4] as boolean;
          return {
            rows: [{
              cart_item_id: params[0],
              cart_id: params[1],
              variant_id: params[2],
              quantity: params[3],
              is_selected: params[4],
            }],
            rowCount: 1,
          };
        }

        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };

    const mockPool = {
      connect: async () => mockClient,
    } as unknown as Pool;

    const service = new PgBuyerHttpService(mockPool);
    const context = createRequestContext({
      request_id: 'req_cart_test',
      user_id: BUYER_ID,
      role: 'BUYER',
    });

    const result = await service.addCartItem(context, {
      variant_id: VARIANT_ID,
      quantity: 1,
    }) as { is_selected: boolean; variant_id: string; quantity: number };

    assert.equal(capturedInsertIsSelected, true, 'Giá trị is_selected khi INSERT vào DB phải là true');
    assert.equal(result.is_selected, true, 'Giá trị trả về của addCartItem phải có is_selected = true');
  });
});
