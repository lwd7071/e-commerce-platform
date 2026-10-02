import type { Pool, PoolClient } from 'pg';
import type { RequestContext } from '../../../contracts/request-context.contract.ts';
import type { OrderHttpApplication } from '../../../platform/http/routes/t1-routes.ts';
import { withTransaction } from '../../../../db/transaction.ts';
import { calculateOrderTotals } from '../../order/domain/order-calculation.ts';
import { PgIdempotencyRepository, canonicalCheckoutFingerprint, checkoutIdempotencyScope } from '../repositories/pg-idempotency.repository.ts';
import { PgVoucherRepository } from '../../buyer/repositories/pg-buyer.repository.ts';
import { VoucherPortService } from '../../buyer/services/voucher-port.service.ts';
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from '../../../platform/errors/app-error.ts';
import type { CheckoutCommand } from '../contracts/checkout-command.ts';
import type { CheckoutResult } from '../contracts/checkout-result.ts';
import { transitionOrder } from '../../order/domain/order-state-machine.ts';
import type { OrderActor, OrderStatus, OrderTransition, OrderTransitionCommand } from '../../order/domain/types.ts';
import { createPaymentRetry } from '../../payment/domain/payment-state-machine.ts';
import type { PaymentAttempt } from '../../payment/domain/types.ts';
import { PgAuditRepository } from '../../../platform/audit/pg-audit.repository.ts';
import { ReasonRequiredError } from '../../../platform/errors/app-error.ts';
import { AppError } from '../../../platform/errors/app-error.ts';
import { GhtkFeeProvider, MockFeeProvider, type ShippingFeeProvider } from '../../shipping/providers.ts';

type CheckoutRow = {
  cart_item_id: string; variant_id: string; quantity: number; price: string; stock_quantity: number; weight_grams: number;
  variant_status: string; product_id: string; product_name: string; variant_name: string; variant_value: string | null;
  shop_id: string; shop_owner_id: string;
};

class ShippingQuoteInputsChangedError extends Error {}

export class PgCheckoutService implements OrderHttpApplication {
  private readonly auditRepository: PgAuditRepository;

  constructor(
    private readonly pool: Pool,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    private readonly shippingProvider: ShippingFeeProvider = new MockFeeProvider(),
  ) {
    this.auditRepository = new PgAuditRepository();
  }

  async quoteShipping(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    const unknownField = Object.keys(input).find(key => key !== 'address_id');
    if (unknownField) throw new ValidationFailedError(`Unknown field: ${unknownField}`, { field: unknownField });
    if (typeof input.address_id !== 'string') throw new ValidationFailedError('address_id is required.');
    const addressResult = await this.pool.query(
      'SELECT province,ward,detail_address FROM addresses WHERE address_id=$1 AND user_id=$2',
      [input.address_id, context.user_id],
    );
    const address = addressResult.rows[0];
    if (!address) throw new NotFoundError('Address was not found for this buyer.');
    const cart = await this.pool.query(
      `SELECT p.shop_id,s.pickup_address,s.pickup_detail_address,s.pickup_province,s.pickup_ward,
              SUM(p.weight_grams*ci.quantity)::integer AS weight_grams
         FROM cart_items ci JOIN carts c ON c.cart_id=ci.cart_id AND c.buyer_id=$1
         JOIN product_variants v ON v.variant_id=ci.variant_id
         JOIN products p ON p.product_id=v.product_id JOIN shops s ON s.shop_id=p.shop_id
        WHERE ci.is_selected=true AND v.status='ACTIVE' AND p.status='ACTIVE' AND s.status='ACTIVE'
        GROUP BY p.shop_id,s.pickup_address,s.pickup_detail_address,s.pickup_province,s.pickup_ward
        ORDER BY p.shop_id`,
      [context.user_id],
    );
    if (cart.rows.length === 0) throw new ValidationFailedError('No selected items in cart.');
    const quotes = [];
    for (const shop of cart.rows) {
      const pickupProvince = String(shop.pickup_province ?? '');
      const pickupWard = String(shop.pickup_ward ?? '');
      if (this.shippingProvider instanceof GhtkFeeProvider && (!pickupProvince || !pickupWard)) {
        throw new AppError(422, 'SHOP_PICKUP_ADDRESS_REQUIRED', `Shop ${shop.shop_id} needs a structured pickup province and ward for GHTK quotes.`);
      }
      const quote = await this.shippingProvider.quote({
        pickupAddress: String(shop.pickup_detail_address ?? shop.pickup_address ?? ''),
        pickupProvince: pickupProvince || String(address.province),
        pickupWard: pickupWard || String(address.ward),
        deliveryAddress: String(address.detail_address),
        deliveryProvince: String(address.province),
        deliveryWard: String(address.ward),
        weightGrams: Number(shop.weight_grams),
      });
      quotes.push({ shop_id: shop.shop_id, fee: quote.fee, weight_grams: Number(shop.weight_grams), provider: quote.provider });
    }
    return { quotes };
  }

