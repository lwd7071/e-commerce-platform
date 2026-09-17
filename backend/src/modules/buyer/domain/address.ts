import { ValidationError } from './errors';
import type { Address, UUID } from './types';

/**
 * [RB-LB05] Mỗi User có tối đa 1 Address IsDefault = TRUE
 * Khi đặt 1 địa chỉ làm default, tất cả các địa chỉ khác của user tự động chuyển IsDefault = FALSE
 */
export function setDefaultAddress(addresses: Address[], targetAddressId: UUID): Address[] {
  const targetExists = addresses.some(addr => addr.addressId === targetAddressId);
  if (!targetExists) {
    throw new ValidationError('Địa chỉ không tồn tại trong danh sách của người dùng (RB-LB05).', {
      targetAddressId,
    });
  }
  const now = new Date().toISOString();
  return addresses.map(addr => {
    if (addr.addressId === targetAddressId) {
      return {
        ...addr,
        isDefault: true,
        updatedAt: now,
      };
    }
    if (addr.isDefault) {
      return {
        ...addr,
        isDefault: false,
        updatedAt: now,
      };
    }
    return addr;
  });
}
