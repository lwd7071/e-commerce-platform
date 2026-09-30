# 05. API contract FE–BE

> **Phiên bản:** 1.4.0
>
> **Trạng thái:** CURRENT RUNTIME + MVP TARGET CONTRACT FREEZE 30/09/2026

## 1. Global conventions

- Base URL: `/api/v1`.
- Authenticated route dùng `Authorization: Bearer <supabase_access_token>`.
- Request và response phần lớn dùng snake_case; một số response runtime Address/Voucher trả domain object camelCase. Schema ngoại lệ được ghi tại endpoint tương ứng; không áp dụng casing transform toàn cục.
- `request_id` phải được log/copy khi báo lỗi hỗ trợ.
- `204 No Content` không được parse JSON.
- Timeout/retry: chỉ tự retry GET an toàn; mutation chỉ retry khi có idempotency contract.

### Envelopes

```typescript
type SuccessEnvelope<T> = { data: T; request_id: string };
type PaginatedEnvelope<T> = {
  data: T[];
  meta: { next_cursor: string | null; has_more: boolean; limit: number };
  request_id: string;
};
type ErrorEnvelope = {
  error: { code: string; message: string; details?: unknown };
  request_id?: string;
};
```

Backend không trả field `success`.

**Phòng thủ parser:** runtime hiện chuẩn hóa lỗi chưa được triển khai thành HTTP 501 `NOT_IMPLEMENTED` theo ErrorEnvelope. Client vẫn cần kiểm tra shape ở runtime, chịu được body rỗng/không phải JSON, `request_id` vắng mặt và error code chưa biết; không giả định TypeScript type đảm bảo payload mạng hợp lệ.

## 2. Runtime readiness

### Căn cứ runtime (2026-09-30; đối chiếu source hiện tại)

Runtime composition tại `backend/src/platform/http/app.ts` inject identity/onboarding, catalog, buyer profile/address, checkout, order query/commands và moderation services. Một service class hoặc đường dẫn trong OpenAPI tự nó không chứng minh endpoint đã được nối vào runtime này.

Status meanings below:

- `AVAILABLE`: router đã mount và gọi handler runtime cụ thể.
- `PARTIAL`: có handler nhưng response còn thiếu dữ liệu cho toàn bộ FE flow.
- `STUB`: route trả HTTP 200 với dữ liệu rỗng/placeholder; không dùng làm dữ liệu nghiệp vụ thật.
- `NOT_IMPLEMENTED`: route đã mount nhưng runtime hiện trả HTTP 501 `NOT_IMPLEMENTED`.
- `MISSING`: chưa mount route tương ứng; dự kiến HTTP 404. Khai báo OpenAPI không làm thay đổi trạng thái này.

