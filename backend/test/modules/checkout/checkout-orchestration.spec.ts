import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeCheckout } from '../../../src/modules/checkout/domain/checkout-orchestrator.ts';
import type { CheckoutCommand } from '../../../src/modules/checkout/contracts/checkout-command.ts';
import type { ICartPort, SelectedCartItemSnapshot } from '../../../src/modules/buyer/ports/cart.port.ts';
import type { ICatalogPort, VariantPriceAndStockDTO, LockVariantResultDTO } from '../../../src/modules/catalog/ports/catalog.port.ts';
import type { IVoucherPort, EvaluateVoucherContext, VoucherEvaluationResult } from '../../../src/modules/buyer/ports/voucher.port.ts';
import type { IdempotencyPort, IdempotencyScope, IdempotencyClaim } from '../../../src/modules/checkout/contracts/idempotency.port.ts';
import type { CheckoutResult } from '../../../src/modules/checkout/contracts/checkout-result.ts';

// Test Fixtures & Helpers
const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const ADDRESS_ID = '22222222-2222-4222-8222-222222222222';
const SHOP_1 = '33333333-3333-4333-8333-333333333331';
const SHOP_2 = '33333333-3333-4333-8333-333333333332';
const PRODUCT_1 = '44444444-4444-4444-8444-444444444441';
const PRODUCT_2 = '44444444-4444-4444-8444-444444444442';
const VARIANT_1 = '55555555-5555-4555-8555-555555555551';
const VARIANT_2 = '55555555-5555-4555-8555-555555555552';

function createMockCartPort(items: SelectedCartItemSnapshot[]): ICartPort & { clearedCartItemIds: string[] } {
  const clearedCartItemIds: string[] = [];
  return {
    clearedCartItemIds,
    async getSelectedItems(_buyerId: string) {
      return items;
    },
    async clearCheckedOutItems(_buyerId: string, cartItemIds: string[]) {
      clearedCartItemIds.push(...cartItemIds);
    },
  };
}

function createMockCatalogPort(options?: {
  variants?: Record<string, Partial<VariantPriceAndStockDTO>>;
  activeShops?: Record<string, boolean>;
}): ICatalogPort & { lockedVariants: { variantId: string; quantity: number }[] } {
  const lockedVariants: { variantId: string; quantity: number }[] = [];
  const variantMap: Record<string, VariantPriceAndStockDTO> = {
    [VARIANT_1]: {
      variantId: VARIANT_1,
      productId: PRODUCT_1,
      productName: 'Sản phẩm 1',
      variantName: 'Màu sắc',
      variantValue: 'Đỏ',
      price: '100000.00',
      stockQuantity: 10,
      status: 'ACTIVE',
      ...options?.variants?.[VARIANT_1],
    },
    [VARIANT_2]: {
      variantId: VARIANT_2,
      productId: PRODUCT_2,
      productName: 'Sản phẩm 2',
      variantName: 'Kích cỡ',
      variantValue: 'XL',
      price: '50000.00',
      stockQuantity: 5,
      status: 'ACTIVE',
      ...options?.variants?.[VARIANT_2],
    },
  };

  return {
    lockedVariants,
    async getVariantPriceAndStock(variantId: string) {
      const v = variantMap[variantId];
      if (!v) throw Object.assign(new Error('Variant not found'), { code: 'RESOURCE_NOT_FOUND' });
      return v;
    },
    async lockVariant(variantId: string, quantity: number): Promise<LockVariantResultDTO> {
      const v = variantMap[variantId];
      if (!v) throw Object.assign(new Error('Variant not found'), { code: 'RESOURCE_NOT_FOUND' });
      lockedVariants.push({ variantId, quantity });
      return {
        variantId,
        requestedQuantity: quantity,
        priceSnapshot: v.price,
        remainingStock: v.stockQuantity - quantity,
      };
    },
    async checkShopActive(shopId: string) {
      return options?.activeShops?.[shopId] ?? true;
    },
  };
}

function createMockVoucherPort(options?: {
  discountAmount?: string;
  failEvaluation?: boolean;
}): IVoucherPort & { consumedVouchers: any[] } {
  const consumedVouchers: any[] = [];
  return {
    consumedVouchers,
    async evaluateVoucher(context: EvaluateVoucherContext): Promise<VoucherEvaluationResult> {
      if (options?.failEvaluation) {
        return {
          isValid: false,
          errorCode: 'VOUCHER_NOT_APPLICABLE',
          errorMessage: 'Voucher không hợp lệ.',
        };
      }
      return {
        isValid: true,
        voucherId: 'voucher-1',
        discountAmount: options?.discountAmount ?? '20000.00',
      };
    },
    async consumeVoucher(params: {
      voucherId: string;
      orderId: string;
      buyerId: string;
      discountAmount: string;
    }) {
      consumedVouchers.push(params);
      return {
        usageId: 'usage-1',
        voucherId: params.voucherId,
        orderId: params.orderId,
        buyerId: params.buyerId,
        discountAmount: params.discountAmount,
        usedAt: new Date().toISOString(),
      };
    },
  };
}