  async createOrder(context: RequestContext, command: CheckoutCommand): Promise<CheckoutResult> {
    const fingerprint = canonicalCheckoutFingerprint(command);
    const scope = checkoutIdempotencyScope(context.user_id, command.idempotency_key);
    const replay = await this.pool.query<{ fingerprint: string; result: CheckoutResult }>(
      `SELECT fingerprint, result FROM api_idempotency_records
        WHERE user_id=$1 AND endpoint=$2 AND idempotency_key=$3 AND expires_at > now()`,
      [scope.user_id, scope.endpoint, scope.key],
    );
    if (replay.rows[0]) {
      if (replay.rows[0].fingerprint !== fingerprint) throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different payload.');
      return replay.rows[0].result;
    }
    const freshQuotes = await this.quoteShipping(context, { address_id: command.address_id }) as { quotes: Array<{ shop_id: string; fee: string; weight_grams: number }> };
    const currentFees = new Map(freshQuotes.quotes.map(quote => [quote.shop_id, quote.fee]));
    const expectedFees = new Map((command.expected_shipping_fees ?? []).map(quote => [quote.shop_id, quote.fee]));
    if (expectedFees.size !== currentFees.size || [...currentFees].some(([shopId, fee]) => expectedFees.get(shopId) !== fee)) {
      throw new ConflictError('SHIPPING_QUOTE_CHANGED', 'Shipping fees have changed. Review the updated quote before placing your order.', { quotes: freshQuotes.quotes });
    }
    const quoteWeights = new Map(freshQuotes.quotes.map(quote => [quote.shop_id, quote.weight_grams]));
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await withTransaction(this.pool, (client) => this.persistCheckout(client, context, command, fingerprint, currentFees, quoteWeights), { isolationLevel: 'READ COMMITTED' });
      } catch (error: unknown) {
        if (error instanceof ShippingQuoteInputsChangedError) {
          const refreshed = await this.quoteShipping(context, { address_id: command.address_id });
          throw new ConflictError('SHIPPING_QUOTE_CHANGED', 'The selected cart changed after its shipping quote was calculated. Review the refreshed quote.', refreshed);
        }
        if (!isSerializationError(error) || attempt === 3) throw error;
        await this.sleep(attempt === 1 ? 25 : 50);
      }
    }
    throw new Error('unreachable');
  }

  private async persistCheckout(client: PoolClient, context: RequestContext, command: CheckoutCommand, fingerprint: string, shippingFees: ReadonlyMap<string, string>, quoteWeights: ReadonlyMap<string, number>): Promise<CheckoutResult> {
    const idempotency = new PgIdempotencyRepository(client);
    const scope = checkoutIdempotencyScope(context.user_id, command.idempotency_key);
    const claim = await idempotency.claim<CheckoutResult>(scope, fingerprint);
    if (claim.kind === 'replay') return claim.result;
    if (claim.kind === 'conflict') throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different payload.');
    if (claim.kind === 'in_progress') throw new ConflictError('REQUEST_IN_PROGRESS', 'A request with this idempotency key is currently processing.');

    const address = await client.query(`SELECT recipient_name, phone, province, district, ward, detail_address FROM addresses WHERE address_id=$1 AND user_id=$2 FOR SHARE`, [command.address_id, context.user_id]);
    if (!address.rows[0]) throw new NotFoundError('Address was not found for this buyer.');
    const cart = await client.query<CheckoutRow>(
      `SELECT ci.cart_item_id, ci.variant_id, ci.quantity, v.price::text, v.stock_quantity, p.weight_grams,
              v.status AS variant_status, v.product_id, p.product_name, v.variant_name, v.variant_value,
              p.shop_id, s.owner_id AS shop_owner_id
         FROM cart_items ci
         JOIN carts c ON c.cart_id=ci.cart_id AND c.buyer_id=$1
         JOIN product_variants v ON v.variant_id=ci.variant_id
         JOIN products p ON p.product_id=v.product_id
         JOIN shops s ON s.shop_id=p.shop_id
        WHERE ci.is_selected=true
        ORDER BY v.variant_id
        FOR UPDATE OF ci, v`, [context.user_id]);
    if (cart.rows.length === 0) throw new ValidationFailedError('No selected items in cart.');
    for (const row of cart.rows) {
      if (row.variant_status !== 'ACTIVE' || row.stock_quantity < row.quantity) throw new ConflictError('INVENTORY_INSUFFICIENT', `Insufficient stock for variant ${row.variant_id}.`);
      const shop = await client.query("SELECT status FROM shops WHERE shop_id=$1", [row.shop_id]);
      if (shop.rows[0]?.status !== 'ACTIVE') throw new ValidationFailedError(`Shop ${row.shop_id} is not active.`);
    }

    const voucherService = new VoucherPortService(new PgVoucherRepository(client));
    const groups = new Map<string, CheckoutRow[]>();
    for (const row of cart.rows) groups.set(row.shop_id, [...(groups.get(row.shop_id) ?? []), row]);
    if (groups.size !== quoteWeights.size || [...groups].some(([shopId, rows]) => rows.reduce((sum, row) => sum + row.weight_grams * row.quantity, 0) !== quoteWeights.get(shopId))) {
      throw new ShippingQuoteInputsChangedError('The selected cart changed after its shipping quote was calculated.');
    }
    const orders: CheckoutResult['orders'][number][] = [];
    for (const [shopId, rows] of groups) {
      const initial = calculateOrderTotals({ lines: rows.map(row => ({ unit_price: row.price, quantity: row.quantity })), discount_amount: '0.00', shipping_fee: '0.00' });
      const voucher = command.vouchers.find(candidate => candidate.shop_id === shopId);
      let discount = '0.00'; let voucherId: string | null = null;
      if (voucher) {
        const evaluation = await voucherService.evaluateVoucher({ code: voucher.code, buyerId: context.user_id, shopId, orderSubtotal: initial.subtotal });
        if (!evaluation.isValid) throw new ValidationFailedError(evaluation.errorMessage, { code: evaluation.errorCode });
        discount = evaluation.discountAmount; voucherId = evaluation.voucherId;
      }
      const shippingFee = shippingFees.get(shopId);
      if (shippingFee === undefined) throw new ValidationFailedError(`No shipping quote is available for Shop ${shopId}.`);
      const totals = calculateOrderTotals({ lines: rows.map(row => ({ unit_price: row.price, quantity: row.quantity })), discount_amount: discount, shipping_fee: shippingFee });
      const orderId = crypto.randomUUID(); const paymentId = crypto.randomUUID();
      await client.query(
        `INSERT INTO orders (order_id,buyer_id,shop_id,recipient_name,recipient_phone,province,district,ward,delivery_address,subtotal,discount_amount,shipping_fee,total_amount,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PENDING_CONFIRMATION')`,
        [orderId, context.user_id, shopId, address.rows[0].recipient_name, address.rows[0].phone, address.rows[0].province, address.rows[0].district, address.rows[0].ward, address.rows[0].detail_address, totals.subtotal, totals.discount_amount, totals.shipping_fee, totals.total_amount]);
      for (const row of rows) {
        const inventory = await client.query('UPDATE product_variants SET stock_quantity=stock_quantity-$1,updated_at=now() WHERE variant_id=$2 AND stock_quantity >= $1', [row.quantity, row.variant_id]);
        if (inventory.rowCount !== 1) throw new ConflictError('INVENTORY_INSUFFICIENT', `Insufficient stock for variant ${row.variant_id}.`);
        const snapshot = (row.variant_value ? `${row.variant_name}: ${row.variant_value}` : row.variant_name).trim().slice(0, 255);
        await client.query('INSERT INTO order_items (order_item_id,order_id,product_id,variant_id,product_name_snapshot,variant_snapshot,unit_price,quantity,line_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [crypto.randomUUID(), orderId, row.product_id, row.variant_id, row.product_name, snapshot, row.price, row.quantity, (Number(row.price) * row.quantity).toFixed(2)]);
        await client.query('DELETE FROM cart_items WHERE cart_item_id=$1', [row.cart_item_id]);
      }
      await client.query("INSERT INTO order_status_history (history_id,order_id,old_status,new_status,changed_by) VALUES ($1,$2,NULL,'PENDING_CONFIRMATION',$3)", [crypto.randomUUID(), orderId, context.user_id]);
      await client.query("INSERT INTO payments (payment_id,order_id,method,amount,status) VALUES ($1,$2,$3,$4,'PENDING')", [paymentId, orderId, command.payment_method, totals.total_amount]);
      await client.query("INSERT INTO notifications (notification_id,recipient_id,type,title,content) VALUES ($1,$2,'ORDER','Order created',$3)", [crypto.randomUUID(), context.user_id, `Order ${orderId} created`]);
      await client.query(
        "INSERT INTO notifications (notification_id,recipient_id,type,title,content) VALUES ($1,$2,'ORDER',$3,$4)",
        [crypto.randomUUID(), rows[0].shop_owner_id, 'Có đơn hàng mới', `Gian hàng nhận được đơn hàng #${orderId}.`],
      );
      if (voucherId) await voucherService.consumeVoucher({ voucherId, orderId, buyerId: context.user_id, discountAmount: discount });
      orders.push({ order_id: orderId, shop_id: shopId, status: 'PENDING_CONFIRMATION', total_amount: totals.total_amount, payment_id: paymentId });
    }
    const result = { orders: orders as unknown as CheckoutResult['orders'] };
    await idempotency.complete(scope, fingerprint, result, new Date(Date.now() + 86_400_000).toISOString());
    return result;
  }

  async cancelOrder(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown> {
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (!reason) throw new ValidationFailedError('Cancellation reason is required.');
    return withTransaction(this.pool, async client => {
      const current = await client.query(
        `SELECT o.status,o.buyer_id,o.shop_id,s.owner_id
         FROM orders o JOIN shops s ON s.shop_id=o.shop_id
         WHERE o.order_id=$1 AND ($3='ADMIN' OR ($3='BUYER' AND o.buyer_id=$2) OR ($3='SELLER' AND s.owner_id=$2))
         FOR UPDATE OF o`,
        [orderId, context.user_id, context.role],
      );
      if (!current.rows[0]) throw new NotFoundError('Order was not found.');
      const row = current.rows[0];
      const actor: OrderActor = context.role === 'ADMIN'
        ? { kind: 'ADMIN', userId: context.user_id }
        : context.role === 'SELLER'
          ? { kind: 'SELLER', userId: context.user_id, shopId: context.shop_id ?? '' }
          : { kind: 'BUYER', userId: context.user_id };
      const decision = transitionOrder(
        { status: row.status, buyerId: row.buyer_id, shopId: row.shop_id },
        { to: 'CANCELLED', actor, reason, processingEligible: true, exceptionalCancellation: context.role === 'ADMIN' && input.exceptional_cancellation === true },
      );
      return this.persistTransition(client, context, orderId, decision);
    });
  }

  async confirmOrder(context: RequestContext, orderId: string, reason?: string): Promise<unknown> {
    const effectiveReason = context.role === 'ADMIN' ? reason?.trim() : reason;
    if (context.role === 'ADMIN' && !effectiveReason) throw new ReasonRequiredError('A reason is required for admin order actions.');
    return withTransaction(this.pool, async client => {
      const current = await client.query("SELECT o.status FROM orders o JOIN shops s ON o.shop_id=s.shop_id WHERE o.order_id=$1 AND ($2='ADMIN' OR ($2='SELLER' AND s.owner_id=$3)) FOR UPDATE OF o", [orderId, context.role, context.user_id]);
      if (!current.rows[0]) throw new ForbiddenError('ORDER_CONFIRM_FORBIDDEN', 'Order cannot be confirmed by this actor.');
      if (current.rows[0].status !== 'PENDING_CONFIRMATION') {
        throw new ConflictError('ORDER_INVALID_TRANSITION', 'Order cannot be confirmed in its current state.');
      }
      return this.persistTransition(client, context, orderId, { from: 'PENDING_CONFIRMATION', to: 'CONFIRMED', reason: effectiveReason });
    });
  }

  async confirmReceived(context: RequestContext, orderId: string, reason?: string): Promise<unknown> {
    const effectiveReason = context.role === 'ADMIN' ? reason?.trim() : 'Buyer confirmed receipt';
    if (context.role === 'ADMIN' && !effectiveReason) throw new ReasonRequiredError('A reason is required for admin order actions.');
    return withTransaction(this.pool, async client => {
      const current = await client.query(
        "SELECT status, buyer_id FROM orders WHERE order_id=$1 AND (buyer_id=$2 OR $3='ADMIN') FOR UPDATE",
        [orderId, context.user_id, context.role]
      );
      if (!current.rows[0]) throw new NotFoundError('Order was not found.');
      if (current.rows[0].status !== 'SHIPPING') {
        throw new ConflictError('ORDER_INVALID_TRANSITION', 'Only SHIPPING orders can be confirmed as received.');
      }
      const shipment = await client.query('UPDATE shipments SET status=\'DELIVERED\',updated_at=now() WHERE order_id=$1 AND status IN (\'HANDED_OVER\',\'SHIPPING\') RETURNING shipment_id', [orderId]);
      if (shipment.rowCount !== 1) throw new ConflictError('ORDER_INVALID_TRANSITION', 'Only a handed-over simulated shipment can be confirmed as received.');
      return this.persistTransition(client, context, orderId, { from: 'SHIPPING', to: 'COMPLETED', reason: effectiveReason });
    });
  }

  async transitionOrder(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown> {
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (context.role === 'ADMIN' && !reason) throw new ReasonRequiredError('A reason is required for admin order actions.');
    return withTransaction(this.pool, async client => {
      const current = await client.query('SELECT o.*, s.owner_id FROM orders o JOIN shops s ON s.shop_id=o.shop_id WHERE o.order_id=$1 FOR UPDATE OF o', [orderId]);
      const row = current.rows[0]; if (!row) throw new NotFoundError('Order not found.');
      if (context.role !== 'ADMIN' && (context.role !== 'SELLER' || row.owner_id !== context.user_id)) {
        throw new ForbiddenError('RESOURCE_FORBIDDEN', 'Order cannot be changed by this actor.');
      }
      const actor = context.role === 'ADMIN' ? { kind: 'ADMIN' as const, userId: context.user_id } : { kind: 'SELLER' as const, userId: context.user_id, shopId: context.shop_id ?? '' };
      const to = parseOrderStatus(input.to);
      const shipmentStatus = parseShipmentStatus(input.shipment_status);
      const decision = transitionOrder(
        { status: row.status, buyerId: row.buyer_id, shopId: row.shop_id },
        {
          to,
          actor,
          reason: reason || undefined,
          processingEligible: true,
          exceptionalCancellation: context.role === 'ADMIN' && input.exceptional_cancellation === true,
          shipmentStatus,
        },
      );
      return this.persistTransition(client, context, orderId, decision);
    });
  }

  /** Caller holds the Order lock; stock, status and history commit together. */
  private async persistTransition(client: PoolClient, context: RequestContext, orderId: string, decision: OrderTransition): Promise<unknown> {
    if (decision.to === 'SHIPPING') {
      await client.query(
        `INSERT INTO shipments (shipment_id,order_id,carrier_name,status)
         VALUES ($1,$2,'Simulated delivery','HANDED_OVER')
         ON CONFLICT (order_id) DO UPDATE SET status='HANDED_OVER',updated_at=now()`,
        [crypto.randomUUID(), orderId],
      );
    }
    if (decision.to === 'CANCELLED') {
      const items = await client.query<{ variant_id: string; quantity: number }>(
        'SELECT variant_id,quantity FROM order_items WHERE order_id=$1 ORDER BY variant_id,order_item_id FOR UPDATE', [orderId]);
      // Match checkout's stable variant lock order, including multi-item orders.
      await client.query('SELECT variant_id FROM product_variants WHERE variant_id=ANY($1::uuid[]) ORDER BY variant_id FOR UPDATE', [items.rows.map(item => item.variant_id)]);
      for (const item of items.rows) {
        const restored = await client.query('UPDATE product_variants SET stock_quantity=stock_quantity+$1,updated_at=now() WHERE variant_id=$2', [item.quantity, item.variant_id]);
        if (restored.rowCount !== 1) throw new ConflictError('INVENTORY_RESTORE_FAILED', 'Ordered variant was not found.');
      }
    }
    const result = await client.query('UPDATE orders SET status=$1,updated_at=now(),cancel_reason=$2 WHERE order_id=$3 AND status=$4 RETURNING *', [decision.to, decision.to === 'CANCELLED' ? decision.reason : null, orderId, decision.from]);
    if (!result.rows[0]) throw new ConflictError('ORDER_INVALID_TRANSITION', 'Order state changed.');
    await client.query('INSERT INTO order_status_history (history_id,order_id,old_status,new_status,changed_by,reason) VALUES ($1,$2,$3,$4,$5,$6)', [crypto.randomUUID(), orderId, decision.from, decision.to, context.user_id, decision.reason ?? null]);
    if (context.role === 'ADMIN') {
      await this.auditRepository.logAdminAction(client, {
        admin_id: context.user_id,
        action: `ORDER_${decision.to}`,
        target_type: 'ORDER',
        target_id: orderId,
        reason: decision.reason ?? '',
      });
    }
    const parties = await client.query<{ buyer_id: string; owner_id: string }>(
      'SELECT o.buyer_id,s.owner_id FROM orders o JOIN shops s ON s.shop_id=o.shop_id WHERE o.order_id=$1', [orderId],
    );
    const recipients = new Set<string>();
    if (context.role === 'SELLER' && parties.rows[0]) recipients.add(parties.rows[0].buyer_id);
    if ((decision.to === 'CANCELLED' || decision.to === 'COMPLETED') && context.role === 'BUYER' && parties.rows[0]) recipients.add(parties.rows[0].owner_id);
    for (const recipientId of recipients) {
      await client.query(
        "INSERT INTO notifications (notification_id,recipient_id,type,title,content) VALUES ($1,$2,'ORDER',$3,$4)",
        [crypto.randomUUID(), recipientId, decision.to === 'CANCELLED' ? 'Đơn hàng đã hủy' : `Đơn hàng cập nhật: ${decision.to}`, `Đơn hàng #${orderId} chuyển sang trạng thái ${decision.to}.${decision.reason ? ` Lý do: ${decision.reason}` : ''}`],
      );
    }
    return result.rows[0];
  }

  async retryPayment(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown> {
    return withTransaction(this.pool, async client => {
      const order = await client.query('SELECT status,total_amount FROM orders WHERE order_id=$1 AND buyer_id=$2 FOR UPDATE', [orderId, context.user_id]);
      if (!order.rows[0]) throw new NotFoundError('Order not found.');
      if (['CANCELLED', 'COMPLETED', 'DELIVERY_FAILED'].includes(order.rows[0].status)) {
        throw new ConflictError('PAYMENT_STATE_INVALID', 'Cannot retry payment for a terminal order.');
      }
      const payments = await client.query<PaymentAttempt>(
        'SELECT payment_id AS "paymentId",order_id AS "orderId",status,method,amount::text,paid_at AS "paidAt" FROM payments WHERE order_id=$1 ORDER BY payment_id FOR UPDATE', [orderId]);
      if (payments.rows.length === 0 || payments.rows.some(payment => payment.status === 'PENDING')) {
        throw new ConflictError('PAYMENT_STATE_INVALID', 'Retry requires failed attempts and no pending payment.');
      }
      const retry = createPaymentRetry(payments.rows, {
        paymentId: crypto.randomUUID(), orderId, orderTotal: order.rows[0].total_amount,
        method: (input.payment_method ?? 'ONLINE') as PaymentAttempt['method'],
      });
      const result = await client.query("INSERT INTO payments (payment_id,order_id,method,amount,status,note) VALUES ($1,$2,$3,$4,'PENDING','retry') RETURNING *", [retry.paymentId, orderId, retry.method, retry.amount]);
      return result.rows[0];
    });
  }
}

function isSerializationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === '40001' || code === '40P01';
}

const orderStatuses: readonly OrderStatus[] = [
  'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED',
];
type ShipmentStatus = NonNullable<OrderTransitionCommand['shipmentStatus']>;
const shipmentStatuses: readonly ShipmentStatus[] = ['PENDING', 'HANDED_OVER', 'SHIPPING', 'DELIVERED', 'FAILED'];

function parseOrderStatus(value: unknown): OrderStatus {
  if (typeof value === 'string' && orderStatuses.includes(value as OrderStatus)) return value as OrderStatus;
  throw new ValidationFailedError('Invalid order status.');
}

function parseShipmentStatus(value: unknown): ShipmentStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && shipmentStatuses.includes(value as ShipmentStatus)) return value as ShipmentStatus;
  throw new ValidationFailedError('Invalid shipment status.');
}