| Domain | Endpoint | Role | Status | Ghi chú |
|---|---|---|---|---|
| System | `GET /health` | Public | `AVAILABLE` | Health check |
| System | `GET /openapi.json` | Public | `AVAILABLE` | Kiểm tra method+path hai chiều; schema cụ thể tiếp tục được hoàn thiện theo backend |
| Catalog | `GET /products` | Public | `AVAILABLE` | Cursor pagination |
| Catalog | `GET /products/:product_id` | Public | `PARTIAL` | Thiếu images/shop/reviews/metrics |
| Catalog | `POST /products` | Seller | `AVAILABLE/PARTIAL_RELEASE` | Runtime tạo sản phẩm/variants; category và upload ảnh Storage thật đã có; Seller live E2E pass trên Supabase test. Backend-host/release smoke còn mở |
| Catalog | `PATCH /product-variants/:variant_id/stock` | Seller | `AVAILABLE` | Body `{ quantity }` |
| Catalog | `GET /seller/products`, `PATCH /seller/products/:id/status` | Seller | `AVAILABLE` | Routes mounted; scope/ownership và trạng thái shop do catalog runtime kiểm tra. Seller full flow E2E chưa được chứng minh trong `frontend/e2e` |
| Catalog | `GET /categories` | Public | `AVAILABLE` | Chỉ category ACTIVE, danh sách phẳng, roots trước; dùng `PgCategoryRepository` |
| Admin | category list/create/update/status | Admin | `AVAILABLE` | Category CRUD/status routes đã được mount; kiểm tra acceptance RB-KN04 ở backend tests |
| Catalog | `GET /shops/:id` | Public | `MISSING` | Chưa có route runtime |
| Catalog | `GET /products?shop_id=...` | Seller | `MISSING` | Không phải API được hỗ trợ; dùng route seller-scoped `GET /seller/products` ở dòng trên |
| Address | `GET /addresses` | Buyer | `AVAILABLE` | Runtime legacy service |
| Address | `POST /addresses` | Buyer | `AVAILABLE` | Runtime legacy service |
| Address | `GET/PATCH/DELETE /addresses/:address_id`, `PATCH .../default` | Buyer | `AVAILABLE` | Handler/service đã được nối; thao tác scope theo JWT; đặt mặc định trong transaction; order giữ snapshot địa chỉ |
| Cart | `GET /cart` | Buyer | `AVAILABLE` | Join sản phẩm, variant, shop, ảnh chính và giá/tồn kho hiện tại; hàng inactive/hết kho vẫn trả với `is_available=false` |
| Cart | add/update/delete item | Buyer | `AVAILABLE` | Update hỗ trợ `is_selected` |
| Cart | `DELETE /cart/selected` | Buyer | `AVAILABLE` | Xóa item đang chọn trong cart của buyer; trả 204 |
| Voucher | list/evaluate | Buyer | `AVAILABLE` | Dùng `code`, `order_subtotal`, `shop_id` |
| Checkout | `POST /checkout` | Buyer | `AVAILABLE` | Bắt buộc Idempotency-Key |
| Orders | `GET /orders` | Buyer/Seller/Admin | `AVAILABLE` | `OrderQueryService` PostgreSQL read model, DTO có items; role và ownership được xác minh từ context |
| Orders | `GET /orders/:id` | Buyer/Seller/Admin | `AVAILABLE` | Cùng DTO với list; ngoài ownership và không tồn tại trả 404 |
| Orders | cancel/confirm/transition | Theo route | `AVAILABLE` | Được `PgCheckoutService` xử lý; chỉ dùng khi có order ID hợp lệ |
| Payment | `POST /orders/:id/payments` | Buyer | `AVAILABLE` | Chỉ retry payment; không tạo provider session, QR hoặc link |
| Review | `POST /order-items/:id/review`, `POST /reviews`, `GET /products/:product_id/reviews` | Buyer/Public | `AVAILABLE` | `ReviewService` được inject trong `app.ts`; route vẫn có defensive 501 nếu service không được cung cấp. Cần DB/test-project smoke để xác nhận môi trường triển khai |
| Notification | list/detail/read | Buyer | `AVAILABLE` | Runtime có `NotificationService`; FE API repository đã nối theo payload camelCase và OpenAPI có `NotificationDTO`, nhưng FE DTO chưa sinh tự động; production mặc định BLOCKED đến khi cấu hình capability và xác minh authenticated host |
| Identity | `GET /auth/me`, `POST /auth/onboarding` | Authenticated | `AVAILABLE` | Role lấy từ `app_users`; onboarding Buyer/Seller chạy transaction; shop Seller ban đầu PENDING |
| Profile | `GET/PATCH /profile`, `PATCH /profile/avatar` | Authenticated | `AVAILABLE` | Chỉ sửa `full_name`, `phone`; avatar nhận `media_id` đã finalize, không nhận URL tùy ý |
| Admin | `GET /admin/users`, lock/unlock | Admin | `AVAILABLE/PARTIAL` | List/filter và mutation đã mount; cần pagination, protected Admin target và side-effect tests |
| Admin | `GET /admin/shops`, approve/lock/unlock | Admin | `AVAILABLE/PARTIAL` | Routes đã mount; cần pagination và atomic audit evidence |
| Admin | category writes | Admin | `AVAILABLE` | CRUD/status routes được mount; logs và product/review moderation nâng cao vẫn chưa có |
| Seller | seller stats | Seller | `MISSING` | Không có HTTP stats route |
| Media | presign/finalize/attach/delete; `PATCH /profile/avatar` | Authenticated | `PARTIAL` | Product và avatar dùng Supabase Storage thật; avatar attach cập nhật profile transactionally. Review-media runtime vẫn chưa được nối; cần Storage host smoke trước release |

