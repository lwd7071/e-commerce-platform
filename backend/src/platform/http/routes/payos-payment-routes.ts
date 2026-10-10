import { Router, type Request, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { DependencyUnavailableError, NotFoundError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { buildSuccessEnvelope } from '../envelope.ts';
import type { PayosService } from '../../../modules/wallet/services/payos.service.ts';
import type { EscrowService } from '../../../modules/wallet/services/escrow.service.ts';

function asyncRoute(handler: (req: Request, res: import('express').Response) => Promise<void>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}

export function createPayosPaymentRouter(
  pool?: Pool,
  payosService?: PayosService,
  escrowService?: EscrowService,
  auth?: RequestHandler,
): Router {
  const router = Router();
  const requestId = (req: Request) => req.requestId ?? 'req_unknown';

  router.post('/payments/payos/create-link', ...(auth ? [auth] : []), asyncRoute(async (req, res) => {
    if (!req.context) throw new UnauthorizedError();
    if (!pool || !payosService) throw new DependencyUnavailableError('Payment service is not configured');

    const orderId = req.body?.order_id;
    if (!orderId || typeof orderId !== 'string') {
      throw new ValidationFailedError('Thiếu order_id hợp lệ');
    }

    const orderRes = await pool.query(
      `SELECT order_id, buyer_id, shop_id, total_amount, status FROM orders WHERE order_id = $1`,
      [orderId],
    );
    if (!orderRes.rows[0]) throw new NotFoundError('Không tìm thấy đơn hàng');
    const order = orderRes.rows[0];

    // Check ownership if caller is buyer or seller
    if (req.context.role === 'BUYER' && req.context.user_id !== order.buyer_id) {
      throw new UnauthorizedError('Bạn không có quyền thanh toán đơn hàng này');
    }

    // Generate unique integer order code within safe integer range (PayOS max 9007199254740991)
    const orderCode = Date.now();
    const amount = Math.round(Number(order.total_amount));
    const description = `DINO DH ${orderId.slice(0, 8).toUpperCase()}`;

    const host = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const linkResult = await payosService.createPaymentLink({
      orderCode,
      amount,
      description,
      cancelUrl: `${host}/orders/${orderId}?status=cancelled`,
      returnUrl: `${host}/orders/${orderId}?status=success`,
    });

    // Cập nhật payment PENDING hiện có (nếu có từ bước checkout)
    const updateResult = await pool.query(
      `UPDATE payments SET transaction_code = $2, note = $3, method = 'ONLINE'
       WHERE order_id = $1 AND status = 'PENDING' AND transaction_code IS NULL`,
      [orderId, `PAYOS_${orderCode}`, linkResult.checkoutUrl],
    );

    // Nếu chưa có payment record nào thì INSERT mới
    if (updateResult.rowCount === 0) {
      await pool.query(
        `INSERT INTO payments (payment_id, order_id, transaction_code, method, amount, status, note)
         VALUES (gen_random_uuid(), $1, $2, 'ONLINE', $3, 'PENDING', $4)
         ON CONFLICT (transaction_code) WHERE transaction_code IS NOT NULL DO NOTHING`,
        [orderId, `PAYOS_${orderCode}`, amount, linkResult.checkoutUrl],
      );
    }

    res.json(buildSuccessEnvelope({
      order_id: orderId,
      order_code: orderCode,
      amount,
      checkout_url: linkResult.checkoutUrl,
      qr_code: linkResult.qrCode,
      bin: linkResult.bin,
      account_number: linkResult.accountNumber,
      account_name: linkResult.accountName,
    }, requestId(req)));
  }));

  router.post('/payments/payos/webhook', asyncRoute(async (req, res) => {
    if (!pool || !payosService || !escrowService) {
      res.status(200).json({ success: false, message: 'Services not initialized' });
      return;
    }

    const payload = req.body;
    const isValid = payosService.verifyWebhook(payload);
    if (!isValid) {
      // PayOS test webhook verification during dashboard registration
      if (payload?.data?.orderCode === 123 || payload?.data?.description === 'VQRIO123') {
        res.status(200).json({ success: true, message: 'PayOS test webhook verified' });
        return;
      }
      res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }

    const webhookData = payload.data;
    if (!webhookData || !webhookData.orderCode) {
      res.status(200).json({ success: true, message: 'Ignored empty data' });
      return;
    }

    const transactionCode = `PAYOS_${webhookData.orderCode}`;
    const paymentRes = await pool.query(
      `SELECT payment_id, order_id, amount, status FROM payments WHERE transaction_code = $1`,
      [transactionCode],
    );

    if (paymentRes.rows[0]) {
      const payment = paymentRes.rows[0];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Update payment to SUCCESS
        await client.query(
          `UPDATE payments SET status = 'SUCCESS', paid_at = NOW() WHERE payment_id = $1`,
          [payment.payment_id],
        );

        // Fetch order
        const orderRes = await client.query(
          `SELECT order_id, shop_id, total_amount, status FROM orders WHERE order_id = $1`,
          [payment.order_id],
        );
        const order = orderRes.rows[0];

        if (order) {
          // Update order status if PENDING_CONFIRMATION
          if (order.status === 'PENDING_CONFIRMATION') {
            await client.query(
              `UPDATE orders SET status = 'CONFIRMED', updated_at = NOW() WHERE order_id = $1`,
              [order.order_id],
            );
            await client.query(
              `INSERT INTO order_status_history (history_id, order_id, old_status, new_status, reason)
               VALUES (gen_random_uuid(), $1, 'PENDING_CONFIRMATION', 'CONFIRMED', 'Thanh toán PayOS thành công')`,
              [order.order_id],
            );
          }

          // Create Escrow record (Holding)
          await escrowService.createEscrow({
            order_id: order.order_id,
            shop_id: order.shop_id,
            gross_amount: String(order.total_amount),
            commission_rate: 0.05,
          });
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    res.status(200).json({ success: true });
  }));

  return router;
}
