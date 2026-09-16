# Error Handling and Observability

## 1. Nguyên tắc

- Client chỉ nhận error envelope trong [`api-conventions.md`](api-conventions.md).
- Error code ổn định và dùng `UPPER_SNAKE_CASE`; message có thể dịch/thay đổi nhưng code không đổi tùy tiện.
- Không trả stack trace, SQL, tên constraint, filesystem path, token hoặc secret.
- Mọi response có `request_id`; cùng ID xuất hiện trong log và audit context.
- Domain error dự kiến không được log như lỗi hệ thống nếu request hoạt động đúng thiết kế.

## 2. Error catalog

### Authentication và authorization

| Code | HTTP | Ý nghĩa |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | Thiếu access token |
| `AUTH_INVALID_TOKEN` | 401 | Token hỏng, hết hạn, sai issuer/audience |
| `AUTH_CONFIGURATION_ERROR` | 500 | Cấu hình Auth phía server sai |
| `USER_LOCKED` | 403 | Tài khoản nghiệp vụ bị khóa |
| `RESOURCE_FORBIDDEN` | 403 | Thiếu role hoặc ownership |
| `RESOURCE_NOT_FOUND` | 404 | Không tồn tại hoặc được che giấu vì không thuộc quyền |

### Validation và conflict chung

| Code | HTTP | Ý nghĩa |
|---|---:|---|
| `INVALID_REQUEST` | 400 | JSON/query/path không parse được |
| `VALIDATION_FAILED` | 422 | Field không hợp lệ |
| `REASON_REQUIRED` | 422 | Thiếu lý do bắt buộc |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Thiếu key ở command bắt buộc |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Cùng key nhưng khác payload |
| `REQUEST_IN_PROGRESS` | 409 | Request cùng key đang xử lý |
| `RESOURCE_DELETE_NOT_ALLOWED` | 409 | Dữ liệu lịch sử chỉ được đổi trạng thái |

### Identity, Shop, Cart và catalog

| Code | HTTP | Ý nghĩa |
|---|---:|---|
| `USER_EMAIL_CONFLICT` | 409 | Email đã tồn tại |
| `SHOP_ALREADY_EXISTS` | 409 | User đã có Shop trong MVP |
| `CART_CONFLICT` | 409 | Xung đột Cart duy nhất |
| `CART_ITEM_CONFLICT` | 409 | Xung đột dòng Variant trong Cart |
| `DEFAULT_ADDRESS_CONFLICT` | 409 | Có hơn một default Address |
| `SKU_CONFLICT` | 409 | SKU trùng trong cùng Shop |
| `STOCK_INVALID` | 422 | Giá trị tồn kho không hợp lệ |

### Order, Voucher, Payment, Shipment và Review

| Code | HTTP | Ý nghĩa |
|---|---:|---|
| `INVENTORY_INSUFFICIENT` | 409 | Không đủ tồn tại thời điểm commit |
| `ORDER_SNAPSHOT_INVALID` | 500 | Snapshot nội bộ không đầy đủ/không nhất quán |
| `ORDER_TOTAL_INVALID` | 422 | Công thức hoặc miền tổng tiền không hợp lệ |
| `ORDER_INVALID_TRANSITION` | 409 | State transition không hợp lệ |
| `ORDER_CANCELLATION_NOT_ALLOWED` | 409 | Actor/trạng thái không cho phép hủy |
| `VOUCHER_NOT_APPLICABLE` | 422 | Voucher không đáp ứng điều kiện |
| `VOUCHER_CODE_CONFLICT` | 409 | Mã Voucher đã tồn tại |
| `VOUCHER_ALREADY_APPLIED` | 409 | Order đã có VoucherUsage |
| `VOUCHER_DISCOUNT_MISMATCH` | 500 | VoucherUsage và Order không khớp |
| `PAYMENT_AMOUNT_INVALID` | 422 | Amount không bằng TotalAmount hoặc không dương |
| `PAYMENT_STATE_INVALID` | 409 | Payment transition không hợp lệ |
| `PAYMENT_ALREADY_COMPLETED` | 409 | Order đã có Payment SUCCESS |
| `PAYMENT_DATA_NOT_ALLOWED` | 422 | Request chứa dữ liệu thẻ không được phép lưu |
| `SHIPMENT_ALREADY_EXISTS` | 409 | Order đã có Shipment |
| `REVIEW_NOT_ELIGIBLE` | 422 | Không đủ điều kiện đánh giá |
| `REVIEW_ALREADY_EXISTS` | 409 | OrderItem đã được đánh giá |

