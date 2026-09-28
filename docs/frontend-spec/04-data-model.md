# 04. Data model và FE adapters

> **Phiên bản:** 1.1.0  
> **Trạng thái:** READY FOR FE FOUNDATION

## 1. Ba lớp dữ liệu

Không dùng một interface cho DB, API và UI.

1. **Wire DTO:** đúng JSON backend, snake_case, money là decimal string khi backend trả PostgreSQL `NUMERIC`.
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
export interface AddressDTO {
  address_id: UUID;
  user_id: UUID;
  recipient_name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detail_address: string;
  is_default: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface VoucherDTO {
  voucher_id: UUID;
  code: string;
  voucher_name: string;
  scope: "PLATFORM" | "SHOP";
  shop_id: UUID | null;
  discount_type: "PERCENT" | "FIXED";
  discount_value: DecimalString;
  max_discount: DecimalString | null;
  min_order_value: DecimalString;
  quantity: number;
  start_at: ISODateTime;
  end_at: ISODateTime;
  status: "ACTIVE" | "INACTIVE";
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

Address list/create hoạt động trong runtime. Address detail/update/delete/default, review và notification đang `RUNTIME_BLOCKED`.

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