const defaultShopResolver = (productId: string) => {
  if (productId === PRODUCT_2) return SHOP_2;
  return SHOP_1;
};

// =================== TEST SUITES ===================

test('[QD07/QD08/QD11] Single shop happy path creates 1 Order with exact snapshot and totals', async () => {
  const cartPort = createMockCartPort([
    { cartItemId: 'item-1', variantId: VARIANT_1, quantity: 2, isSelected: true },
    { cartItemId: 'item-2', variantId: VARIANT_2, quantity: 1, isSelected: true },
  ]);
  // Both products belong to SHOP_1
  const catalogPort = createMockCatalogPort();
  const voucherPort = createMockVoucherPort();
  const shopResolver = () => SHOP_1;

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'COD',
    vouchers: [],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  const result = await executeCheckout({
    buyerId: BUYER_ID,
    command,
    cartPort,
    catalogPort,
    voucherPort,
    shopResolver,
  });

  // Verify Checkout Result
  assert.equal(result.orders.length, 1);
  const order = result.orders[0];
  assert.equal(order.shop_id, SHOP_1);
  assert.equal(order.status, 'PENDING_CONFIRMATION');
  // (100000 * 2) + (50000 * 1) = 250000.00
  assert.equal(order.total_amount, '250000.00');
  assert.ok(order.order_id);
  assert.ok(order.payment_id);

  // Verify Cart cleared
  assert.deepEqual(cartPort.clearedCartItemIds.sort(), ['item-1', 'item-2'].sort());

  // Verify Variants locked
  assert.equal(catalogPort.lockedVariants.length, 2);
  assert.deepEqual(catalogPort.lockedVariants, [
    { variantId: VARIANT_1, quantity: 2 },
    { variantId: VARIANT_2, quantity: 1 },
  ]);
});

test('[Order Workflow §4] Multi-shop checkout splits into separate orders atomically', async () => {
  const cartPort = createMockCartPort([
    { cartItemId: 'item-1', variantId: VARIANT_1, quantity: 1, isSelected: true },
    { cartItemId: 'item-2', variantId: VARIANT_2, quantity: 2, isSelected: true },
  ]);
  const catalogPort = createMockCatalogPort();
  const voucherPort = createMockVoucherPort();

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'ONLINE',
    vouchers: [],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  const result = await executeCheckout({
    buyerId: BUYER_ID,
    command,
    cartPort,
    catalogPort,
    voucherPort,
    shopResolver: defaultShopResolver,
  });

  assert.equal(result.orders.length, 2);

  const shop1Order = result.orders.find(o => o.shop_id === SHOP_1);
  assert.ok(shop1Order);
  assert.equal(shop1Order.total_amount, '100000.00'); // 1 * 100000.00

  const shop2Order = result.orders.find(o => o.shop_id === SHOP_2);
  assert.ok(shop2Order);
  assert.equal(shop2Order.total_amount, '100000.00'); // 2 * 50000.00

  assert.equal(cartPort.clearedCartItemIds.length, 2);
});

test('[QD09/RB-LQH03] Voucher applies discount correctly to the matching shop order', async () => {
  const cartPort = createMockCartPort([
    { cartItemId: 'item-1', variantId: VARIANT_1, quantity: 2, isSelected: true }, // Subtotal = 200000.00
  ]);
  const catalogPort = createMockCatalogPort();
  const voucherPort = createMockVoucherPort({ discountAmount: '30000.00' });

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'COD',
    vouchers: [{ shop_id: SHOP_1, code: 'DISCOUNT30' }],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  const result = await executeCheckout({
    buyerId: BUYER_ID,
    command,
    cartPort,
    catalogPort,
    voucherPort,
    shopResolver: () => SHOP_1,
  });

  assert.equal(result.orders.length, 1);
  // Total = 200000.00 - 30000.00 = 170000.00
  assert.equal(result.orders[0].total_amount, '170000.00');
  assert.equal(voucherPort.consumedVouchers.length, 1);
  assert.equal(voucherPort.consumedVouchers[0].discountAmount, '30000.00');
});

test('[QD07/RB-LQH06] Insufficient stock rejects checkout with INVENTORY_INSUFFICIENT without clearing cart', async () => {
  const cartPort = createMockCartPort([
    { cartItemId: 'item-1', variantId: VARIANT_1, quantity: 20, isSelected: true }, // Requested 20, available 10
  ]);
  const catalogPort = createMockCatalogPort();
  const voucherPort = createMockVoucherPort();

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'COD',
    vouchers: [],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  await assert.rejects(
    () =>
      executeCheckout({
        buyerId: BUYER_ID,
        command,
        cartPort,
        catalogPort,
        voucherPort,
        shopResolver: () => SHOP_1,
      }),
    (err: any) => err.code === 'INVENTORY_INSUFFICIENT',
  );

  // Cart must NOT be cleared on failure
  assert.equal(cartPort.clearedCartItemIds.length, 0);
  assert.equal(catalogPort.lockedVariants.length, 0);
  assert.equal(catalogPort.lockedVariants.length, 0);
});

