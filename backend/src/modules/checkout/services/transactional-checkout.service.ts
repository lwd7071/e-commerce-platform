import type { Pool, PoolClient } from 'pg';
import type { CheckoutCommand } from '../contracts/checkout-command.ts';
import type { CheckoutResult, CheckoutOrderResult } from '../contracts/checkout-result.ts';
import type { ICartPort } from '../../buyer/ports/cart.port.ts';
import type { ICatalogPort } from '../../catalog/ports/catalog.port.ts';
import type { VariantPriceAndStockDTO } from '../../catalog/ports/catalog.port.ts';
import type { IVoucherPort } from '../../buyer/ports/voucher.port.ts';
import type { IdempotencyPort, IdempotencyScope } from '../contracts/idempotency.port.ts';
import type { IOrderRepository, OrderRecord, OrderItemRecord } from '../../order/domain/repositories.ts';
import type { IPaymentRepository, PaymentRecord } from '../../payment/domain/repositories.ts';
import { calculateOrderTotals } from '../../order/domain/order-calculation.ts';
import {
  buildOrderItemSnapshot,
  createOrderStatusHistoryRecord,
} from '../../order/domain/order-snapshot.ts';
import { withTransaction } from '../../../../db/transaction.ts';

export type UUID = string;

export class TransactionalCheckoutError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TransactionalCheckoutError';
    this.code = code;
  }
}

export interface IShopResolver {
  (productId: UUID, client?: PoolClient): Promise<UUID> | UUID;
}

export interface AddressResolver {
  (addressId: UUID, buyerId: UUID): Promise<{
    recipientName: string;
    recipientPhone: string;
    province: string;
    district: string;
    ward: string;
    deliveryAddress: string;
  }>;
}

export interface TransactionalCheckoutDependencies {
  readonly pool?: Pool;
  readonly buyerId: UUID;
  readonly command: CheckoutCommand;
  readonly cartPort: ICartPort;
  readonly catalogPort: ICatalogPort;
  readonly voucherPort: IVoucherPort;
  readonly orderRepo: IOrderRepository;
  readonly paymentRepo: IPaymentRepository;
  readonly shopResolver: IShopResolver;
  readonly addressResolver: AddressResolver;
  readonly idempotencyPort?: IdempotencyPort<CheckoutResult>;
  readonly now?: () => string;
}

/**
 * Executes atomic 12-step checkout orchestration persisting to PostgreSQL via withTransaction.
 */
