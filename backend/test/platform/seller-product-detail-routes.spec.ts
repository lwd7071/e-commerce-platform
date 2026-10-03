import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

const shopId = '00000000-0000-0000-0000-000000000010';
const sellerId = '00000000-0000-0000-0000-000000000011';

describe('Seller product detail HTTP behavior', () => {
  it('reads the private product under the authenticated shop scope', async () => {
    let received: unknown;
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({ request_id: 'req_test', user_id: sellerId, role: 'SELLER', shop_id: shopId, shop_status: 'ACTIVE' });
        next();
      },
      catalog: {
        listProducts: async () => ({ items: [], next_cursor: null, has_more: false, limit: 20 }),
        getProduct: async () => ({}), createProduct: async () => ({}), updateVariantStock: async () => ({}),
        getSellerProduct: async (context, productId) => { received = [context.shop_id, productId]; return { product_id: productId, status: 'INACTIVE' }; },
      },
    });
    const response = await request(app).get('/api/v1/seller/products/product-1').expect(200);
    assert.deepEqual(received, [shopId, 'product-1']);
    assert.equal(response.body.data.status, 'INACTIVE');
  });

  it('sends only explicit editable fields to the Seller product update command', async () => {
    let received: unknown;
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({ request_id: 'req_test', user_id: sellerId, role: 'SELLER', shop_id: shopId, shop_status: 'ACTIVE' });
        next();
      },
      catalog: {
        listProducts: async () => ({ items: [], next_cursor: null, has_more: false, limit: 20 }),
        getProduct: async () => ({}), createProduct: async () => ({}), updateVariantStock: async () => ({}),
        updateSellerProduct: async (context, productId, input) => { received = [context.shop_id, productId, input]; return { product_id: productId }; },
      },
    });
    await request(app).patch('/api/v1/seller/products/product-1')
      .send({ product_name: 'Updated name', shop_id: 'attacker' }).expect(422);
    await request(app).patch('/api/v1/seller/products/product-1')
      .send({
        product_name: 'Updated name',
        variants: [{ variant_id: 'v1', variant_name: 'Size', variant_value: 'M', price: '10.00', sku: 'SKU-1' }],
        images: [{ media_id: '00000000-0000-0000-0000-000000000001', image_url: 'https://example.com/1.jpg', sort_order: 0 }],
      }).expect(200);
    assert.deepEqual(received, [
      shopId,
      'product-1',
      {
        product_name: 'Updated name',
        variants: [{ variant_id: 'v1', variant_name: 'Size', variant_value: 'M', price: '10.00', sku: 'SKU-1' }],
        images: [{ media_id: '00000000-0000-0000-0000-000000000001', image_url: 'https://example.com/1.jpg', sort_order: 0 }],
      },
    ]);
  });
});

