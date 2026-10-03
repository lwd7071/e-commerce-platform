# 04. Data model và FE adapters

> **Phiên bản:** 1.4.0
>
> **Trạng thái:** READY FOR FE FOUNDATION

## 1. Ba lớp dữ liệu

Không dùng một interface cho DB, API và UI.

1. **Wire DTO:** đúng JSON backend; đa số contract dùng snake_case, nhưng phải theo schema từng endpoint vì một số runtime legacy/domain response dùng camelCase. Money là decimal string khi backend trả PostgreSQL `NUMERIC`.
2. **View-model:** camelCase, phù hợp component; được tạo bởi adapter theo endpoint.
3. **Client state:** loading, selected UI, optimistic state; không trộn vào wire DTO.

```typescript
export type UUID = string;
export type ISODateTime = string;
export type DecimalString = string;

export interface ApiEnvelope<T> {
  data: T;
  request_id: string;
}

export interface PaginatedEnvelope<T> extends ApiEnvelope<T[]> {
  meta: {
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
  };
}
```

## 2. Catalog DTO

### Product list — `AVAILABLE`

```typescript
export interface ProductListItemDTO {
  product_id: UUID;
  product_name: string;
  shop_id: UUID;
  category_id: UUID;
  min_price: DecimalString;
  max_price: DecimalString;
  total_stock: number;
  image_url: string | null;
  created_at: ISODateTime;
}
```

Không giả định list API có `description`, `status`, `thumbnail_url`, `rating_average` hoặc `sold_count`.

### Product detail — `PARTIAL`

```typescript
export type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "HIDDEN";
export type VariantStatus = "ACTIVE" | "INACTIVE";

export interface ProductVariantDTO {
  variant_id: UUID;
  variant_name: string;
  variant_value: string | null;
  sku: string;
  price: DecimalString;
  stock_quantity: number;
  status: VariantStatus;
}

export interface ProductDetailDTO {
  product_id: UUID;
  shop_id: UUID;
  category_id: UUID;
  product_name: string;
  description: string | null;
  status: "ACTIVE";
  variants: ProductVariantDTO[];
}
```

Detail runtime chưa trả `images`, shop metadata, rating hoặc reviews. UI phải dùng placeholder có kiểm soát cho tới khi GAP-CATALOG-DETAIL được xử lý.

### Create product

```typescript
export interface CreateProductDTO {
  category_id: UUID;
  product_name: string;
  description?: string | null;
  weight_grams?: number; // positive integer; backend defaults legacy/new omitted values to 200g
  images?: Array<{ image_url: string; sort_order?: number }>;
  variants: Array<{
    variant_name: string;
    variant_value?: string | null;
    sku: string;
    price: DecimalString;
    stock_quantity: number;
  }>;
}
```

**Tên field tồn kho phải giữ đúng theo endpoint:** create variant dùng `stock_quantity`; cập nhật tồn kho dùng `quantity` tại `PATCH /product-variants/:variant_id/stock`. `stock` chỉ được phép là tên trong view-model nội bộ, tuyệt đối không serialize nguyên view-model làm request body. Backend có route từ chối các field lạ.

Upload file không nằm trong endpoint này; `image_url` phải được tạo bởi một media flow riêng hiện còn thiếu.

## 3. Cart DTO

Runtime cart hiện chỉ trả identity/quantity/selection, chưa join display data.

```typescript
export interface CartItemDTO {
  cart_item_id: UUID;
  variant_id: UUID;
  quantity: number;
  is_selected: boolean;
}

export interface CartDTO {
  cart_id: UUID | null;
  buyer_id: UUID;
  items: CartItemDTO[];
}

export interface UpdateCartItemDTO {
  quantity?: number;
  is_selected?: boolean;
}
```

`is_selected` là server state và quyết định item nào được checkout/xóa bằng `/cart/selected`. Product name, image, price, stock và shop name là dữ liệu FE cần nhưng backend cart runtime chưa trả; đây là blocker tích hợp cart UI đầy đủ.

## 4. Checkout DTO

```typescript
export type PaymentMethod = "COD" | "ONLINE";

export interface CheckoutDTO {
  address_id: UUID;
  payment_method: PaymentMethod;
  vouchers?: Array<{ shop_id: UUID; code: string }>;
}

export interface CheckoutOrderDTO {
  order_id: UUID;
  shop_id: UUID;
  status: "PENDING_CONFIRMATION";
  total_amount: DecimalString;
  payment_id: UUID;
}

export interface CheckoutResultDTO {
  orders: [CheckoutOrderDTO, ...CheckoutOrderDTO[]];
}
```

Phí vận chuyển hiện do backend tính cố định `0.00`; FE không gửi `shipping_fee` và không cộng phí mock vào `total_amount`.

`Idempotency-Key` là HTTP header, không nằm trong body. Checkout lấy các cart item đang `is_selected=true` và thực hiện atomically cho tất cả shop.

## 5. Order model