Order reads, profile, public categories, addresses, enriched cart, seller product routes, review/notification services và Admin category routes hiện có trong runtime composition. Product/avatar media và Notifications có E2E trên Supabase test; backend host smoke vẫn mở do `/health/readiness` trả HTTP 404 trong cấu hình hiện tại. Seller stats, Admin log/moderation nâng cao và online payment provider chưa có. Google OAuth, email OTP/recovery vẫn phụ thuộc cấu hình provider tại Supabase/Google Cloud.

## 3. Catalog

### `GET /products`

Query hỗ trợ:

| Param | Type | Rule |
|---|---|---|
| `category_id` | UUID | optional |
| `search` | string | optional |
| `min_price`, `max_price` | decimal string | ví dụ `100000.00` |
| `sort` | enum | `price_asc`, `price_desc`, `created_at_desc` |
| `limit` | integer | 1–100, default 20 |
| `cursor` | string | opaque; không tự parse |

Response item:

```json
{
  "product_id": "uuid",
  "product_name": "Áo sơ mi Linen",
  "shop_id": "uuid",
  "category_id": "uuid",
  "min_price": "289000.00",
  "max_price": "320000.00",
  "total_stock": 75,
  "image_url": "https://...",
  "created_at": "2026-09-28T08:30:00.000Z"
}
```

Query lạ, gồm `shop_id`, bị từ chối bằng validation error.

### `GET /products/:product_id`

Response hiện hành:

```json
{
  "data": {
    "product_id": "uuid",
    "shop_id": "uuid",
    "category_id": "uuid",
    "product_name": "Áo sơ mi Linen",
    "description": "...",
    "status": "ACTIVE",
    "variants": [
      {
        "variant_id": "uuid",
        "variant_name": "Màu",
        "variant_value": "Be / M",
        "sku": "LINEN-BE-M",
        "price": "289000.00",
        "stock_quantity": 45,
        "status": "ACTIVE"
      }
    ]
  },
  "request_id": "req_..."
}
```

### `POST /products`

Role `SELLER`; backend lấy shop từ auth context.

```json
{
  "category_id": "uuid",
  "product_name": "Đèn gốm",
  "description": "...",
  "images": [{ "image_url": "https://...", "sort_order": 0 }],
  "variants": [
    {
      "variant_name": "Màu men",
      "variant_value": "Men mộc",
      "sku": "POT-01",
      "price": "520000.00",
      "stock_quantity": 15
    }
  ]
}
```

### `PATCH /product-variants/:variant_id/stock`

```json
{ "quantity": 20 }
```

> **Cảnh báo field:** `POST /products` dùng `stock_quantity` bên trong mỗi variant; `PATCH /product-variants/:variant_id/stock` chỉ nhận `quantity`. Không gửi `{ "stock": 20 }` hoặc thêm `id`, `created_at` hay field view-model vào request. Route kiểm tra field không được phép và có thể trả validation error.

## 4. Address book

### `GET /addresses`

Role `BUYER`. Trả `200` với `data` là danh sách địa chỉ của user hiện tại, sắp xếp địa chỉ mặc định trước rồi theo thời gian tạo. Response runtime hiện dùng **camelCase** do trả domain object; đây là ngoại lệ so với convention snake_case của các API khác:

```json
{
  "data": [
    {
      "addressId": "uuid",
      "userId": "uuid",
      "recipientName": "Nguyễn An",
      "phone": "0900000000",
      "province": "TP Hồ Chí Minh",
      "district": "Quận 1",
      "ward": "Phường Bến Nghé",
      "detailAddress": "12 Nguyễn Huệ",
      "isDefault": true,
      "createdAt": "2026-09-28T08:30:00.000Z",
      "updatedAt": "2026-09-28T08:30:00.000Z"
    }
  ],
  "request_id": "req_..."
}
```

### `POST /addresses`

Role `BUYER`; response `201` envelope với object cùng camelCase shape như trên. Request body dùng snake_case. Sáu trường đầu là bắt buộc, `is_default` tùy chọn và mặc định `false`:

```json
{
  "recipient_name": "Nguyễn An",
  "phone": "0900000000",
  "province": "TP Hồ Chí Minh",
  "district": "Quận 1",
  "ward": "Phường Bến Nghé",
  "detail_address": "12 Nguyễn Huệ",
  "is_default": true
}
```