test('[QD06/RB-MG12] Inactive variant rejects checkout with VALIDATION_FAILED', async () => {
  const cartPort = createMockCartPort([
    { cartItemId: 'item-1', variantId: VARIANT_1, quantity: 1, isSelected: true },
  ]);
  const catalogPort = createMockCatalogPort({
    variants: {
      [VARIANT_1]: { status: 'INACTIVE' },
    },
  });
  const voucherPort = createMockVoucherPort();

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'COD',
    vouchers: [],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  await assert.rejects(
    () =>
      executeCheckout({
        buyerId: BUYER_ID,
        command,
        cartPort,
        catalogPort,
        voucherPort,
        shopResolver: () => SHOP_1,
      }),
    (err: any) => err.code === 'VALIDATION_FAILED',
  );
});

test('[Order Workflow §4] Inactive shop rejects checkout with VALIDATION_FAILED', async () => {
  const cartPort = createMockCartPort([
    { cartItemId: 'item-1', variantId: VARIANT_1, quantity: 1, isSelected: true },
  ]);
  const catalogPort = createMockCatalogPort({
    activeShops: { [SHOP_1]: false },
  });
  const voucherPort = createMockVoucherPort();

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'COD',
    vouchers: [],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  await assert.rejects(
    () =>
      executeCheckout({
        buyerId: BUYER_ID,
        command,
        cartPort,
        catalogPort,
        voucherPort,
        shopResolver: () => SHOP_1,
      }),
    (err: any) => err.code === 'VALIDATION_FAILED',
  );
});

test('[Cart Invariant] Empty cart selection rejects checkout with VALIDATION_FAILED', async () => {
  const cartPort = createMockCartPort([]);
  const catalogPort = createMockCatalogPort();
  const voucherPort = createMockVoucherPort();

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'COD',
    vouchers: [],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  await assert.rejects(
    () =>
      executeCheckout({
        buyerId: BUYER_ID,
        command,
        cartPort,
        catalogPort,
        voucherPort,
        shopResolver: () => SHOP_1,
      }),
    (err: any) => err.code === 'VALIDATION_FAILED',
  );
});

test('[Idempotency §6] Replay returns cached result immediately; conflict throws IDEMPOTENCY_KEY_REUSED', async () => {
  const cachedResult: CheckoutResult = {
    orders: [
      {
        order_id: 'cached-order-1',
        shop_id: SHOP_1,
        status: 'PENDING_CONFIRMATION',
        total_amount: '99000.00',
        payment_id: 'cached-payment-1',
      },
    ],
  };

  let claimResult: IdempotencyClaim<CheckoutResult> = {
    kind: 'replay',
    result: cachedResult,
  };

  const mockIdempotencyPort: IdempotencyPort<CheckoutResult> = {
    async claim() {
      return claimResult;
    },
    async complete() {},
    async release() {},
  };

  const cartPort = createMockCartPort([]);
  const catalogPort = createMockCatalogPort();
  const voucherPort = createMockVoucherPort();

  const command: CheckoutCommand = {
    address_id: ADDRESS_ID,
    payment_method: 'COD',
    vouchers: [],
    idempotency_key: 'idem-key-1234567890abcdef',
  };

  // Replay should return cachedResult without touching cart
  const result = await executeCheckout({
    buyerId: BUYER_ID,
    command,
    cartPort,
    catalogPort,
    voucherPort,
    shopResolver: () => SHOP_1,
    idempotencyPort: mockIdempotencyPort,
  });

  assert.deepEqual(result, cachedResult);

  // Now test conflict
  claimResult = { kind: 'conflict' };
  await assert.rejects(
    () =>
      executeCheckout({
        buyerId: BUYER_ID,
        command,
        cartPort,
        catalogPort,
        voucherPort,
        shopResolver: () => SHOP_1,
        idempotencyPort: mockIdempotencyPort,
      }),
    (err: any) => err.code === 'IDEMPOTENCY_KEY_REUSED',
  );

  // Now test in_progress
  claimResult = { kind: 'in_progress' };
  await assert.rejects(
    () =>
      executeCheckout({
        buyerId: BUYER_ID,
        command,
        cartPort,
        catalogPort,
        voucherPort,
        shopResolver: () => SHOP_1,
        idempotencyPort: mockIdempotencyPort,
      }),
    (err: any) => err.code === 'REQUEST_IN_PROGRESS',
  );
});
