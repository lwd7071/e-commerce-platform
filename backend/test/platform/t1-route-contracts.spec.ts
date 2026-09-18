import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { RequestHandler } from 'express';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

const buyerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_test',
    user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'BUYER',
  });
  next();
};

describe('T1 HTTP route contracts', () => {
  it('keeps products public and uses cursor envelope', async () => {
    const app = createApp({
      catalog: {
        async listProducts() { return { items: [{ product_id: 'p1' }], next_cursor: null, has_more: false, limit: 20 }; },
        async getProduct() { return { product_id: 'p1' }; },
        async createProduct() { return {}; },
        async updateVariantStock() { return {}; },
      },
    });
    const response = await request(app).get('/api/v1/products?limit=20').expect(200);
    assert.deepStrictEqual(response.body.data, [{ product_id: 'p1' }]);
    assert.deepStrictEqual(response.body.meta, { next_cursor: null, has_more: false, limit: 20 });
  });

  it('rejects unknown query fields before invoking Catalog', async () => {
    const app = createApp({ catalog: {
      async listProducts() { throw new Error('must not call'); },
      async getProduct() { return {}; }, async createProduct() { return {}; }, async updateVariantStock() { return {}; },
    } });
    const response = await request(app).get('/api/v1/products?page=1').expect(422);
    assert.equal(response.body.error.code, 'VALIDATION_FAILED');
  });

  it('protects Buyer routes and keeps HTTP fields snake_case', async () => {
    const app = createApp({ auth: buyerAuth, buyer: {
      async listAddresses() { return []; },
      async createAddress(_context, input) { return input; },
      async getCart() { return { items: [] }; },
      async addCartItem(_context, input) { return input; },
      async updateCartItem(_context, _id, input) { return input; },
      async deleteCartItem() {},
      async applicableVouchers() { return []; },
      async evaluateVoucher(_context, input) { return input; },
    } });
    await request(app).get('/api/v1/addresses').expect(200);
    const response = await request(app).post('/api/v1/addresses').send({ recipient_name: 'A', phone: '1', province: 'P', district: 'D', ward: 'W', detail_address: 'X' }).expect(201);
    assert.equal(response.body.data.recipient_name, 'A');
  });
});
