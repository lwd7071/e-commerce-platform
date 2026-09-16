# API Conventions

## 1. Phạm vi và base path

- REST API dùng base path `/api/v1`.
- Resource dùng danh từ số nhiều và `kebab-case`: `/products`, `/product-variants`, `/orders`.
- Không dùng động từ trong URL trừ command nghiệp vụ không biểu diễn được bằng CRUD, ví dụ `/orders/{id}/confirm`.
- ID trên path là UUID canonical dạng lowercase có dấu gạch nối.
- API không lộ tên bảng vật lý hoặc chi tiết Payload collection cho client.

## 2. Request

- Content type mặc định: `application/json; charset=utf-8`.
- Access token truyền bằng `Authorization: Bearer <jwt>`.
- Request tạo Order và retry Payment bắt buộc có `Idempotency-Key` từ 16-128 ký tự.
- Tên field JSON dùng `snake_case` để đồng nhất với API contract, không phụ thuộc tên PascalCase trong spec.
- Timestamp đầu vào phải là ISO 8601 có timezone; backend chuẩn hóa sang UTC.
- Tiền truyền dưới dạng decimal string, ví dụ `"289000.00"`; không dùng floating-point JSON.
- Field không được khai báo bị từ chối với `422 VALIDATION_FAILED`, trừ endpoint công bố rõ cơ chế forward-compatible.

## 3. Response envelope

### Thành công đơn lẻ

```json
{
  "data": {
    "id": "93f6d90c-82f4-4bad-a389-10e6f02788d2"
  },
  "request_id": "req_01J..."
}
```

### Danh sách phân trang

```json
{
  "data": [],
  "meta": {
    "next_cursor": null,
    "has_more": false,
    "limit": 20
  },
  "request_id": "req_01J..."
}
```

### Lỗi

```json
{
  "error": {
    "code": "ORDER_INVALID_TRANSITION",
    "message": "Không thể chuyển trạng thái đơn hàng.",
    "details": {
      "from": "COMPLETED",
      "to": "PREPARING"
    }
  },
  "request_id": "req_01J..."
}
```

- `message` an toàn để hiển thị; không chứa stack trace, SQL hoặc secret.
- `details` chỉ chứa dữ liệu giúp sửa request và có thể bỏ qua ở lỗi hệ thống.
- `request_id` phải giống ID trong structured log.

## 4. HTTP status

| Status | Dùng khi | Ví dụ |
|---|---|---|
| `200` | Đọc/cập nhật thành công | Lấy Order, cập nhật hồ sơ |
| `201` | Tạo resource thành công | Tạo Product, Order |
| `204` | Thành công không có body | Đánh dấu Notification đã đọc |
| `400` | JSON/query/path sai cú pháp | Cursor hỏng, JSON không parse được |
| `401` | Thiếu, hết hạn hoặc token không hợp lệ | Chưa đăng nhập |
| `403` | Đã xác thực nhưng thiếu role/ownership | Seller sửa Product của Shop khác |
| `404` | Resource không tồn tại hoặc cần che giấu sự tồn tại | Order không thuộc Buyer hiện tại |
| `409` | Xung đột trạng thái hoặc cạnh tranh dữ liệu | Hết tồn khi checkout, transition sai, idempotency conflict |
| `422` | Request đúng cú pháp nhưng vi phạm validation nghiệp vụ | Voucher hết hạn, rating ngoài 1-5 |
| `429` | Vượt rate limit | Spam login/checkout |
| `500` | Lỗi không dự kiến | Lỗi nội bộ đã che chi tiết |
| `503` | Dependency tạm thời không sẵn sàng | Supabase/Storage lỗi tạm thời |

## 5. Pagination, filter và sort

- Dùng cursor pagination cho danh sách có thể tăng lớn; không dùng page/offset cho Order, Product và log.
- Query chuẩn: `limit`, `cursor`, `sort`, cùng filter được whitelist theo endpoint.
- `limit` mặc định 20, tối đa 100.
- Sort format: `sort=created_at:desc`; chỉ field được công bố mới hợp lệ.
- Cursor là opaque string; client không được suy luận cấu trúc.
- Kết quả phải có thứ tự ổn định, thêm ID làm tie-breaker.

## 6. Idempotency

- Key được ràng buộc theo `user_id + endpoint + key`.
- Backend lưu fingerprint request và kết quả cuối trong thời hạn tối thiểu 24 giờ.
- Cùng key và cùng fingerprint trả lại kết quả cũ, không lặp side effect.
- Cùng key nhưng khác fingerprint trả `409 IDEMPOTENCY_KEY_REUSED`.
- Request đang xử lý đồng thời trả kết quả đã hoàn tất hoặc `409 REQUEST_IN_PROGRESS`; không chạy transaction lần hai.

## 7. Endpoint mẫu

| Use case | Method và path |
|---|---|
| Danh sách sản phẩm | `GET /api/v1/products` |
| Chi tiết sản phẩm | `GET /api/v1/products/{product_id}` |
| Giỏ hàng hiện tại | `GET /api/v1/cart` |
| Thêm dòng giỏ | `POST /api/v1/cart/items` |
| Tạo đơn từ checkout | `POST /api/v1/orders` |
| Buyer hủy đơn | `POST /api/v1/orders/{order_id}/cancel` |
| Seller xác nhận đơn | `POST /api/v1/orders/{order_id}/confirm` |
| Retry thanh toán | `POST /api/v1/orders/{order_id}/payments` |
| Tạo review | `POST /api/v1/order-items/{order_item_id}/review` |

Danh mục error code chuẩn nằm tại [`error-observability.md`](error-observability.md).
