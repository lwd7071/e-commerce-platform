export type UUID = string;

import type { CheckoutCommand } from '../contracts/checkout-command.ts';
import type { CheckoutResult, CheckoutOrderResult } from '../contracts/checkout-result.ts';
import type { ICartPort } from '../../buyer/ports/cart.port.ts';
import type { ICatalogPort, VariantPriceAndStockDTO } from '../../catalog/ports/catalog.port.ts';
import type { IVoucherPort } from '../../buyer/ports/voucher.port.ts';
import type { IdempotencyPort, IdempotencyScope } from '../contracts/idempotency.port.ts';
import { calculateOrderTotals } from '../../order/domain/order-calculation.ts';

export class CheckoutDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CheckoutDomainError';
    this.code = code;
  }
}

export interface IShopResolver {
  (productId: UUID): Promise<UUID> | UUID;
}

export interface CheckoutOrchestratorDependencies {
  readonly buyerId: UUID;
  readonly command: CheckoutCommand;
  readonly cartPort: ICartPort;
  readonly catalogPort: ICatalogPort;
  readonly voucherPort: IVoucherPort;
  readonly shopResolver: IShopResolver;
  readonly idempotencyPort?: IdempotencyPort<CheckoutResult>;
  readonly now?: () => string;
}

/**
 * 12-step atomic checkout orchestration domain service according to
 * order-workflow-transactions.md §4 and checkout-contract.md.
 */
export async function executeCheckout(
  deps: CheckoutOrchestratorDependencies,
): Promise<CheckoutResult> {
  const { buyerId, command, cartPort, catalogPort, voucherPort, shopResolver, idempotencyPort } = deps;

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
      throw new CheckoutDomainError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different payload.');
    }
    if (claim.kind === 'in_progress') {
      throw new CheckoutDomainError('REQUEST_IN_PROGRESS', 'A request with this idempotency key is currently processing.');
    }
    ownershipToken = claim.ownership_token;
  }

  // Step 1: Load selected cart items
  const cartItems = await cartPort.getSelectedItems(buyerId);
  const selectedItems = (cartItems || []).filter(item => item.isSelected);
  if (selectedItems.length === 0) {
    throw new CheckoutDomainError('VALIDATION_FAILED', 'No selected items in cart.');
  }

  // Step 2-4: Stable sort by variantId to minimize deadlocks; fetch and validate variant info
  const sortedItems = [...selectedItems].sort((a, b) => a.variantId.localeCompare(b.variantId));
  const variantMap = new Map<string, VariantPriceAndStockDTO>();
  const itemShopMap = new Map<string, UUID>();

  for (const item of sortedItems) {
    const variant = await catalogPort.getVariantPriceAndStock(item.variantId);
    if (variant.status !== 'ACTIVE') {
      throw new CheckoutDomainError('VALIDATION_FAILED', `Variant ${item.variantId} is not active.`);
    }
    // Anti-overselling check (QD06, QD07)
    if (variant.stockQuantity < item.quantity) {
      throw new CheckoutDomainError(
        'INVENTORY_INSUFFICIENT',
        `Insufficient stock for variant ${item.variantId}. Available: ${variant.stockQuantity}, requested: ${item.quantity}.`,
      );
    }
    const shopId = await shopResolver(variant.productId);
    const isShopActive = await catalogPort.checkShopActive(shopId);
    if (!isShopActive) {
      throw new CheckoutDomainError('VALIDATION_FAILED', `Shop ${shopId} is not active.`);
    }

    variantMap.set(item.variantId, variant);
    itemShopMap.set(item.variantId, shopId);
  }

  // Step 5: Group by Shop; check and evaluate vouchers
  const shopGroups = new Map<UUID, typeof sortedItems>();
  for (const item of sortedItems) {
    const shopId = itemShopMap.get(item.variantId)!;
    const existing = shopGroups.get(shopId) ?? [];
    existing.push(item);
    shopGroups.set(shopId, existing);
  }

  interface PreparedOrderData {
    shopId: UUID;
    orderId: UUID;
    paymentId: UUID;
    subtotal: string;
    discountAmount: string;
    totalAmount: string;
    voucherIdToConsume: UUID | null;
  }

  const preparedOrders: PreparedOrderData[] = [];

  for (const [shopId, items] of shopGroups.entries()) {
    const lines = items.map(item => ({
      unit_price: variantMap.get(item.variantId)!.price,
      quantity: item.quantity,
    }));

    // First calculate subtotal without discount
    const initialCalculation = calculateOrderTotals({
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
        orderSubtotal: initialCalculation.subtotal,
        shopId,
        now: deps.now?.(),
      });
      if (!evalResult.isValid) {
        throw new CheckoutDomainError(
          evalResult.errorCode || 'VOUCHER_NOT_APPLICABLE',
          evalResult.errorMessage || 'Voucher is not applicable.',
        );
      }
      discountAmount = evalResult.discountAmount;
      voucherIdToConsume = evalResult.voucherId;
    }

    // Step 6: Recalculate totals with discount (QD10, RB-LTT02, RB-LQH01, RB-LQH02)
    const finalCalculation = calculateOrderTotals({
      lines,
      discount_amount: discountAmount,
      shipping_fee: '0.00',
    });

    preparedOrders.push({
      shopId,
      orderId: crypto.randomUUID(),
      paymentId: crypto.randomUUID(),
      subtotal: finalCalculation.subtotal,
      discountAmount: finalCalculation.discount_amount,
      totalAmount: finalCalculation.total_amount,
      voucherIdToConsume,
    });
  }

  // Step 9-10: Atomic locks & voucher consumption
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
  }

  // Step 11: Clear checked out items from cart
  const cartItemIdsToClear = sortedItems.map(i => i.cartItemId);
  await cartPort.clearCheckedOutItems(buyerId, cartItemIdsToClear);

  // Step 7, 8, 12: Build result and complete idempotency
  const orderResults: CheckoutOrderResult[] = preparedOrders.map(prep => ({
    order_id: prep.orderId,
    shop_id: prep.shopId,
    status: 'PENDING_CONFIRMATION',
    total_amount: prep.totalAmount,
    payment_id: prep.paymentId,
  }));

  const result: CheckoutResult = {
    orders: orderResults as unknown as readonly [CheckoutOrderResult, ...CheckoutOrderResult[]],
  };

  if (idempotencyPort && idempotencyScope && ownershipToken) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await idempotencyPort.complete(idempotencyScope, ownershipToken, result, expiresAt);
  }

  return result;
}
