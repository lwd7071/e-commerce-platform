import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { createPayosPaymentRouter } from '../../src/platform/http/routes/payos-payment-routes.ts';
import type { PayosService } from '../../src/modules/wallet/services/payos.service.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

const buyerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: 'req_test_payos',
    user_id: BUYER_ID,
    role: 'BUYER',
  });
  next();
};

describe('PayOS Payment Routes', () => {
  it('thực thi câu lệnh INSERT payments với ON CONFLICT (transaction_code) WHERE transaction_code IS NOT NULL DO NOTHING', async () => {
    const executedQueries: string[] = [];

    const mockPool = {
      query: async (sql: string) => {
        executedQueries.push(sql);

        if (sql.includes('SELECT order_id, buyer_id')) {
          return {
            rows: [{
              order_id: ORDER_ID,
              buyer_id: BUYER_ID,
              shop_id: 'shop-1',
              total_amount: '45000',
              status: 'PENDING_CONFIRMATION',
            }],
            rowCount: 1,
          };
        }

        if (sql.includes('INSERT INTO payments')) {
          return { rows: [], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const mockPayosService = {
      createPaymentLink: async () => ({
        checkoutUrl: 'https://pay.payos.vn/web/test',
        qrCode: 'vietqr_string',
        bin: '970407',
        accountNumber: '123456789',
        accountName: 'CONG TY TEST',
      }),
    } as unknown as PayosService;

    const app = express();
    app.use(express.json());
    app.use(createPayosPaymentRouter(mockPool, mockPayosService, undefined, buyerAuth));

    const res = await request(app)
      .post('/payments/payos/create-link')
      .send({ order_id: ORDER_ID });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.checkout_url, 'https://pay.payos.vn/web/test');

    const paymentInsertQuery = executedQueries.find(q => q.includes('INSERT INTO payments'));
    assert.ok(paymentInsertQuery, 'Cần thực thi câu lệnh INSERT INTO payments');

    // Kiểm tra câu lệnh phải khớp với partial unique index uq_payments__transaction_code
    assert.match(
      paymentInsertQuery,
      /ON\s+CONFLICT\s*\(\s*transaction_code\s*\)\s+WHERE\s+transaction_code\s+IS\s+NOT\s+NULL\s+DO\s+NOTHING/i,
      'Mệnh đề ON CONFLICT phải có WHERE transaction_code IS NOT NULL để khớp với partial index',
    );
  });

  it('sinh orderCode duy nhất mỗi lần yêu cầu để tránh lỗi PayOS Đơn thanh toán đã tồn tại khi thanh toán lại', async () => {
    const generatedOrderCodes: number[] = [];

    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('SELECT order_id, buyer_id')) {
          return {
            rows: [{
              order_id: ORDER_ID,
              buyer_id: BUYER_ID,
              shop_id: 'shop-1',
              total_amount: '45000',
              status: 'PENDING_CONFIRMATION',
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      },
    } as unknown as Pool;

    const mockPayosService = {
      createPaymentLink: async (input: { orderCode: number }) => {
        generatedOrderCodes.push(input.orderCode);
        return {
          checkoutUrl: `https://pay.payos.vn/web/${input.orderCode}`,
          qrCode: 'vietqr_string',
          bin: '970407',
          accountNumber: '123456789',
          accountName: 'CONG TY TEST',
        };
      },
    } as unknown as PayosService;

    const app = express();
    app.use(express.json());
    app.use(createPayosPaymentRouter(mockPool, mockPayosService, undefined, buyerAuth));

    // Lần 1
    const res1 = await request(app).post('/payments/payos/create-link').send({ order_id: ORDER_ID });
    assert.equal(res1.status, 200);

    // Chờ 2ms để khác timestamp
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Lần 2 (thanh toán lại / retry)
    const res2 = await request(app).post('/payments/payos/create-link').send({ order_id: ORDER_ID });
    assert.equal(res2.status, 200);

    assert.equal(generatedOrderCodes.length, 2);
    assert.notEqual(
      generatedOrderCodes[0],
      generatedOrderCodes[1],
      'Mỗi lần tạo link thanh toán phải sinh orderCode khác nhau để PayOS không báo Đơn thanh toán đã tồn tại',
    );
  });
});
