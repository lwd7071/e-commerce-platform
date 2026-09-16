// Domain models based strictly on Schema Freeze v1 (22 tables)

export type UUID = string;
export type DecimalString = string;
export type ISOTimestamp = string;

// Table 2: UserProfile
export interface UserProfile {
  userId: UUID; // PK, FK -> User.UserID
  fullName: string | null; // VARCHAR(150)
  phone: string | null; // VARCHAR(20)
  avatarUrl: string | null; // TEXT
  updatedAt: ISOTimestamp;
}

// Table 3: Address
export interface Address {
  addressId: UUID; // PK
  userId: UUID; // FK -> User.UserID
  recipientName: string; // VARCHAR(150) NOT NULL
  phone: string; // VARCHAR(20) NOT NULL
  province: string; // VARCHAR(100) NOT NULL
  district: string; // VARCHAR(100) NOT NULL
  ward: string; // VARCHAR(100) NOT NULL
  detailAddress: string; // VARCHAR(255) NOT NULL
  isDefault: boolean; // BOOLEAN, default false (RB-LB05 max 1 default/user)
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

// Table 9: Cart
export interface Cart {
  cartId: UUID; // PK
  buyerId: UUID; // FK -> User.UserID, UNIQUE (RB-LB03)
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

// Table 10: CartItem
export interface CartItem {
  cartItemId: UUID; // PK
  cartId: UUID; // FK -> Cart.CartID
  variantId: UUID; // FK -> ProductVariant.VariantID
  quantity: number; // INTEGER >= 1 (RB-MG05)
  isSelected: boolean; // BOOLEAN
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

// Table 16: Voucher
export type VoucherScope = 'PLATFORM' | 'SHOP';
export type VoucherDiscountType = 'PERCENT' | 'FIXED';
export type VoucherStatus = 'ACTIVE' | 'INACTIVE';

export interface Voucher {
  voucherId: UUID; // PK
  code: string; // VARCHAR(50) UNIQUE NOT NULL (RB-LB06)
  voucherName: string; // VARCHAR(150) NOT NULL
  scope: VoucherScope; // PLATFORM | SHOP (RB-LTT05)
  shopId: UUID | null; // FK -> Shop.ShopID; NULL với PLATFORM, NOT NULL với SHOP
  discountType: VoucherDiscountType; // PERCENT | FIXED
  discountValue: DecimalString; // > 0; nếu PERCENT thì <= 100 (RB-LTT04, RB-MG09)
  maxDiscount: DecimalString | null; // >= 0 / NULL
  minOrderValue: DecimalString; // >= 0
  quantity: number; // INTEGER >= 0
  startAt: ISOTimestamp; // NOT NULL (RB-LTT03 startAt < endAt)
  endAt: ISOTimestamp; // NOT NULL
  status: VoucherStatus; // ACTIVE | INACTIVE
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

// Table 17: VoucherUsage
export interface VoucherUsage {
  usageId: UUID; // PK
  voucherId: UUID; // FK -> Voucher.VoucherID
  orderId: UUID; // FK -> Order.OrderID, UNIQUE (RB-LB07)
  buyerId: UUID; // FK -> User.UserID
  discountAmount: DecimalString; // NUMERIC(15,2) >= 0
  usedAt: ISOTimestamp;
}

// Table 18: Review
export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

export interface Review {
  reviewId: UUID; // PK
  buyerId: UUID; // FK -> User.UserID
  productId: UUID; // FK -> Product.ProductID
  orderItemId: UUID; // FK -> OrderItem.OrderItemID, UNIQUE (RB-LB09)
  rating: number; // SMALLINT {1,2,3,4,5} (QD15, RB-MG08)
  content: string | null; // TEXT / NULL
  status: ReviewStatus; // VISIBLE | HIDDEN
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

// Table 19: ReviewImage
export interface ReviewImage {
  reviewImageId: UUID; // PK
  reviewId: UUID; // FK -> Review.ReviewID
  imageUrl: string; // TEXT
  sortOrder: number; // INTEGER >= 0 (RB-MG11)
}

// Table 20: Notification
export type NotificationType = 'ORDER' | 'PAYMENT' | 'SHIPPING' | 'VIOLATION' | 'SYSTEM';

export interface Notification {
  notificationId: UUID; // PK
  recipientId: UUID; // FK -> User.UserID
  type: NotificationType;
  title: string; // VARCHAR(255) NOT NULL
  content: string; // TEXT NOT NULL
  isRead: boolean; // BOOLEAN, default false
  createdAt: ISOTimestamp;
  readAt: ISOTimestamp | null; // TIMESTAMPTZ / NULL (RB-LTT07: IsRead = TRUE => ReadAt != NULL)
}
