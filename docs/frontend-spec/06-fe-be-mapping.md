# 06. FE–BE mapping

> **Phiên bản:** 1.1.0  
> **Trạng thái:** IMPLEMENTATION MATRIX

## 1. Mapping theo hành động

| Page/action | FE module | Endpoint/Provider | Payload/Query | Runtime | FE decision |
|---|---|---|---|---|---|
| Login | `authRepository.signIn` | Supabase Auth | email/password | `PARTIAL` | tích hợp; kiểm tra app user sau login |
| Register | `authRepository.signUp` | Supabase + onboarding | account data | `BLOCKED` | mock/feature flag |
| Product list | `catalogRepository.list` | `GET /products` | search/category/sort/cursor | `AVAILABLE` | tích hợp thật |
| Category filter | `categoryRepository.list` | `GET /categories` | — | `MISSING` | static config/ẩn |
| Product detail | `catalogRepository.get` | `GET /products/:id` | product ID | `PARTIAL` | tích hợp core; placeholder ảnh/shop |
| Add cart | `cartRepository.add` | `POST /cart/items` | variant_id, quantity | `AVAILABLE` | tích hợp thật |
| Load cart | `cartRepository.get` | `GET /cart` | — | `PARTIAL` | chờ enriched data/mock |
| Change quantity | `cartRepository.update` | `PATCH /cart/items/:id` | quantity | `AVAILABLE` | optimistic + rollback |
| Select cart item | `cartRepository.update` | `PATCH /cart/items/:id` | is_selected | `AVAILABLE` | server state |
| Delete item | `cartRepository.remove` | `DELETE /cart/items/:id` | — | `AVAILABLE` | 204, không parse JSON |
| Delete selected | `cartRepository.removeSelected` | `DELETE /cart/selected` | không body | `RUNTIME_BLOCKED` | không bật production |
| Address list/create | `addressRepository` | `GET/POST /addresses` | address DTO | `AVAILABLE` | tích hợp thật |
| Address edit/default/delete | `addressRepository` | address item routes | address DTO | `RUNTIME_BLOCKED` | mock/disable |
| Voucher list | `voucherRepository.list` | `GET /vouchers/applicable` | scope/shop_id/now | `AVAILABLE` | tích hợp thật |
| Voucher preview | `voucherRepository.evaluate` | `POST /vouchers/evaluate` | code/order_subtotal/shop_id | `AVAILABLE` | tích hợp thật |
| Checkout | `checkoutRepository.create` | `POST /checkout` | address/payment/vouchers + header | `AVAILABLE` | tích hợp thật sau cart selection |
| Order list/detail | `orderRepository` | `GET /orders`, `/orders/:id` | role lấy từ token | `RUNTIME_BLOCKED` | mock/feature flag |
| Cancel order | `orderRepository.cancel` | `POST /orders/:id/cancel` | reason | `AVAILABLE` | bật khi có order query |
| Confirm order | `orderRepository.confirm` | `POST /orders/:id/confirm` | optional reason | `AVAILABLE` | bật khi có order query |
| Transition order | `orderRepository.transition` | `POST /orders/:id/transition` | tuần tự theo state; `to`/`reason`/`shipment_status` | `AVAILABLE` | Seller không được nhảy `CONFIRMED → SHIPPING` hoặc tự hoàn tất đơn |
| Payment retry | `paymentRepository.retry` | `POST /orders/:id/payments` | payment_method | `PARTIAL` | không gọi trong checkout success |
| Submit review | `reviewRepository.create` | `POST /order-items/:id/review` | product_id/rating/content/images | `RUNTIME_BLOCKED` | UI mock, submit off |
| Notifications | `notificationRepository` | notification routes | is_read | `RUNTIME_BLOCKED` | mock/feature flag |
| Profile | `profileRepository` | `GET/PATCH /profile` | profile DTO | `MISSING` | Supabase read-only/mock |
| Seller product list | `sellerCatalogRepository.list` | proposed seller products API | filters | `MISSING` | mock |
| Seller stock | `sellerCatalogRepository.updateStock` | `PATCH /product-variants/:id/stock` | quantity | `AVAILABLE` | integrate if variant IDs known |
| Create product | `sellerCatalogRepository.create` | `POST /products` | create DTO | `PARTIAL` | static categories + URL images in dev |
| Admin users/logs | `adminRepository` | proposed admin reads | filters/cursor | `MISSING` | mock |
| Lock/unlock user | `adminRepository.moderateUser` | admin user routes | reason | `AVAILABLE` | enable once user IDs are available |

