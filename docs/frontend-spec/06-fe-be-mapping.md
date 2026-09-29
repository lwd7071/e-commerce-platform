# 06. FE–BE mapping

> **Phiên bản:** 1.1.0  
> **Trạng thái:** IMPLEMENTATION MATRIX

## 1. Mapping theo hành động

| Page/action | FE module | Endpoint/Provider | Payload/Query | Runtime | FE decision |
|---|---|---|---|---|---|
| Login | `authRepository.signIn` | Supabase Auth | email/password | `PARTIAL` | tích hợp; kiểm tra app user sau login |
| Register + OTP | `AuthProvider.register`, `verifySignupOtp` | Supabase Auth + `POST /auth/onboarding` | email/password then six-digit token and validated onboarding draft | `PARTIAL` | Source flow is wired; confirm provider/template configuration and real email smoke tests |
| Google login | `AuthProvider.loginWithGoogle` | Supabase OAuth + `/auth/callback` | OAuth code, optional sessionStorage signup draft | `PARTIAL` | Google/Supabase dashboard credentials and redirect allowlist still required |
| Password recovery | `requestPasswordReset`, `updatePassword` | Supabase Auth | recovery link, new password | `PARTIAL` | Provider template and recovery redirect require real Supabase smoke test |
| Product list | `catalogRepository.list` | `GET /products` | search/category/sort/cursor | `AVAILABLE` | tích hợp thật |
| Category filter | `categoryRepository.list` | `GET /categories` | — | `AVAILABLE` | API adapter loads active flat list and caches it; failures propagate |
| Product detail | `catalogRepository.get` | `GET /products/:id` | product ID | `PARTIAL` | tích hợp core; placeholder ảnh/shop |
| Add cart | `cartRepository.add` | `POST /cart/items` | variant_id, quantity | `AVAILABLE` | tích hợp thật |
| Load cart | `cartRepository.get` | `GET /cart` | — | `AVAILABLE` | Maps live product/variant/shop/image/current price/stock; unavailable items remain visible and cannot be checked out |
| Change quantity | `cartRepository.update` | `PATCH /cart/items/:id` | quantity | `AVAILABLE` | optimistic + rollback |
| Select cart item | `cartRepository.update` | `PATCH /cart/items/:id` | is_selected | `AVAILABLE` | server state |
| Delete item | `cartRepository.remove` | `DELETE /cart/items/:id` | — | `AVAILABLE` | 204, không parse JSON |
| Delete selected | `cartRepository.removeSelected` | `DELETE /cart/selected` | không body | `AVAILABLE` | 204; invalidate cart |
| Address list/create | `addressRepository` | `GET/POST /addresses` | address DTO | `AVAILABLE` | tích hợp thật |
| Address edit/default/delete | `addressRepository` | `GET/PATCH/DELETE /addresses/:id`, `PATCH /addresses/:id/default` | address DTO | `AVAILABLE` | Owner-scoped routes; default update transactional |
| Voucher list | `voucherRepository.list` | `GET /vouchers/applicable` | scope/shop_id/now | `AVAILABLE` | runtime camelCase; adapter map rõ theo `VoucherRuntimeDTO` |
| Voucher preview | `voucherRepository.evaluate` | `POST /vouchers/evaluate` | code/order_subtotal/shop_id | `AVAILABLE` | runtime union camelCase `{isValid, voucherId, discountAmount}` / `{isValid, errorCode, errorMessage}`; không có voucher lồng |
| Checkout | `checkoutRepository.create` | `POST /checkout` | address/payment/vouchers + header | `AVAILABLE` | tích hợp thật sau cart selection |
| Order list/detail | `orderRepository` | `GET /orders`, `/orders/:id` | status filter; role/owner from verified context | `AVAILABLE` | Wire DTO maps to the UI model at `order.api.ts` |
| Cancel order | `orderRepository.cancel` | `POST /orders/:id/cancel` | `{ reason }` | `AVAILABLE` | handler thật; chỉ bật với order ID hợp lệ và xử lý 409 |
| Confirm order | `orderRepository.confirm` | `POST /orders/:id/confirm` | body không cần reason | `AVAILABLE` | handler thật; chỉ bật với order ID hợp lệ |
| Transition order | `orderRepository.transition` | `POST /orders/:id/transition` | tuần tự theo state; `to`/`reason`/`shipment_status` | `AVAILABLE` | Seller không được nhảy `CONFIRMED → SHIPPING` hoặc tự hoàn tất đơn |
| Payment retry | `paymentRepository.retry` | `POST /orders/:id/payments` | payment_method | `AVAILABLE` | retry hiện hữu; không gọi trong checkout success, không tạo QR/provider session |
| Submit review | `reviewRepository.create` | `POST /order-items/:id/review` | product_id/rating/content/images | `NOT_IMPLEMENTED` (501) | làm UI text/rating bằng mock; production submit tắt |
| Notifications | `notificationRepository` | `GET/PATCH /notifications...` | is_read | `NOT_IMPLEMENTED` (501) | mock/feature flag; route có nhưng runtime service chưa inject |
| Profile | `profileRepository` | `GET/PATCH /profile` | `full_name`, `phone` | `AVAILABLE` | Email/role server-owned; avatar upload remains unsupported |
| Seller product list | `sellerCatalogRepository.list` | `GET /seller/products` | filters | `MISSING` (404) | mock/gated; không dùng public list với `shop_id` |
| Seller stock | `sellerCatalogRepository.updateStock` | `PATCH /product-variants/:id/stock` | quantity | `AVAILABLE` | integrate if variant IDs known |
| Create product | `sellerCatalogRepository.create` | `POST /products` | create DTO | `PARTIAL` | static categories + URL images in dev |
| Admin users/logs | `adminRepository` | proposed admin reads | filters/cursor | `MISSING` (404) | mock; không có route để lấy danh sách target |
| Lock/unlock user | `adminRepository.moderateUser` | `POST /admin/users/:id/lock|unlock` | reason | `AVAILABLE` | có mutation/audit; UI chỉ gọi khi có target ID hợp lệ |

