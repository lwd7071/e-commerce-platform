# 05. API contract FE–BE

> **Phiên bản:** 1.1.0  
> **Trạng thái:** CURRENT RUNTIME CONTRACT

## 1. Global conventions

- Base URL: `/api/v1`.
- Authenticated route dùng `Authorization: Bearer <supabase_access_token>`.
- JSON keys dùng snake_case.
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
  request_id: string;
};
```

Backend không trả field `success`.

## 2. Runtime readiness

| Domain | Endpoint | Role | Status | Ghi chú |
|---|---|---|---|---|
| System | `GET /health` | Public | `AVAILABLE` | Health check |
| System | `GET /openapi.json` | Public | `AVAILABLE` | OpenAPI hiện chưa mô tả đầy đủ catalog/admin |
| Catalog | `GET /products` | Public | `AVAILABLE` | Cursor pagination |
| Catalog | `GET /products/:product_id` | Public | `PARTIAL` | Thiếu images/shop/reviews/metrics |
| Catalog | `POST /products` | Seller | `AVAILABLE` | Chỉ nhận URL ảnh đã upload |
| Catalog | `PATCH /product-variants/:variant_id/stock` | Seller | `AVAILABLE` | Body `{ quantity }` |
| Address | `GET /addresses` | Buyer | `AVAILABLE` | Runtime legacy service |
| Address | `POST /addresses` | Buyer | `AVAILABLE` | Runtime legacy service |
| Address | detail/update/delete/default | Buyer | `RUNTIME_BLOCKED` | Service chưa được inject đầy đủ |
| Cart | `GET /cart` | Buyer | `PARTIAL` | Thiếu joined display data |
| Cart | add/update/delete item | Buyer | `AVAILABLE` | Update hỗ trợ `is_selected` |
| Cart | `DELETE /cart/selected` | Buyer | `RUNTIME_BLOCKED` | Runtime legacy path trả 204 nhưng không xóa |
| Voucher | list/evaluate | Buyer | `AVAILABLE` | Dùng `code`, `order_subtotal`, `shop_id` |
| Checkout | `POST /checkout` | Buyer | `AVAILABLE` | Bắt buộc Idempotency-Key |
| Orders | `GET /orders` | Buyer/Seller/Admin | `RUNTIME_BLOCKED` | Runtime trả `[]` vì chưa có orderRepo |
| Orders | `GET /orders/:id` | Buyer/Seller/Admin | `RUNTIME_BLOCKED` | Chưa trả detail thực |
| Orders | cancel/confirm/transition | Theo route | `AVAILABLE` | Payload xem bên dưới |
| Payment | `POST /orders/:id/payments` | Buyer | `PARTIAL` | Retry payment; không tạo QR/link |
| Review | `POST /order-items/:id/review` | Buyer | `RUNTIME_BLOCKED` | Runtime trả 501 |
| Notification | list/detail/read | Buyer | `RUNTIME_BLOCKED` | Runtime trả 501 |
| Admin | lock/unlock user | Admin | `AVAILABLE` | Reason bắt buộc theo nghiệp vụ |
| Profile/Categories/Admin reads | — | — | `MISSING` | Xem gap analysis |

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

## 4. Cart

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
- `DELETE /cart/selected` có semantics xóa item đang `is_selected=true`, nhưng chưa hoạt động trong runtime production hiện tại.

## 5. Voucher

### List

`GET /vouchers` hoặc `/vouchers/applicable` với query `scope`, `shop_id`, `now`.

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

## 6. Checkout

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
- Cùng idempotency key + cùng payload trả lại kết quả cũ.
- Cùng key + payload khác trả `IDEMPOTENCY_KEY_REUSED`.

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

## 7. Order mutations

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

```json
{
  "to": "SHIPPING",
  "reason": "Đã bàn giao đơn vị vận chuyển",
  "shipment_status": "HANDED_OVER",
  "exceptional_cancellation": false
}
```

Không dùng `to_status` hoặc `note`.

### Payment retry

`POST /orders/:order_id/payments`, response `201`.

```json
{ "payment_method": "ONLINE" }
```

Đây là retry sau payment failed và khi không còn payment pending; không phải API tạo QR/Momo/Card session.

## 8. Error codes FE phải xử lý

| Code | HTTP | Hành vi FE |
|---|---:|---|
| `AUTH_REQUIRED`, `AUTH_INVALID_TOKEN` | 401 | refresh một lần hoặc về login |
| `ROLE_REQUIRED`, `FORBIDDEN`, `RESOURCE_FORBIDDEN` | 403 | trang forbidden/toast phù hợp |
| `USER_LOCKED` | 403 | sign out và hiển thị trạng thái tài khoản |
| `RESOURCE_NOT_FOUND` | 404 | not-found/refresh list |
| `VALIDATION_FAILED` | 422 | map `details` vào field; giữ form |
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

## 9. Missing/target endpoints

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
