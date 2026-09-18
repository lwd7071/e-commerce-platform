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

type CheckoutRow = {
  cart_item_id: string; variant_id: string; quantity: number; price: string; stock_quantity: number;
  variant_status: string; product_id: string; product_name: string; variant_name: string; variant_value: string | null;
  shop_id: string; shop_owner_id: string;
};

export class PgCheckoutService implements OrderHttpApplication {
  constructor(private readonly pool: Pool, private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise(resolve => setTimeout(resolve, ms))) {}

  async createOrder(context: RequestContext, command: CheckoutCommand): Promise<CheckoutResult> {
    const fingerprint = canonicalCheckoutFingerprint(command);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await withTransaction(this.pool, (client) => this.persistCheckout(client, context, command, fingerprint), { isolationLevel: 'READ COMMITTED' });
      } catch (error: any) {
        if (!isSerializationError(error) || attempt === 3) throw error;
        await this.sleep(attempt === 1 ? 25 : 50);
      }
    }
    throw new Error('unreachable');
  }

  private async persistCheckout(client: PoolClient, context: RequestContext, command: CheckoutCommand, fingerprint: string): Promise<CheckoutResult> {
    const idempotency = new PgIdempotencyRepository(client);
    const scope = checkoutIdempotencyScope(context.user_id, command.idempotency_key);
    const claim = await idempotency.claim<CheckoutResult>(scope, fingerprint);
    if (claim.kind === 'replay') return claim.result;
    if (claim.kind === 'conflict') throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different payload.');
    if (claim.kind === 'in_progress') throw new ConflictError('REQUEST_IN_PROGRESS', 'A request with this idempotency key is currently processing.');

    const address = await client.query(`SELECT recipient_name, phone, province, district, ward, detail_address FROM addresses WHERE address_id=$1 AND user_id=$2 FOR SHARE`, [command.address_id, context.user_id]);
    if (!address.rows[0]) throw new NotFoundError('Address was not found for this buyer.');
    const cart = await client.query<CheckoutRow>(
      `SELECT ci.cart_item_id, ci.variant_id, ci.quantity, v.price::text, v.stock_quantity,
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
      const totals = calculateOrderTotals({ lines: rows.map(row => ({ unit_price: row.price, quantity: row.quantity })), discount_amount: discount, shipping_fee: '0.00' });
      const orderId = crypto.randomUUID(); const paymentId = crypto.randomUUID();
      await client.query(
        `INSERT INTO orders (order_id,buyer_id,shop_id,recipient_name,recipient_phone,province,district,ward,delivery_address,subtotal,discount_amount,shipping_fee,total_amount,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'0.00',$12,'PENDING_CONFIRMATION')`,
        [orderId, context.user_id, shopId, address.rows[0].recipient_name, address.rows[0].phone, address.rows[0].province, address.rows[0].district, address.rows[0].ward, address.rows[0].detail_address, totals.subtotal, totals.discount_amount, totals.total_amount]);
      for (const row of rows) {
        await client.query('UPDATE product_variants SET stock_quantity=stock_quantity-$1,updated_at=now() WHERE variant_id=$2 AND stock_quantity >= $1', [row.quantity, row.variant_id]);
        const snapshot = (row.variant_value ? `${row.variant_name}: ${row.variant_value}` : row.variant_name).trim().slice(0, 255);
        await client.query('INSERT INTO order_items (order_item_id,order_id,product_id,variant_id,product_name_snapshot,variant_snapshot,unit_price,quantity,line_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [crypto.randomUUID(), orderId, row.product_id, row.variant_id, row.product_name, snapshot, row.price, row.quantity, (Number(row.price) * row.quantity).toFixed(2)]);
        await client.query('DELETE FROM cart_items WHERE cart_item_id=$1', [row.cart_item_id]);
      }
      await client.query("INSERT INTO order_status_history (history_id,order_id,old_status,new_status,changed_by) VALUES ($1,$2,NULL,'PENDING_CONFIRMATION',$3)", [crypto.randomUUID(), orderId, context.user_id]);
      await client.query("INSERT INTO payments (payment_id,order_id,method,amount,status) VALUES ($1,$2,$3,$4,'PENDING')", [paymentId, orderId, command.payment_method, totals.total_amount]);
      await client.query("INSERT INTO notifications (notification_id,recipient_id,type,title,content) VALUES ($1,$2,'ORDER','Order created',$3)", [crypto.randomUUID(), context.user_id, `Order ${orderId} created`]);
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
    const result = await this.pool.query("UPDATE orders SET status='CANCELLED',cancel_reason=$1,updated_at=now() WHERE order_id=$2 AND (buyer_id=$3 OR $4='ADMIN') AND status='PENDING_CONFIRMATION' RETURNING *", [reason, orderId, context.user_id, context.role]);
    if (!result.rows[0]) throw new NotFoundError('Order was not found or cannot be cancelled.');
    await this.pool.query("INSERT INTO order_status_history (history_id,order_id,old_status,new_status,changed_by,reason) VALUES ($1,$2,'PENDING_CONFIRMATION','CANCELLED',$3,$4)", [crypto.randomUUID(), orderId, context.user_id, reason]);
    return result.rows[0];
  }

  async confirmOrder(context: RequestContext, orderId: string): Promise<unknown> {
    const result = await this.pool.query("UPDATE orders o SET status='CONFIRMED',updated_at=now() FROM shops s WHERE o.shop_id=s.shop_id AND o.order_id=$1 AND o.status='PENDING_CONFIRMATION' AND ($2='ADMIN' OR s.owner_id=$3) RETURNING o.*", [orderId, context.role, context.user_id]);
    if (!result.rows[0]) throw new ForbiddenError('ORDER_CONFIRM_FORBIDDEN', 'Order cannot be confirmed by this actor.');
    return result.rows[0];
  }

  async transitionOrder(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown> {
    const current = await this.pool.query('SELECT o.*, s.owner_id FROM orders o JOIN shops s ON s.shop_id=o.shop_id WHERE o.order_id=$1', [orderId]);
    const row = current.rows[0]; if (!row) throw new NotFoundError('Order not found.');
    const actor = context.role === 'ADMIN' ? { kind: 'ADMIN' as const, userId: context.user_id } : { kind: 'SELLER' as const, userId: context.user_id, shopId: context.shop_id ?? '' };
    const decision = transitionOrder({ status: row.status, buyerId: row.buyer_id, shopId: row.shop_id }, { to: input.to as any, actor, reason: input.reason as string | undefined, processingEligible: true, exceptionalCancellation: input.exceptional_cancellation === true, shipmentStatus: input.shipment_status as any });
    const result = await this.pool.query('UPDATE orders SET status=$1,updated_at=now(),cancel_reason=$2 WHERE order_id=$3 RETURNING *', [decision.to, decision.reason ?? null, orderId]);
    await this.pool.query('INSERT INTO order_status_history (history_id,order_id,old_status,new_status,changed_by,reason) VALUES ($1,$2,$3,$4,$5,$6)', [crypto.randomUUID(), orderId, decision.from, decision.to, context.user_id, decision.reason ?? null]);
    return result.rows[0];
  }

  async retryPayment(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown> {
    const order = await this.pool.query('SELECT total_amount FROM orders WHERE order_id=$1 AND buyer_id=$2', [orderId, context.user_id]);
    if (!order.rows[0]) throw new NotFoundError('Order not found.');
    const result = await this.pool.query("INSERT INTO payments (payment_id,order_id,method,amount,status,note) VALUES ($1,$2,$3,$4,'PENDING','retry') RETURNING *", [crypto.randomUUID(), orderId, input.payment_method ?? 'ONLINE', order.rows[0].total_amount]);
    return result.rows[0];
  }
}

function isSerializationError(error: { code?: string }): boolean { return error.code === '40001' || error.code === '40P01'; }
