# 06. FE–BE mapping

> **Phiên bản:** 1.1.0  
> **Trạng thái:** IMPLEMENTATION MATRIX

## 1. Mapping theo hành động

| Page/action | FE module | Endpoint/Provider | Payload/Query | Runtime | FE decision |
|---|---|---|---|---|---|
| Login | `authRepository.signIn` | Supabase Auth | email/password | `PARTIAL` | tích hợp; kiểm tra app user sau login |
| Register | `authRepository.signUp` | Supabase + onboarding | account data | `BLOCKED` | mock/feature flag |
| Product list | `catalogRepository.list` | `GET /products` | search/category/sort/cursor | `AVAILABLE` | tích hợp thật |
| Category filter | `categoryRepository.list` | `GET /categories` | — | `MISSING` (route chưa mount) | Chỉ dùng static dev config sau khi chạy [guarded category seed](../architecture/backend-run-guide.md) trên đúng DB dev/test; production tiếp tục ẩn tới khi API có |
| Product detail | `catalogRepository.get` | `GET /products/:id` | product ID | `PARTIAL` | tích hợp core; placeholder ảnh/shop |
| Add cart | `cartRepository.add` | `POST /cart/items` | variant_id, quantity | `AVAILABLE` | tích hợp thật |
| Load cart | `cartRepository.get` | `GET /cart` | — | `PARTIAL` | chờ enriched data/mock |
| Change quantity | `cartRepository.update` | `PATCH /cart/items/:id` | quantity | `AVAILABLE` | optimistic + rollback |
| Select cart item | `cartRepository.update` | `PATCH /cart/items/:id` | is_selected | `AVAILABLE` | server state |
| Delete item | `cartRepository.remove` | `DELETE /cart/items/:id` | — | `AVAILABLE` | 204, không parse JSON |
| Delete selected | `cartRepository.removeSelected` | `DELETE /cart/selected` | không body | `AVAILABLE` | 204; invalidate cart |
| Address list/create | `addressRepository` | `GET/POST /addresses` | address DTO | `AVAILABLE` | tích hợp thật |
| Address edit/default/delete | `addressRepository` | `GET/PATCH/DELETE /addresses/:id`, `PATCH /addresses/:id/default` | address DTO | `NOT_IMPLEMENTED` (501) | giữ UI mock/gated; list/create dùng `/addresses` |
| Voucher list | `voucherRepository.list` | `GET /vouchers/applicable` | scope/shop_id/now | `AVAILABLE` | runtime camelCase; adapter map rõ theo `VoucherRuntimeDTO` |
| Voucher preview | `voucherRepository.evaluate` | `POST /vouchers/evaluate` | code/order_subtotal/shop_id | `AVAILABLE` | runtime union camelCase `{isValid, voucherId, discountAmount}` / `{isValid, errorCode, errorMessage}`; không có voucher lồng |
| Checkout | `checkoutRepository.create` | `POST /checkout` | address/payment/vouchers + header | `AVAILABLE` | tích hợp thật sau cart selection |
| Order list/detail | `orderRepository` | `GET /orders`, `/orders/:id` | role lấy từ token | `STUB` (200 empty/placeholder) | mock/feature flag; không render response stub như data thật |
| Cancel order | `orderRepository.cancel` | `POST /orders/:id/cancel` | `{ reason }` | `AVAILABLE` | handler thật; chỉ bật với order ID hợp lệ và xử lý 409 |
| Confirm order | `orderRepository.confirm` | `POST /orders/:id/confirm` | body không cần reason | `AVAILABLE` | handler thật; chỉ bật với order ID hợp lệ |
| Transition order | `orderRepository.transition` | `POST /orders/:id/transition` | tuần tự theo state; `to`/`reason`/`shipment_status` | `AVAILABLE` | Seller không được nhảy `CONFIRMED → SHIPPING` hoặc tự hoàn tất đơn |
| Payment retry | `paymentRepository.retry` | `POST /orders/:id/payments` | payment_method | `AVAILABLE` | retry hiện hữu; không gọi trong checkout success, không tạo QR/provider session |
| Submit review | `reviewRepository.create` | `POST /order-items/:id/review` | product_id/rating/content/images | `NOT_IMPLEMENTED` (501) | làm UI text/rating bằng mock; production submit tắt |
| Notifications | `notificationRepository` | `GET/PATCH /notifications...` | is_read | `NOT_IMPLEMENTED` (501) | mock/feature flag; route có nhưng runtime service chưa inject |
| Profile | `profileRepository` | `/profile` hoặc `/buyers/profile` | profile DTO | `MISSING` (404) | chỉ dùng auth metadata read-only; không gọi API profile |
| Seller product list | `sellerCatalogRepository.list` | `GET /seller/products` | filters | `MISSING` (404) | mock/gated; không dùng public list với `shop_id` |
| Seller stock | `sellerCatalogRepository.updateStock` | `PATCH /product-variants/:id/stock` | quantity | `AVAILABLE` | integrate if variant IDs known |
| Create product | `sellerCatalogRepository.create` | `POST /products` | create DTO | `PARTIAL` | static categories + URL images in dev |
| Admin users/logs | `adminRepository` | proposed admin reads | filters/cursor | `MISSING` (404) | mock; không có route để lấy danh sách target |
| Lock/unlock user | `adminRepository.moderateUser` | `POST /admin/users/:id/lock|unlock` | reason | `AVAILABLE` | có mutation/audit; UI chỉ gọi khi có target ID hợp lệ |