## 1.1. Đối chiếu API modules hiện có trong FE

Các kiểu/path dưới đây trong `frontend/src/lib/api/` chưa khớp runtime; xử lý như việc cần làm trước khi bật live integration, không xem TypeScript interface hiện tại là contract backend:

| FE module hiện tại | Sai lệch với runtime | Cách dùng/sửa trước khi bật |
|---|---|---|
| `buyer.api.ts` | Runtime Address DTO là camelCase; profile API dùng snake_case; enriched cart dùng snake_case | Mỗi API boundary khai báo contract tương ứng; không đổi casing toàn cục |
| `buyer.api.ts` profile | Live profile tại `/profile`, chỉ nhận `full_name` và `phone` khi PATCH | UI tải và lưu profile qua API; email/role chỉ đọc; avatar đang disabled |
| `buyer.api.ts` cart | Enriched GET gồm current price, stock, product/shop display fields và availability | Adapter ánh xạ sang CartItem view model; lỗi API không chuyển sang fixture |
| `order.api.ts` | Backend `OrderReadDTO` dùng `order_id`, `total_amount`, `unit_price`, `line_total` | `mapOrder` đổi DTO sang UI model; không gửi `shop_id` filter từ client |
| `voucher.api.ts` | `EvaluateVoucherResult` dùng `is_valid/discount_amount`; runtime trả camelCase union `isValid` + `voucherId/discountAmount` hoặc `errorCode/errorMessage` | Sửa DTO/adapter trước khi dùng response runtime |
| `catalog.api.ts` | Category list hiện có API; seller-scoped product list chưa có API | Dùng live category adapter; seller product list vẫn gated |

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
