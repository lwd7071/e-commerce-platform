import type { UserProfile, Address, Cart, CartItem, Voucher, Review, Notification } from '../../../src/modules/buyer/domain/types';

export const mockBuyerId = '44444444-4444-4444-8444-444444444444';
export const mockShopId = '33333333-3333-4333-8333-333333333333';
export const mockOtherShopId = '99999999-9999-4999-8999-999999999999';

export const mockUserProfile: UserProfile = {
  userId: mockBuyerId,
  fullName: 'Nguyễn Văn Mua',
  phone: '0901234567',
  avatarUrl: 'https://storage.example.com/avatars/user1.jpg',
  updatedAt: '2026-09-16T10:00:00.000Z',
};

export const mockAddress1: Address = {
  addressId: 'aaaa1111-1111-4111-8111-111111111111',
  userId: mockBuyerId,
  recipientName: 'Nguyễn Văn Mua',
  phone: '0901234567',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 1',
  ward: 'Phường Bến Nghé',
  detailAddress: '123 Lê Lợi',
  isDefault: true,
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
};

export const mockAddress2: Address = {
  addressId: 'aaaa2222-2222-4222-8222-222222222222',
  userId: mockBuyerId,
  recipientName: 'Nguyễn Văn Mua - Công ty',
  phone: '0909888777',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 3',
  ward: 'Phường Võ Thị Sáu',
  detailAddress: '456 Hai Bà Trưng',
  isDefault: false,
  createdAt: '2026-09-16T11:00:00.000Z',
  updatedAt: '2026-09-16T11:00:00.000Z',
};

export const mockPlatformVoucher: Voucher = {
  voucherId: 'vvvv1111-1111-4111-8111-111111111111',
  code: 'PLATFORM20',
  voucherName: 'Giảm giá toàn sàn 20%',
  scope: 'PLATFORM',
  shopId: null,
  discountType: 'PERCENT',
  discountValue: '20.00',
  maxDiscount: '50000.00',
  minOrderValue: '100000.00',
  quantity: 50,
  startAt: '2026-09-01T00:00:00.000Z',
  endAt: '2026-09-30T23:59:59.000Z',
  status: 'ACTIVE',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

export const mockShopVoucher: Voucher = {
  voucherId: 'vvvv2222-2222-4222-8222-222222222222',
  code: 'SHOPFIXED30',
  voucherName: 'Shop giảm 30k',
  scope: 'SHOP',
  shopId: mockShopId,
  discountType: 'FIXED',
  discountValue: '30000.00',
  maxDiscount: null,
  minOrderValue: '150000.00',
  quantity: 10,
  startAt: '2026-09-01T00:00:00.000Z',
  endAt: '2026-09-30T23:59:59.000Z',
  status: 'ACTIVE',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