```typescript
export type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPING"
  | "COMPLETED"
  | "CANCELLED"
  | "DELIVERY_FAILED";

export interface OrderItemDTO {
  order_item_id: UUID;
  order_id: UUID;
  product_id: UUID;
  variant_id: UUID;
  product_name_snapshot: string;
  variant_snapshot: string | null;
  unit_price: DecimalString;
  quantity: number;
  line_total: DecimalString;
}

export interface OrderDTO {
  order_id: UUID;
  buyer_id: UUID;
  shop_id: UUID;
  recipient_name: string;
  recipient_phone: string;
  province: string;
  district: string;
  ward: string;
  delivery_address: string;
  subtotal: DecimalString;
  discount_amount: DecimalString;
  shipping_fee: DecimalString;
  total_amount: DecimalString;
  status: OrderStatus;
  cancel_reason: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  items?: OrderItemDTO[];
}
```

Order query runtime hiện chưa trả DTO này đầy đủ; type trên là target dựa trên persistence model và cần được xác nhận bằng integration test khi service được wire.

## 6. Address, voucher, review và notification

```typescript
// Current runtime response from GET/POST /addresses uses camelCase.
export interface AddressResponseDTO {
  addressId: UUID;
  userId: UUID;
  recipientName: string;
  phone: string;
  province: string;
  provinceCode?: string | null;
  district: string | null;
  ward: string;
  wardCode?: string | null;
  detailAddress: string;
  isDefault: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// Request fields for POST /addresses use snake_case.
export interface CreateAddressRequestDTO {
  recipient_name: string;
  phone: string;
  province_code: string;
  ward_code: string;
  detail_address: string;
  is_default?: boolean;
}

// GET /vouchers(/applicable) hiện trả domain object camelCase.
export interface VoucherRuntimeDTO {
  voucherId: UUID;
  code: string;
  voucherName: string;
  scope: "PLATFORM" | "SHOP";
  shopId: UUID | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: DecimalString;
  maxDiscount: DecimalString | null;
  minOrderValue: DecimalString;
  quantity: number;
  startAt: ISODateTime;
  endAt: ISODateTime;
  status: "ACTIVE" | "INACTIVE";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// POST /vouchers/evaluate runtime hiện dùng VoucherPortService; không trả VoucherDTO.
export type VoucherEvaluationRuntimeDTO =
  | { isValid: true; voucherId: UUID; discountAmount: DecimalString }
  | { isValid: false; errorCode: string; errorMessage: string };

// View-model cho UI có thể chuẩn hóa sang camelCase theo adapter.
export interface VoucherViewModel {
  id: UUID;
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: DecimalString;
}

export interface ReviewDTO {
  review_id: UUID;
  buyer_id: UUID;
  product_id: UUID;
  order_item_id: UUID;
  rating: 1 | 2 | 3 | 4 | 5;
  content: string | null;
  status: "VISIBLE" | "HIDDEN";
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface NotificationDTO {
  notification_id: UUID;
  recipient_id: UUID;
  type: "ORDER" | "PAYMENT" | "SHIPPING" | "VIOLATION" | "SYSTEM";
  title: string;
  content: string;
  is_read: boolean;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
}
```

Address list/create/detail/update/delete/default hoạt động trong runtime. Review và notification routes có source contract nhưng chỉ chuyển `LIVE` sau khi services được inject và runtime integration tests pass.

## 7. View-model adapters

Ví dụ adapter catalog:

```typescript
export interface ProductCardModel {
  id: string;
  name: string;
  imageUrl: string | null;
  priceLabel: string;
  totalStock: number;
}

export function toProductCard(dto: ProductListItemDTO): ProductCardModel {
  return {
    id: dto.product_id,
    name: dto.product_name,
    imageUrl: dto.image_url,
    priceLabel: formatVnd(dto.min_price),
    totalStock: dto.total_stock,
  };
}
```

Adapter phải có unit test cho null, decimal string, enum lạ và field thiếu. Không âm thầm thay rating/sold count bằng số giả; nếu thiếu dữ liệu thì ẩn UI hoặc hiển thị “Chưa có dữ liệu”.

## 8. DTO bổ sung cho MVP freeze

Wire type được sinh từ OpenAPI, không viết tay lại trong FE. View-model tối thiểu cần có:

```ts
type CapabilityState = "LIVE" | "MOCK_DEV_ONLY" | "BLOCKED";

type OrderTimelineItem = {
  history_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_at: string;
  changed_by_role: UserRole;
  reason: string | null;
};

type RatingSummary = {
  average: string | null;
  count: number;
};

type MediaUploadTicket = {
  media_id: string;
  upload_url: string;
  expires_at: string;
  required_headers: Record<string, string>;
};
```

Product Detail nhận `rating_summary` và review page riêng theo cursor. Order Detail nhận timeline từ `order_status_history`; FE không tự suy timeline từ status hiện tại. Media attachment dùng `media_id`, không dùng object path do client tự tạo.