Không gửi `address_id`, `user_id`, timestamp hoặc field UI khác trong request. Backend tự gán ID/user/timestamp. Các route detail/update/delete/set-default có handler runtime và được ghi `AVAILABLE` trong readiness matrix; cần test DB/host theo môi trường triển khai trước khi tuyên bố production smoke hoàn tất.

## 5. Cart

### Add

`POST /cart/items`, body:

```json
{ "variant_id": "uuid", "quantity": 1 }
```

### Update quantity hoặc selection

`PATCH /cart/items/:cart_item_id`, body có ít nhất một field:

```json
{ "quantity": 2, "is_selected": true }
```

### Delete

- `DELETE /cart/items/:cart_item_id` → `204`.
- `DELETE /cart/selected` xóa item đang `is_selected=true` trong cart của buyer hiện tại.

## 6. Voucher

### List

`GET /vouchers` hoặc `/vouchers/applicable` với query `scope`, `shop_id`, `now`.

Response `200`: `data` là mảng `VoucherRuntimeDTO` camelCase (xem [04-data-model.md](04-data-model.md)); đây là domain object runtime, không phải DTO snake_case. Các field gồm `voucherId`, `code`, `voucherName`, `scope`, `shopId`, `discountType`, `discountValue`, `maxDiscount`, `minOrderValue`, `quantity`, `startAt`, `endAt`, `status`, `createdAt`, `updatedAt`.

### Evaluate

`POST /vouchers/evaluate`:

```json
{
  "code": "SALE10",
  "order_subtotal": "500000.00",
  "shop_id": "uuid"
}
```

Không gửi `items` hoặc `voucher_code`.

Response `200` tại runtime hiện tại là kết quả union của `VoucherPortService`; nó **không** chứa object `voucher` lồng bên trong:

```json
{
  "data": {
    "isValid": true,
    "voucherId": "uuid",
    "discountAmount": "50000.00"
  },
  "request_id": "req_..."
}
```

Khi không áp dụng được, service trả `data: { "isValid": false, "errorCode": "VOUCHER_NOT_APPLICABLE", "errorMessage": "..." }`. FE cần xử lý hai nhánh; để render chi tiết ưu đãi, lấy voucher từ list endpoint và ghép theo `voucherId` (hoặc `code` nếu cần), không trông chờ evaluate trả toàn bộ voucher. Các field trong cả hai nhánh là camelCase.

## 7. Checkout

`POST /checkout`, role `BUYER`.

Header bắt buộc:

```http
Idempotency-Key: 2d1aa6c1-53bf-4f20-8d5a-2ea01ee391f2
```

Body chỉ cho phép:

```json
{
  "address_id": "uuid",
  "payment_method": "ONLINE",
  "vouchers": [{ "shop_id": "uuid", "code": "SALE10" }]
}
```

Quy tắc:

- `payment_method`: `COD | ONLINE`.
- Mỗi shop tối đa một voucher.
- Backend lấy cart item `is_selected=true`.
- Backend hiện hardcode `shipping_fee = "0.00"`; client không được truyền phí ship. UI hiển thị phí vận chuyển `0₫`/miễn phí và không cộng phí mock vào tổng. Tổng hiện tại là `subtotal - discount_amount`; tổng cuối cùng phải lấy từ response `total_amount`.
- Cùng idempotency key + cùng payload trả lại kết quả cũ.
- Cùng key + payload khác trả `IDEMPOTENCY_KEY_REUSED`.
- Backend giữ kết quả idempotency 24 giờ theo user + endpoint + key; fingerprint hiện gồm `address_id`, `payment_method`, `vouchers`.

### Vòng đời `Idempotency-Key` ở FE

1. Khi người dùng bắt đầu một checkout intent, sinh UUID mới và gắn với snapshot request (địa chỉ, phương thức thanh toán, voucher) cho đến khi nhận kết quả chắc chắn.
2. Nếu timeout/mất mạng khiến không biết server đã commit chưa, retry đúng snapshot request với **cùng key** để nhận lại kết quả hoặc tiếp tục xử lý idempotently. Không sinh key mới chỉ vì response bị mất.
3. Nếu người dùng muốn thay đổi địa chỉ, phương thức thanh toán hoặc voucher, tạo **key UUID mới** cho payload mới. Không tái sử dụng key đã gắn với payload khác.
4. Nếu kết quả vẫn mơ hồ, trước tiên retry snapshot cũ với key cũ để xác định checkout trước đã thành công chưa; không đổi payload rồi gửi key mới ngay vì có thể tạo đơn trùng.
5. Sau response thành công, đánh dấu intent hoàn tất; checkout mới có chủ đích phải có key mới.

