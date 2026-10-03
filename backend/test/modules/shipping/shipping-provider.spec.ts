import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GhtkFeeProvider, MockFeeProvider } from '../../../src/modules/shipping/providers.ts';

describe('shipping fee providers', () => {
  it('requests only a GHTK fee quote using current province, ward and gram fields', async () => {
    let requestedUrl = '';
    let requestedHeaders: Record<string, string> | undefined;
    const provider = new GhtkFeeProvider({
      baseUrl: 'https://services.giaohangtietkiem.vn',
      token: 'test-secret',
      fetcher: async (input, init) => {
        requestedUrl = String(input);
        requestedHeaders = init?.headers as Record<string, string> | undefined;
        return Response.json({ success: true, fee: { fee: 30400, insurance_fee: 15000, delivery: true } });
      },
    });

    const quote = await provider.quote({
      pickupAddress: '1 Đường A', pickupProvince: 'Thành phố Hà Nội', pickupWard: 'Phường Hoàn Kiếm',
      deliveryAddress: '2 Đường B', deliveryProvince: 'Thành phố Hồ Chí Minh', deliveryWard: 'Phường Bến Thành',
      weightGrams: 800,
    });

    const url = new URL(requestedUrl);
    assert.equal(url.pathname, '/services/shipment/fee');
    assert.equal(url.searchParams.get('pick_province'), 'Thành phố Hà Nội');
    assert.equal(url.searchParams.get('pick_ward'), 'Phường Hoàn Kiếm');
    assert.equal(url.searchParams.get('province'), 'Thành phố Hồ Chí Minh');
    assert.equal(url.searchParams.get('ward'), 'Phường Bến Thành');
    assert.equal(url.searchParams.get('weight'), '800');
    assert.equal(url.searchParams.has('district'), false);
    assert.equal(url.pathname.includes('/shipment/order'), false);
    assert.equal(new Headers(requestedHeaders).get('Token'), 'test-secret');
    assert.deepEqual(quote, { provider: 'ghtk', fee: '30400.00', deliverable: true });
  });

  it('rejects locations GHTK says it cannot deliver to', async () => {
    const provider = new GhtkFeeProvider({
      baseUrl: 'https://services.giaohangtietkiem.vn', token: 'test-secret',
      fetcher: async () => Response.json({ success: true, fee: { fee: 0, delivery: false } }),
    });

    await assert.rejects(provider.quote({
      pickupAddress: 'A', pickupProvince: 'P', pickupWard: 'W', deliveryAddress: 'B',
      deliveryProvince: 'Q', deliveryWard: 'X', weightGrams: 200,
    }), { code: 'SHIPPING_UNAVAILABLE' });
  });

  it('returns a deterministic mock fee without making a network request', async () => {
    const provider = new MockFeeProvider();

    const quote = await provider.quote({
      pickupAddress: 'A', pickupProvince: 'P', pickupWard: 'W', deliveryAddress: 'B',
      deliveryProvince: 'Q', deliveryWard: 'X', weightGrams: 200,
    });

    assert.deepEqual(quote, { provider: 'mock', fee: '25000.00', deliverable: true });
  });
});
