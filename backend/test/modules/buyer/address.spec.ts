import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setDefaultAddress } from '../../../src/modules/buyer/domain/address.ts';
import type { Address } from '../../../src/modules/buyer/domain/types.ts';
import { mockAddress1, mockAddress2, mockBuyerId } from './fixtures.ts';

describe('Address Domain Tests (RB-LB05)', () => {

  it('[RB-LB05] User có địa chỉ A (isDefault=true), B (isDefault=false); set B làm default -> A tự động isDefault=false, B isDefault=true', () => {
    const addresses: Address[] = [
      { ...mockAddress1, isDefault: true },
      { ...mockAddress2, isDefault: false },
    ];

    const updated = setDefaultAddress(addresses, mockAddress2.addressId);
    const addrA = updated.find(a => a.addressId === mockAddress1.addressId);
    const addrB = updated.find(a => a.addressId === mockAddress2.addressId);

    assert.equal(addrA?.isDefault, false);
    assert.equal(addrB?.isDefault, true);
    // Duy nhất 1 địa chỉ default
    const defaultCount = updated.filter(a => a.isDefault).length;
    assert.equal(defaultCount, 1);
  });

  it('[RB-LB05] User chưa có địa chỉ default; set địa chỉ đầu tiên làm default -> pass, duy nhất 1 default', () => {
    const addresses: Address[] = [
      { ...mockAddress1, isDefault: false },
    ];

    const updated = setDefaultAddress(addresses, mockAddress1.addressId);
    assert.equal(updated[0].isDefault, true);
    assert.equal(updated.filter(a => a.isDefault).length, 1);
  });

});
