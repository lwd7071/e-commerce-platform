import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setDefaultAddress } from '../../../src/modules/buyer/domain/address';
import { ValidationError } from '../../../src/modules/buyer/domain/errors';
import type { Address } from '../../../src/modules/buyer/domain/types';
import { mockAddress1, mockAddress2, mockBuyerId } from './fixtures';

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

  it('[RB-LB05] ADDR-03: Gọi lại trên địa chỉ vốn đã là default -> giữ nguyên isDefault=true (idempotent)', () => {
    const addresses: Address[] = [
      { ...mockAddress1, isDefault: true },
      { ...mockAddress2, isDefault: false },
    ];

    const updated = setDefaultAddress(addresses, mockAddress1.addressId);
    assert.equal(updated[0].isDefault, true);
    assert.equal(updated[1].isDefault, false);
    assert.equal(updated.filter(a => a.isDefault).length, 1);
  });

  it('[RB-LB05] ADDR-04: targetAddressId không tồn tại trong danh sách -> reject VALIDATION_FAILED', () => {
    const addresses: Address[] = [
      { ...mockAddress1, isDefault: true },
    ];

    assert.throws(
      () => setDefaultAddress(addresses, '99999999-9999-4999-8999-999999999999'),
      (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
    );
  });

});
