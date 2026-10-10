import { OrderDomainError } from './errors.ts';
import type { OrderStatus } from './types.ts';

export type UUID = string;
export type DecimalString = string;

const DECIMAL_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;
const MAX_CENTS = 999_999_999_999_999n;

export interface OrderItemSnapshotInput {
  readonly orderId: UUID;
  readonly productId: UUID;
  readonly variantId: UUID;
  readonly productName: string;
  readonly variantName: string;
  readonly variantValue?: string | null;
  readonly unitPrice: DecimalString;
  readonly quantity: number;
}

export interface OrderItemSnapshot {
  readonly orderItemId: UUID;
  readonly orderId: UUID;
  readonly productId: UUID;
  readonly variantId: UUID;
  readonly productNameSnapshot: string;
  readonly variantSnapshot: string;
  readonly unitPrice: DecimalString;
  readonly quantity: number;
  readonly lineTotal: DecimalString;
}

export interface OrderAddressSnapshotInput {
  readonly recipientName: string;
  readonly recipientPhone: string;
  readonly province: string;
  readonly district: string;
  readonly ward: string;
  readonly deliveryAddress: string;
}

export interface OrderAddressSnapshot {
  readonly recipientName: string;
  readonly recipientPhone: string;
  readonly province: string;
  readonly district: string;
  readonly ward: string;
  readonly deliveryAddress: string;
}

export interface OrderStatusHistoryInput {
  readonly orderId: UUID;
  readonly oldStatus: OrderStatus | null;
  readonly newStatus: OrderStatus;
  readonly changedBy?: UUID | null;
  readonly reason?: string | null;
  readonly changedAt?: string;
}

export interface OrderStatusHistoryRecord {
  readonly historyId: UUID;
  readonly orderId: UUID;
  readonly oldStatus: OrderStatus | null;
  readonly newStatus: OrderStatus;
  readonly changedBy: UUID | null;
  readonly reason: string | null;
  readonly changedAt: string;
}

function parseCents(value: string, field: string): bigint {
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
    throw new OrderDomainError('ORDER_TOTAL_INVALID', `${field} must be a NUMERIC(15,2) decimal string.`);
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n || cents > MAX_CENTS) {
    throw new OrderDomainError('ORDER_TOTAL_INVALID', `${field} is outside the valid positive NUMERIC(15,2) range.`);
  }
  return cents;
}

function formatCents(cents: bigint): string {
  if (cents < 0n || cents > MAX_CENTS) {
    throw new OrderDomainError('ORDER_TOTAL_INVALID', 'Amount is outside the NUMERIC(15,2) range.');
  }
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/**
 * Builds an immutable OrderItem snapshot fulfilling QD08 and Schema Freeze v1.
 */
export function buildOrderItemSnapshot(input: OrderItemSnapshotInput): OrderItemSnapshot {
  const productName = input.productName?.trim();
  if (!productName) {
    throw new OrderDomainError('VALIDATION_FAILED', 'Product name snapshot cannot be empty (QD08).');
  }

  const variantName = input.variantName?.trim();
  if (!variantName) {
    throw new OrderDomainError('VALIDATION_FAILED', 'Variant name cannot be empty (QD08).');
  }

  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 2_147_483_647) {
    throw new OrderDomainError('VALIDATION_FAILED', 'Quantity must be a positive integer in PostgreSQL range (RB-MG06).');
  }

  const unitPriceCents = parseCents(input.unitPrice, 'unitPrice');
  const lineTotalCents = unitPriceCents * BigInt(input.quantity);
  if (lineTotalCents > MAX_CENTS) {
    throw new OrderDomainError('ORDER_TOTAL_INVALID', 'Line total exceeds NUMERIC(15,2) range.');
  }

  const variantParts: string[] = [variantName];
  if (input.variantValue && input.variantValue.trim()) {
    variantParts.push(input.variantValue.trim());
  }
  const variantSnapshot = variantParts.join(' - ');

  return Object.freeze({
    orderItemId: crypto.randomUUID(),
    orderId: input.orderId,
    productId: input.productId,
    variantId: input.variantId,
    productNameSnapshot: productName,
    variantSnapshot,
    unitPrice: formatCents(unitPriceCents),
    quantity: input.quantity,
    lineTotal: formatCents(lineTotalCents),
  });
}

/**
 * Builds an immutable address snapshot frozen at order creation time.
 */
export function buildOrderAddressSnapshot(input: OrderAddressSnapshotInput): OrderAddressSnapshot {
  const recipientName = input.recipientName?.trim();
  const recipientPhone = input.recipientPhone?.trim();
  const province = input.province?.trim();
  const district = input.district?.trim();
  const ward = input.ward?.trim();
  const deliveryAddress = input.deliveryAddress?.trim();

  if (!recipientName || !recipientPhone || !province || !district || !ward || !deliveryAddress) {
    throw new OrderDomainError('VALIDATION_FAILED', 'All address snapshot fields are required and must be non-blank.');
  }

  return Object.freeze({
    recipientName,
    recipientPhone,
    province,
    district,
    ward,
    deliveryAddress,
  });
}

/**
 * Creates an immutable OrderStatusHistory record adhering to QD11 and QD20.
 */
export function createOrderStatusHistoryRecord(input: OrderStatusHistoryInput): OrderStatusHistoryRecord {
  const reason = input.reason?.trim() || null;
  if ((input.newStatus === 'CANCELLED' || input.newStatus === 'DELIVERY_FAILED') && !reason) {
    throw new OrderDomainError('REASON_REQUIRED', `A reason is required when transitioning to ${input.newStatus}.`);
  }

  return Object.freeze({
    historyId: crypto.randomUUID(),
    orderId: input.orderId,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    changedBy: input.changedBy || null,
    reason,
    changedAt: input.changedAt || new Date().toISOString(),
  });
}