export async function executeTransactionalCheckout(
  deps: TransactionalCheckoutDependencies,
): Promise<CheckoutResult> {
  const {
    pool,
    buyerId,
    command,
    cartPort,
    catalogPort,
    voucherPort,
    orderRepo,
    paymentRepo,
    shopResolver,
    addressResolver,
    idempotencyPort,
  } = deps;

  let idempotencyScope: IdempotencyScope | null = null;
  let ownershipToken: string | null = null;

  // Step 0: Idempotency claim
  if (idempotencyPort) {
    idempotencyScope = {
      user_id: buyerId,
      endpoint: '/api/v1/orders',
      key: command.idempotency_key,
    };
    const fingerprint = JSON.stringify({
      address_id: command.address_id,
      payment_method: command.payment_method,
      vouchers: command.vouchers,
    });
    const claim = await idempotencyPort.claim(idempotencyScope, fingerprint);
    if (claim.kind === 'replay') {
      return claim.result;
    }
    if (claim.kind === 'conflict') {
      throw new TransactionalCheckoutError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency key was reused with a different payload.',
      );
    }
    if (claim.kind === 'in_progress') {
      throw new TransactionalCheckoutError(
        'REQUEST_IN_PROGRESS',
        'A request with this idempotency key is currently processing.',
      );
    }
    ownershipToken = claim.ownership_token;
  }

  // Orchestration worker logic inside transaction
  const runWorkflow = async (client?: PoolClient): Promise<CheckoutResult> => {
    // Step 1: Load selected cart items
    const cartItems = await cartPort.getSelectedItems(buyerId);
    const selectedItems = (cartItems || []).filter(item => item.isSelected);
    if (selectedItems.length === 0) {
      throw new TransactionalCheckoutError('VALIDATION_FAILED', 'No selected items in cart.');
    }

    // Step 2: Resolve address snapshot
    const address = await addressResolver(command.address_id, buyerId);

    // Step 3-4: Stable sort by variantId to prevent deadlocks; fetch and lock variant
    const sortedItems = [...selectedItems].sort((a, b) => a.variantId.localeCompare(b.variantId));
    const variantMap = new Map<string, VariantPriceAndStockDTO>();
    const itemShopMap = new Map<string, UUID>();

    for (const item of sortedItems) {
      const variant = await catalogPort.getVariantPriceAndStock(item.variantId);
      if (variant.status !== 'ACTIVE') {
        throw new TransactionalCheckoutError('VALIDATION_FAILED', `Variant ${item.variantId} is not active.`);
      }
      if (variant.stockQuantity < item.quantity) {
        throw new TransactionalCheckoutError(
          'INVENTORY_INSUFFICIENT',
          `Insufficient stock for variant ${item.variantId}. Available: ${variant.stockQuantity}, requested: ${item.quantity}.`,
        );
      }
      const shopId = await shopResolver(variant.productId, client);
      const isShopActive = await catalogPort.checkShopActive(shopId);
      if (!isShopActive) {
        throw new TransactionalCheckoutError('VALIDATION_FAILED', `Shop ${shopId} is not active.`);
      }

      variantMap.set(item.variantId, variant);
      itemShopMap.set(item.variantId, shopId);
    }

    // Step 5: Group by shop & calculate discounts
    const shopGroups = new Map<UUID, typeof sortedItems>();
    for (const item of sortedItems) {
      const shopId = itemShopMap.get(item.variantId)!;
      const existing = shopGroups.get(shopId) ?? [];
      existing.push(item);
      shopGroups.set(shopId, existing);
    }

    interface PreparedOrder {
      shopId: UUID;
      orderId: UUID;
      paymentId: UUID;
      items: OrderItemRecord[];
      subtotal: string;
      discountAmount: string;
      shippingFee: string;
      totalAmount: string;
      voucherIdToConsume: UUID | null;
    }

    const preparedOrders: PreparedOrder[] = [];

    for (const [shopId, items] of shopGroups.entries()) {
      const lines = items.map(item => ({
        unit_price: variantMap.get(item.variantId)!.price,
        quantity: item.quantity,
      }));

      const initialCalc = calculateOrderTotals({
        lines,
        discount_amount: '0.00',
        shipping_fee: '0.00',
      });

      let discountAmount = '0.00';
      let voucherIdToConsume: UUID | null = null;

      const voucherCandidate = command.vouchers.find(v => v.shop_id === shopId);
      if (voucherCandidate) {
        const evalResult = await voucherPort.evaluateVoucher({
          code: voucherCandidate.code,
          buyerId,
          orderSubtotal: initialCalc.subtotal,
          shopId,
          now: deps.now?.(),
        });
        if (!evalResult.isValid) {
          throw new TransactionalCheckoutError(
            evalResult.errorCode || 'VOUCHER_NOT_APPLICABLE',
            evalResult.errorMessage || 'Voucher is not applicable.',
          );
        }
        discountAmount = evalResult.discountAmount;
        voucherIdToConsume = evalResult.voucherId;
      }

      const finalCalc = calculateOrderTotals({
        lines,
        discount_amount: discountAmount,
        shipping_fee: '0.00',
      });

      const orderId = crypto.randomUUID();
      const paymentId = crypto.randomUUID();

      const orderItemRecords: OrderItemRecord[] = items.map(item => {
        const v = variantMap.get(item.variantId)!;
        return buildOrderItemSnapshot({
          orderId,
          productId: v.productId,
          variantId: v.variantId,
          productName: v.productName || 'Sản phẩm',
          variantName: v.variantName,
          variantValue: v.variantValue,
          unitPrice: v.price,
          quantity: item.quantity,
        });
      });

      preparedOrders.push({
        shopId,
        orderId,
        paymentId,
        items: orderItemRecords,
        subtotal: finalCalc.subtotal,
        discountAmount: finalCalc.discount_amount,
        shippingFee: finalCalc.shipping_fee,
        totalAmount: finalCalc.total_amount,
        voucherIdToConsume,
      });
    }

    // Step 7-10: Atomic lock variants, consume vouchers, and insert orders/payments
    for (const item of sortedItems) {
      await catalogPort.lockVariant(item.variantId, item.quantity);
    }

    for (const prep of preparedOrders) {
      if (prep.voucherIdToConsume) {
        await voucherPort.consumeVoucher({
          voucherId: prep.voucherIdToConsume,
          orderId: prep.orderId,
          buyerId,
          discountAmount: prep.discountAmount,
        });
      }

      // Insert Order and Items
      const orderRecord: OrderRecord = {
        orderId: prep.orderId,
        buyerId,
        shopId: prep.shopId,
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        province: address.province,
        district: address.district,
        ward: address.ward,
        deliveryAddress: address.deliveryAddress,
        subtotal: prep.subtotal,
        discountAmount: prep.discountAmount,
        shippingFee: prep.shippingFee,
        totalAmount: prep.totalAmount,
        status: 'PENDING_CONFIRMATION',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const historyRecord = createOrderStatusHistoryRecord({
        orderId: prep.orderId,
        oldStatus: null,
        newStatus: 'PENDING_CONFIRMATION',
        changedBy: buyerId,
      });

      await orderRepo.createOrder(orderRecord, prep.items, historyRecord, client);

      // Insert initial Payment
      const paymentRecord: PaymentRecord = {
        paymentId: prep.paymentId,
        orderId: prep.orderId,
        method: command.payment_method,
        amount: prep.totalAmount,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      await paymentRepo.createPayment(paymentRecord, client);
    }

    // Step 11: Clear checked out items from Cart
    const itemIdsToClear = sortedItems.map(i => i.cartItemId);
    await cartPort.clearCheckedOutItems(buyerId, itemIdsToClear);

    // Step 12: Build result
    const orderResults: CheckoutOrderResult[] = preparedOrders.map(prep => ({
      order_id: prep.orderId,
      shop_id: prep.shopId,
      status: 'PENDING_CONFIRMATION',
      total_amount: prep.totalAmount,
      payment_id: prep.paymentId,
    }));

    return {
      orders: orderResults as unknown as readonly [CheckoutOrderResult, ...CheckoutOrderResult[]],
    };
  };

  try {
    let result: CheckoutResult;
    if (pool) {
      result = await withTransaction(pool, (client) => runWorkflow(client));
    } else {
      result = await runWorkflow();
    }

    if (idempotencyPort && idempotencyScope && ownershipToken) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await idempotencyPort.complete(idempotencyScope, ownershipToken, result, expiresAt);
    }

    return result;
  } catch (error) {
    if (idempotencyPort && idempotencyScope && ownershipToken) {
      await idempotencyPort.release(idempotencyScope, ownershipToken);
    }
    throw error;
  }
}
