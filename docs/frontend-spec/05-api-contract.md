# 05. API contract FE–BE

> **Phiên bản:** 1.1.0  
> **Trạng thái:** CURRENT RUNTIME CONTRACT

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

### Căn cứ runtime (2026-09-29)

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
| Catalog | `POST /products` | Seller | `PARTIAL` | Runtime tạo sản phẩm/variants; chỉ nhận URL ảnh, không có media upload; không có category list runtime |
| Catalog | `PATCH /product-variants/:variant_id/stock` | Seller | `AVAILABLE` | Body `{ quantity }` |
| Catalog | `GET /categories` | Public | `AVAILABLE` | Chỉ category ACTIVE, danh sách phẳng, roots trước; dùng `PgCategoryRepository` |
| Catalog | `GET /shops/:id` | Public | `MISSING` | Chưa có route runtime |
| Catalog | `GET /seller/products` hoặc `GET /products?shop_id=...` | Seller | `MISSING` | Không có seller-scoped list; `shop_id` bị từ chối như query không hỗ trợ |
| Address | `GET /addresses` | Buyer | `AVAILABLE` | Runtime legacy service |
| Address | `POST /addresses` | Buyer | `AVAILABLE` | Runtime legacy service |
| Address | `GET/PATCH/DELETE /addresses/:address_id`, `PATCH .../default` | Buyer | `AVAILABLE` | Tất cả truy vấn scope theo JWT; đặt mặc định trong transaction; order giữ snapshot địa chỉ |
| Cart | `GET /cart` | Buyer | `AVAILABLE` | Join sản phẩm, variant, shop, ảnh chính và giá/tồn kho hiện tại; hàng inactive/hết kho vẫn trả với `is_available=false` |
| Cart | add/update/delete item | Buyer | `AVAILABLE` | Update hỗ trợ `is_selected` |
| Cart | `DELETE /cart/selected` | Buyer | `AVAILABLE` | Xóa item đang chọn trong cart của buyer; trả 204 |
| Voucher | list/evaluate | Buyer | `AVAILABLE` | Dùng `code`, `order_subtotal`, `shop_id` |
| Checkout | `POST /checkout` | Buyer | `AVAILABLE` | Bắt buộc Idempotency-Key |
| Orders | `GET /orders` | Buyer/Seller/Admin | `AVAILABLE` | `OrderQueryService` PostgreSQL read model, DTO có items; role và ownership được xác minh từ context |
| Orders | `GET /orders/:id` | Buyer/Seller/Admin | `AVAILABLE` | Cùng DTO với list; ngoài ownership và không tồn tại trả 404 |
| Orders | cancel/confirm/transition | Theo route | `AVAILABLE` | Được `PgCheckoutService` xử lý; chỉ dùng khi có order ID hợp lệ |
| Payment | `POST /orders/:id/payments` | Buyer | `AVAILABLE` | Chỉ retry payment; không tạo provider session, QR hoặc link |
| Review | `POST /order-items/:id/review`, `POST /reviews` | Buyer | `NOT_IMPLEMENTED` | Route trả 501 vì `ReviewService` không được inject trong runtime |
| Notification | list/detail/read | Buyer | `NOT_IMPLEMENTED` | Route trả 501 vì `NotificationService` không được inject trong runtime |
| Identity | `GET /auth/me`, `POST /auth/onboarding` | Authenticated | `AVAILABLE` | Role lấy từ `app_users`; onboarding Buyer/Seller chạy transaction; shop Seller ban đầu PENDING |
| Profile | `GET/PATCH /profile` | Authenticated | `AVAILABLE` | Chỉ sửa `full_name`, `phone`; email/role/avatar là read-only hoặc chưa hỗ trợ |
| Admin | `POST /admin/users/:id/lock`, `/unlock` | Admin | `AVAILABLE` | Mutation có moderation/audit; không có list users để cung cấp target ID |
| Admin | user/log/shop/product reads, shop/product moderation | Admin | `MISSING` | Chỉ user lock/unlock routes được mount |
| Seller | seller stats | Seller | `MISSING` | Không có HTTP stats route |
| Media | upload/presign/finalize | Authenticated | `MISSING` | `POST /products` chỉ nhận URL ảnh đã có |

Order reads, profile, categories, addresses và enriched cart hiện được nối vào runtime. Các capability còn thiếu gồm review, notifications, admin reads, media, seller product discovery/stats và online payment provider. Google OAuth, email OTP/recovery phụ thuộc cấu hình provider tại Supabase/Google Cloud; source code không chứa OAuth secret hoặc SMTP app password.

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

Không gửi `address_id`, `user_id`, timestamp hoặc field UI khác trong request. Backend tự gán ID/user/timestamp. `GET /addresses/:id`, `PATCH`, `DELETE` và set-default chưa sẵn sàng production; hiện trả 501 `NOT_IMPLEMENTED` theo ErrorEnvelope. Xem readiness matrix.

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

## 10. Missing/target endpoints

Các endpoint sau chưa phải contract hiện hành:

- `GET/POST/PATCH /categories`.
- `GET /products/:id/reviews`.
- `GET/PATCH /profile`.
- `GET /admin/users`, `GET /admin/logs`.
- Admin shop/product moderation routes.
- Seller stats và seller product list.
- Media upload/presign/finalize.
- Mark-all-notifications-read.
- Payment provider session/webhook.