## 1.1. Đối chiếu API modules hiện có trong FE

Các kiểu/path dưới đây trong `frontend/src/lib/api/` chưa khớp runtime; xử lý như việc cần làm trước khi bật live integration, không xem TypeScript interface hiện tại là contract backend:

| FE module hiện tại | Sai lệch với runtime | Cách dùng/sửa trước khi bật |
|---|---|---|
| `buyer.api.ts` | Address đang gọi `/buyers/addresses`; backend mount `/addresses`. `WireAddress` dùng `id/receiver_name/...`, trong khi response là camelCase `addressId/recipientName/phone/province/district/ward/detailAddress/isDefault/...` | Đổi path và wire DTO theo `05-api-contract.md`; giữ profile route gated vì chưa tồn tại |
| `buyer.api.ts` profile | `/buyers/profile` không được mount; `/profile` cũng chưa được mount | Không gọi live; chỉ dùng AuthProvider metadata/read-only cho đến khi backend có route |
| `buyer.api.ts` cart | `WireCart.id` và `WireCartItem.id` không khớp `cart_id`, `cart_item_id`; GET chỉ có variant ID/quantity/selection | Đổi DTO; giữ enrichment/display data mock hoặc gated đến khi có read model đủ thông tin |
| `order.api.ts` | `WireOrder` giả định `id/order_code/final_amount/items`; order list/detail hiện là stub và mutation trả response snake_case khác | Không gắn type `WireOrder` vào stub như data thật; cập nhật DTO theo response được chốt khi order reads được wire |
| `voucher.api.ts` | `EvaluateVoucherResult` dùng `is_valid/discount_amount`; runtime trả camelCase union `isValid` + `voucherId/discountAmount` hoặc `errorCode/errorMessage` | Sửa DTO/adapter trước khi dùng response runtime |
| `catalog.api.ts` | List/detail wire fields khớp route hiện có; category list và seller-scoped product list không có API | Tiếp tục dùng API thật cho public catalog; ẩn/fixture cho category và seller list |

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

Parser lỗi phải xác nhận payload là JSON object và `error` là object trước khi đọc `code`/`message`; vẫn chịu được body rỗng/không JSON, thiếu `request_id` và code chưa biết để UI không crash. Runtime 501 hiện trả ErrorEnvelope `NOT_IMPLEMENTED`.

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