### Reporting, audit và dependency

| Code | HTTP | Ý nghĩa |
|---|---:|---|
| `REPORT_FILTER_INVALID` | 422 | Filter báo cáo không hợp lệ |
| `AUDIT_WRITE_FAILED` | 500 | Không thể commit audit cùng hành động Admin |
| `DEPENDENCY_UNAVAILABLE` | 503 | Auth/DB/Storage/provider tạm thời lỗi |
| `INTERNAL_ERROR` | 500 | Lỗi không dự kiến đã được che chi tiết |

## 3. Chuyển lỗi database

- Unique violation được ánh xạ theo constraint name sang domain conflict cụ thể.
- FK violation từ ID người dùng nhập được ánh xạ sang `RESOURCE_NOT_FOUND` hoặc domain validation phù hợp.
- CHECK violation được ánh xạ sang `VALIDATION_FAILED` hoặc error code chuyên biệt.
- Serialization/deadlock được retry giới hạn ở backend; hết retry trả `409` nếu là xung đột nghiệp vụ, nếu không trả `503`.
- Lỗi database không nhận diện được trả `INTERNAL_ERROR` và log stack ở server.

## 4. Structured logging

Log JSON tối thiểu có:

```json
{
  "timestamp": "2026-09-16T02:30:00.000Z",
  "level": "info",
  "service": "payload-api",
  "environment": "production",
  "request_id": "req_01J...",
  "method": "POST",
  "route": "/api/v1/orders",
  "status": 201,
  "duration_ms": 84,
  "user_id": "uuid",
  "role": "BUYER",
  "error_code": null
}
```

- Log route template, không log URL chứa dữ liệu nhạy cảm hoặc query tự do chưa lọc.
- `INFO`: request thành công, domain event quan trọng.
- `WARN`: validation abuse, forbidden access, domain conflict đáng theo dõi, retry dependency.
- `ERROR`: 5xx, transaction rollback bất thường, audit/storage cleanup thất bại.
- Không log toàn bộ request/response body mặc định.

## 5. Dữ liệu cấm log

- Access token, refresh token, Authorization/Cookie nguyên bản.
- Password, OTP, secret, API key, service-role key.
- PAN, CVV, thông tin thẻ hoặc payload payment provider nhạy cảm.
- Địa chỉ/số điện thoại/email đầy đủ nếu không cần thiết; mask khi phục vụ điều tra.
- Signed URL đầy đủ nếu chứa token.

Redaction phải chạy trước khi object được gửi tới logger, không chỉ ở giao diện xem log.

## 6. Audit log

Admin action quan trọng phải tạo `AdminLog` trong cùng transaction với thay đổi:

- Khóa/mở khóa User hoặc Shop.
- Ẩn/khôi phục Product hoặc Review.
- Can thiệp Order.
- Thay đổi Category/Voucher cấp nền tảng có ảnh hưởng rộng.
- Hành động toàn hệ thống.

Audit record gồm `admin_id`, action, target type/id, reason và created_at. Audit là append-only; API không hỗ trợ sửa/xóa. `ModerationRecord` mô tả quyết định kiểm duyệt domain; `AdminLog` ghi hành động truy vết, có thể cùng được tạo cho một command.

## 7. Metrics và cảnh báo tối thiểu

- Request count, latency p50/p95/p99 và error rate theo route/status/error code.
- Số transaction Order success/rollback.
- Số `INVENTORY_INSUFFICIENT`, `ORDER_INVALID_TRANSITION`, payment callback conflict.
- Dependency latency/error cho Supabase Auth, PostgreSQL và Storage.
- Alert khi 5xx tăng đột biến, audit write fail, payment callback mismatch hoặc database connection cạn.
- Metric label không chứa user_id/order_id để tránh cardinality cao.

## 8. Correlation và background work

- Nếu client gửi `X-Request-ID`, chỉ chấp nhận format hợp lệ; backend có thể sinh mới và luôn trả ID cuối cùng.
- Background job/event phải mang `correlation_id` từ request gốc và có `job_id` riêng.
- Retry log phải ghi attempt nhưng không nhân bản error alert cho cùng một failure đã biết.

## 9. Test bắt buộc

- Mọi error code trả đúng HTTP status và envelope.
- 5xx không lộ stack/SQL/secret.
- Log có request_id và redaction hoạt động với token, password, card-like data.
- Admin action rollback nếu không ghi được AdminLog.
- Duplicate/constraint violation được ánh xạ đúng domain code.
- Metrics không chứa ID có cardinality cao.
