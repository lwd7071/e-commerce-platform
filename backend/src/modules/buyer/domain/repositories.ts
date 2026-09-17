import type {
  UUID,
  UserProfile,
  Address,
  Cart,
  CartItem,
  Voucher,
  VoucherUsage,
  Review,
  ReviewImage,
} from './types';

export interface IUserProfileRepository {
  findByUserId(userId: UUID): Promise<UserProfile | null>;
  upsert(profile: UserProfile): Promise<UserProfile>;
}

export interface IAddressRepository {
  findById(addressId: UUID): Promise<Address | null>;
  findByUserId(userId: UUID): Promise<Address[]>;
  create(address: Address): Promise<Address>;
  update(address: Address): Promise<Address>;
  delete(addressId: UUID): Promise<void>;
  setDefault(userId: UUID, targetAddressId: UUID): Promise<void>;
}

export interface ICartRepository {
  findByBuyerId(buyerId: UUID): Promise<Cart | null>;
  createCart(cart: Cart): Promise<Cart>;
  getItems(cartId: UUID): Promise<CartItem[]>;
  addItem(cartId: UUID, item: CartItem): Promise<CartItem>;
  updateItem(item: CartItem): Promise<CartItem>;
  removeItem(cartItemId: UUID): Promise<void>;
  clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void>;
}

export interface IVoucherRepository {
  findById(voucherId: UUID): Promise<Voucher | null>;
  findByCode(code: string): Promise<Voucher | null>;
  listActive(scope?: 'PLATFORM' | 'SHOP', shopId?: UUID): Promise<Voucher[]>;
  create(voucher: Voucher): Promise<Voucher>;
  decrementQuantity(voucherId: UUID): Promise<boolean>;
  incrementQuantity?(voucherId: UUID): Promise<boolean>;
  recordUsage(usage: VoucherUsage): Promise<VoucherUsage>;
}

export interface IReviewRepository {
  findById(reviewId: UUID): Promise<Review | null>;
  findByOrderItemId(orderItemId: UUID): Promise<Review | null>;
  findByProductId(productId: UUID): Promise<Review[]>;
  create(review: Review, images?: string[]): Promise<Review>;
}

export interface INotificationRepository {
  findById(notificationId: UUID): Promise<Notification | null>;
  findByRecipientId(recipientId: UUID, isRead?: boolean): Promise<Notification[]>;
  create(notification: Notification): Promise<Notification>;
  markAsRead(notificationId: UUID, readAt?: string): Promise<Notification>;
}
