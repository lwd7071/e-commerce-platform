import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeTransactionalCheckout } from '../../../src/modules/checkout/services/transactional-checkout.service.ts';
import { OrderLifecycleService } from '../../../src/modules/order/services/order-lifecycle.service.ts';
import { InMemoryOrderRepository } from '../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { InMemoryPaymentRepository } from '../../../src/modules/payment/repositories/in-memory-payment.repository.ts';
import { InMemoryIdempotencyAdapter } from '../../../src/modules/checkout/domain/in-memory-idempotency.ts';
import type { ICartPort } from '../../../src/modules/buyer/ports/cart.port.ts';
import type { ICatalogPort } from '../../../src/modules/catalog/ports/catalog.port.ts';
import type { IVoucherPort } from '../../../src/modules/buyer/ports/voucher.port.ts';
import type { CheckoutCommand } from '../../../src/modules/checkout/contracts/checkout-command.ts';

describe('Transactional Checkout & Order Lifecycle Integration Tests', () => {
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let idempotencyPort: InMemoryIdempotencyAdapter<any>;

  const buyerId = 'buyer-001';
  const shopId = 'shop-001';
  const variantId = 'var-001';
  const productId = 'prod-001';

  let currentStock = 10;
  let clearedCartItemIds: string[] = [];
  let consumedVouchers: string[] = [];

  const mockCartPort: ICartPort = {
    async getSelectedItems(bId: string) {
      return [
        {
          cartItemId: 'cart-item-1',
          variantId,
          quantity: 2,
          isSelected: true,
        },
      ];
    },
    async clearCheckedOutItems(bId: string, itemIds: string[]) {
      clearedCartItemIds.push(...itemIds);
    },
  };

  const mockCatalogPort: ICatalogPort = {
    async getVariantPriceAndStock(vId: string) {
      return {
        variantId: vId,
        productId,
        productName: 'Áo Thun Nam',
        variantName: 'Size L',
        variantValue: 'Trắng',
        price: '200000.00',
        stockQuantity: currentStock,
        status: 'ACTIVE',
      };
    },
    async lockVariant(vId: string, quantity: number) {
      if (currentStock < quantity) {
        throw new Error('INVENTORY_INSUFFICIENT');
      }
      currentStock -= quantity;
      return {
        variantId: vId,
        requestedQuantity: quantity,
        priceSnapshot: '200000.00',
        remainingStock: currentStock,
      };
    },
    async checkShopActive(sId: string) {
      return true;
    },
  };

  const mockVoucherPort: IVoucherPort = {
    async evaluateVoucher(ctx) {
      return {
        isValid: true,
        voucherId: 'vouch-999',
        discountAmount: '50000.00',
      };
    },
    async consumeVoucher(params) {
      consumedVouchers.push(params.voucherId);
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

  const addressResolver = async () => ({
    recipientName: 'Lê Văn C',
    recipientPhone: '0912345678',
    province: 'Đà Nẵng',
    district: 'Hải Châu',
    ward: 'Hải Châu 1',
    deliveryAddress: '45 Lê Duẩn',
  });

  const shopResolver = async () => shopId;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    idempotencyPort = new InMemoryIdempotencyAdapter<any>();
    currentStock = 10;
    clearedCartItemIds = [];
    consumedVouchers = [];
  });

  it('Happy Path: executes 12 steps, creates order, payment, consumes voucher, clears cart', async () => {
    const command: CheckoutCommand = {
      idempotency_key: 'req_idemp_001',
      address_id: 'addr-001',
      payment_method: 'COD',
      vouchers: [{ shop_id: shopId, code: 'GIAM50K' }],
    };

    const result = await executeTransactionalCheckout({
      buyerId,
      command,
      cartPort: mockCartPort,
      catalogPort: mockCatalogPort,
      voucherPort: mockVoucherPort,
      orderRepo,
      paymentRepo,
      shopResolver,
      addressResolver,
      idempotencyPort,
    });

    assert.equal(result.orders.length, 1);
    const orderResult = result.orders[0];
    assert.equal(orderResult.shop_id, shopId);
    assert.equal(orderResult.total_amount, '350000.00'); // 400k subtotal - 50k discount
    assert.equal(orderResult.status, 'PENDING_CONFIRMATION');

    // Verify DB writes
    const savedOrder = await orderRepo.findById(orderResult.order_id);
    assert.ok(savedOrder);
    assert.equal(savedOrder.recipientName, 'Lê Văn C');
    assert.equal(savedOrder.totalAmount, '350000.00');

    // Verify Payment attempt
    const payments = await paymentRepo.findByOrderId(orderResult.order_id);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].status, 'PENDING');
    assert.equal(payments[0].amount, '350000.00');

    // Verify stock & cart
    assert.equal(currentStock, 8); // 10 - 2
    assert.deepEqual(clearedCartItemIds, ['cart-item-1']);
    assert.deepEqual(consumedVouchers, ['vouch-999']);
  });

  it('Cancel & Restock: cancels pending order and restocks variant quantity', async () => {
    let restockedCount = 0;
    const restockHandler = async (vId: string, quantity: number) => {
      restockedCount += quantity;
      currentStock += quantity;
    };

    const lifecycleService = new OrderLifecycleService({
      orderRepo,
      restockHandler,
    });

    // 1. Setup existing order
    const orderId = 'order-cancel-test';
    await orderRepo.createOrder(
      {
        orderId,
        buyerId,
        shopId,
        recipientName: 'A',
        recipientPhone: '090',
        province: 'HCM',
        district: '1',
        ward: '1',
        deliveryAddress: 'Lê Duẩn',
        subtotal: '400000.00',
        discountAmount: '0.00',
        shippingFee: '0.00',
        totalAmount: '400000.00',
        status: 'PENDING_CONFIRMATION',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        {
          orderItemId: 'oi-1',
          orderId,
          productId,
          variantId,
          productNameSnapshot: 'Áo',
          variantSnapshot: 'L',
          unitPrice: '200000.00',
          quantity: 2,
          lineTotal: '400000.00',
        },
      ],
      {
        historyId: 'h-1',
        orderId,
        oldStatus: null,
        newStatus: 'PENDING_CONFIRMATION',
        changedBy: buyerId,
        reason: null,
        changedAt: new Date().toISOString(),
      },
    );

    // 2. Buyer cancels order
    await lifecycleService.cancelOrder(orderId, { kind: 'BUYER', userId: buyerId }, 'Đổi ý không mua nữa');

    // 3. Verify order status
    const cancelledOrder = await orderRepo.findById(orderId);
    assert.equal(cancelledOrder?.status, 'CANCELLED');

    // 4. Verify history has reason
    const history = await orderRepo.findHistoryByOrderId(orderId);
    assert.equal(history.length, 2);
    assert.equal(history[1].newStatus, 'CANCELLED');
    assert.equal(history[1].reason, 'Đổi ý không mua nữa');

    // 5. Verify restock called
    assert.equal(restockedCount, 2);
  });
});