## 2. Repository interfaces

Page/component chỉ phụ thuộc interface để có thể chuyển giữa API và mock mà không đổi UI.

```typescript
export interface CatalogRepository {
  list(query: ProductListQuery): Promise<Page<ProductCardModel>>;
  get(id: string): Promise<ProductDetailModel>;
}

export interface CartRepository {
  get(): Promise<CartModel>;
  add(input: AddCartItemInput): Promise<CartItemModel>;
  update(id: string, input: UpdateCartItemInput): Promise<CartItemModel>;
  remove(id: string): Promise<void>;
}

export interface CheckoutRepository {
  create(input: CheckoutInput, idempotencyKey: string): Promise<CheckoutResultModel>;
}
```

Mock và API implementation phải dùng cùng interface và cùng error model. Không đặt điều kiện `if (useMock)` trong component.

## 3. Cache và mutation policy

| Resource | Cache key | Sau mutation |
|---|---|---|
| Products | `products`, normalized query | invalidate item/list khi seller tạo/sửa |
| Product detail | `product`, id | invalidate sau stock update |
| Cart | `cart`, user ID | optimistic update; rollback khi lỗi |
| Addresses | `addresses`, user ID | invalidate list |
| Vouchers | `vouchers`, scope/shop | preview không cache dài |
| Orders | `orders`, role/status | invalidate list + detail sau mutation |
| Notifications | `notifications`, filters | optimistic mark-read |

Không lưu access token trong query key, log hoặc error details.

## 4. Field mapping quan trọng

| Wire | View-model | Ghi chú |
|---|---|---|
| `stock_quantity` | `stockQuantity` | create variant dùng field này; PATCH stock dùng `quantity`, không gửi `stock` |
| `is_selected` | `isSelected` | server state |
| `variant_value` | `variantValue` | không có `attributes` object hiện tại |
| `subtotal` | `subtotal` | decimal string → Money |
| `line_total` | `lineTotal` | không dùng `total_price` |
| `payment_method: ONLINE` | `paymentMethod: online` | không suy diễn QR/Momo/Card |
| `to` | `toStatus` trong UI | adapter đổi tên khi gửi request |
| `reason` | `reason` | không gửi `note` |

`rejectUnknown` làm request DTO nhạy với field thừa: serialize object request riêng theo endpoint; không gửi spread view-model chứa `id`, timestamp hoặc `stock`.

## 5. Checkout intent and idempotency

- Key gắn với snapshot của `address_id`, `payment_method`, `vouchers`.
- Retry cùng snapshot khi response mơ hồ thì giữ nguyên key.
- Người dùng sửa địa chỉ, payment method hoặc voucher thì sinh key mới.
- Nếu lần submit trước mơ hồ, resolve bằng retry key cũ trước khi gửi intent mới để tránh đơn trùng.
- Một checkout thành công kết thúc intent; lần checkout mới dùng key mới.
- Lưu key/snapshot qua reload (session storage) để không làm mất khả năng retry.

## 6. Feature flags

Đề xuất:

```text
NEXT_PUBLIC_ENABLE_REGISTRATION=false
NEXT_PUBLIC_ENABLE_ORDER_CENTER=false
NEXT_PUBLIC_ENABLE_REVIEWS=false
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=false
NEXT_PUBLIC_ENABLE_PROFILE_EDIT=false
NEXT_PUBLIC_ENABLE_ADMIN_READS=false
```

Feature flag chỉ kiểm soát UI rollout, không thay thế RBAC backend.