FE nên lưu key và snapshot bền vững (ví dụ session storage) qua reload để khôi phục retry. Backend fingerprint không bao gồm cart selection hiện tại; FE cần resolve một lần submit mơ hồ trước khi cho đổi selection và bắt đầu intent khác.

Response `201`:

```json
{
  "data": {
    "orders": [
      {
        "order_id": "uuid",
        "shop_id": "uuid",
        "status": "PENDING_CONFIRMATION",
        "total_amount": "475000.00",
        "payment_id": "uuid"
      }
    ]
  },
  "request_id": "req_..."
}
```

## 8. Order mutations

### Cancel

`POST /orders/:order_id/cancel`:

```json
{ "reason": "Tôi đặt nhầm sản phẩm" }
```

Buyer runtime chỉ hủy được khi order còn `PENDING_CONFIRMATION`.

### Confirm

`POST /orders/:order_id/confirm`, Seller/Admin. Body có thể có `reason`, nhưng runtime legacy service hiện không sử dụng reason khi confirm.

### Transition

`POST /orders/:order_id/transition`:

| Từ trạng thái | `to` | Actor qua HTTP | Điều kiện thêm |
|---|---|---|---|
| `PENDING_CONFIRMATION` | `CONFIRMED` | Seller qua `/confirm`, hoặc Admin qua transition | Seller dùng `/confirm` để xác nhận |
| `CONFIRMED` | `PREPARING` | Seller/Admin | Không được nhảy thẳng sang `SHIPPING` |
| `PREPARING` | `SHIPPING` | Seller/Admin | `shipment_status` là `HANDED_OVER` hoặc `SHIPPING` |
| `SHIPPING` | `COMPLETED` | **Admin qua HTTP** | `shipment_status: "DELIVERED"`; Seller bị cấm hoàn tất |
| `SHIPPING` | `DELIVERY_FAILED` | **Admin qua HTTP** | `shipment_status: "FAILED"`, `reason` bắt buộc; Seller bị cấm |
| Trạng thái còn cho phép | `CANCELLED` | Theo quyền và điều kiện state machine | `reason` bắt buộc; hủy ở `PREPARING` cần `exceptional_cancellation: true` |

`SHIPMENT_INTEGRATION` được state machine domain cho phép chuyển giao hàng sang kết quả cuối, nhưng router HTTP hiện chỉ cho role Seller/Admin. FE không thể gọi route với actor integration.

Các bước Seller phải đi tuần tự. Sau khi `/confirm`, đơn ở `CONFIRMED`; Seller gọi:

```json
{ "to": "PREPARING" }
```

Sau khi đóng gói, từ `PREPARING`, Seller mới gọi:

```json
{
  "to": "SHIPPING",
  "reason": "Đã bàn giao đơn vị vận chuyển",
  "shipment_status": "HANDED_OVER"
}
```

Seller không được gửi `to: "COMPLETED"` hoặc `to: "DELIVERY_FAILED"`; Backend trả `403 RESOURCE_FORBIDDEN`. UI Seller không được có nút “Đã giao thành công/Hoàn thành đơn”. Admin chỉ được hoàn tất khi shipment status là `DELIVERED`.

Không dùng `to_status` hoặc `note`.

### Payment retry

`POST /orders/:order_id/payments`, response `201`.

```json
{ "payment_method": "ONLINE" }
```

Đây là retry sau payment failed và khi không còn payment pending; không phải API tạo QR/Momo/Card session.

## 9. Error codes FE phải xử lý

