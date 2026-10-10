import { describe, expect, it, vi } from 'vitest';
import { resetE2EBuyerAddress, resetE2EBuyerCart } from '../../db/seed/e2e-fixture-reset.js';

describe('E2E fixture reset helpers', () => {
  it('removes stale buyer addresses before restoring the unique default fixture address', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });

    await resetE2EBuyerAddress({ query }, {
      buyerId: 'e2000000-0000-4000-8000-000000000001',
      addressId: 'e2000000-0000-4000-8000-000000000007',
      recipientName: 'E2E Buyer',
      phone: '0900000000',
      province: 'TP Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Bến Nghé',
      detailAddress: '1 Dino E2E Street',
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('DELETE FROM addresses WHERE user_id=$1 AND address_id<>$2');
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO addresses');
    expect(query.mock.calls[1]?.[1]).toEqual([
      'e2000000-0000-4000-8000-000000000007',
      'e2000000-0000-4000-8000-000000000001',
      'E2E Buyer', '0900000000', 'TP Hồ Chí Minh', 'Quận 1', 'Bến Nghé', '1 Dino E2E Street',
    ]);
  });

  it('replaces the buyer cart so cascaded stale cart items cannot leak into the baseline', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });

    await resetE2EBuyerCart({ query }, {
      buyerId: 'e2000000-0000-4000-8000-000000000001',
      cartId: 'e2000000-0000-4000-8000-000000000008',
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('DELETE FROM carts WHERE buyer_id=$1');
    expect(query.mock.calls[0]?.[1]).toEqual(['e2000000-0000-4000-8000-000000000001']);
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO carts(cart_id,buyer_id)');
    expect(query.mock.calls[1]?.[1]).toEqual([
      'e2000000-0000-4000-8000-000000000008',
      'e2000000-0000-4000-8000-000000000001',
    ]);
  });
});