| Code | HTTP | Hành vi FE |
|---|---:|---|
| `AUTH_REQUIRED`, `AUTH_INVALID_TOKEN` | 401 | refresh một lần hoặc về login |
| `ROLE_REQUIRED`, `FORBIDDEN`, `RESOURCE_FORBIDDEN` | 403 | trang forbidden/toast phù hợp |
| `USER_LOCKED` | 403 | sign out và hiển thị trạng thái tài khoản |
| `RESOURCE_NOT_FOUND` | 404 | not-found/refresh list |
| `VALIDATION_FAILED` | 422 | map `details` vào field; giữ form |
| `REASON_REQUIRED` | 422 | map `details.field` vào ô `reason`; giữ form và không retry tự động |
| `INVALID_REQUEST` | 400 | báo request không hợp lệ |
| `INVENTORY_INSUFFICIENT` | 409 | refresh cart/stock |
| `ORDER_INVALID_TRANSITION`, `ORDER_CANCELLATION_NOT_ALLOWED` | 409 | refresh order và vô hiệu action |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | lỗi client; không submit lại mù quáng |
| `IDEMPOTENCY_KEY_REUSED`, `REQUEST_IN_PROGRESS` | 409 | giữ key/poll hoặc chờ user retry |
| `PAYMENT_STATE_INVALID`, `PAYMENT_ALREADY_COMPLETED` | 409 | refresh payment/order |
| `RATE_LIMIT_EXCEEDED` | 429 | tôn trọng retry information nếu có |
| `DEPENDENCY_UNAVAILABLE` | 503 | retry có backoff cho GET; mutation tùy idempotency |
| `INTERNAL_ERROR` | 500 | generic message + request_id |

FE phải có fallback cho error code mới: hiển thị message an toàn và request ID, không crash vì enum chưa biết.

## 10. MVP target endpoints và contract freeze

Các endpoint hiện chưa live chỉ được FE tiêu thụ sau khi OpenAPI, runtime route và integration test cùng pass:

| Endpoint | Owner | Quy tắc chính |
|---|---|---|
| `POST /auth/onboarding` | Người 1 | Seller first-time onboarding tạo Shop `PENDING`; Buyer đã hoàn tất profile chưa upgrade Seller trong MVP |
| `GET /seller/products` | Người 3 | Scope từ JWT/shop context, không nhận arbitrary `shop_id` |
| `PATCH /seller/products/:id/status` | Người 3 | Chỉ `ACTIVE ↔ INACTIVE`, owner + Shop ACTIVE |
| `POST /media/uploads/presign` | Người 3 | Trả `media_id`, URL sống 10 phút; JPEG/PNG/WebP, tối đa 5 MB |
| `POST /media/uploads/:media_id/finalize` | Người 3 | Kiểm magic bytes; owner/purpose; không tin Content-Type client |
| `DELETE /media/uploads/:media_id` | Người 3 | Chỉ xóa media chưa attached; không truyền object path trong URL |
| `POST /orders/:id/confirm-received` | Người 5 | Buyer owner; Order SHIPPING + Shipment tồn tại; atomically DELIVERED/COMPLETED |
| `GET /products/:id/reviews` | Người 4 | Cursor pagination; public review list và aggregate rating |
| `GET/PATCH /admin/categories` và status mutation | Người 3 | Tối đa hai cấp; chặn parent cycle; Admin only |
| `GET /health/readiness` | Người 1 | Commit/version, DB/Auth/Storage và capability state |

### 10.1. Inventory và cancellation

- Tồn kho bị trừ tại checkout trong transaction, variant được lock theo thứ tự ổn định và update có điều kiện `stock_quantity >= quantity`.
- Buyer chỉ hủy `PENDING_CONFIRMATION`; Seller/Admin hủy `PENDING_CONFIRMATION|CONFIRMED|PREPARING`; mọi hủy cần reason và hoàn tồn đúng một lần.
- Không hủy từ `SHIPPING`; `DELIVERY_FAILED` không tự hoàn tồn trong MVP.

### 10.2. Idempotency

- Scope `user_id + endpoint + key`, TTL 24 giờ.
- Cùng key/cùng fingerprint replay response đầu tiên; cùng key/khác payload trả `409 IDEMPOTENCY_KEY_REUSED`; request đang chạy trả `409 REQUEST_IN_PROGRESS`.

### 10.3. Error envelope

Mọi 4xx/5xx, kể cả 404 và 429, phải dùng ErrorEnvelope có `meta.request_id`. FE hiển thị request ID ở error detail và không crash với error code chưa biết.

Payment provider, realtime notification, audit viewer và seller/admin analytics không thuộc MVP freeze này.
