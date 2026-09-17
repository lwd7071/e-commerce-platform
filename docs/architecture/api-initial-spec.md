# Tài liệu Đặc tả API Ban đầu (Initial API Spec) — Mốc T1

## 1. Tổng quan Kiến trúc REST API

- **Base URL:** `/api/v1` (tuân thủ nghiêm ngặt [api-conventions.md](rules/api-conventions.md) Mục 1).
- **Format trao đổi:** `application/json; charset=utf-8`.
- **Định danh tương quan (Correlation ID):** Mọi request và response đều mang `X-Request-ID` với format hợp lệ `^req_[a-zA-Z0-9_-]{4,60}$`.

---

## 2. Cấu trúc Response Envelope Chuẩn

### 2.1 Success Envelope (Single Resource)
```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-09-17T14:30:00.000Z"
  },
  "request_id": "req_01J8G2X9..."
}
```

### 2.2 Paginated Envelope (Collection Resource)
```json
{
  "data": [ ... ],
  "meta": {
    "next_cursor": "eyJpZCI6MTAwfQ==",
    "has_more": true,
    "limit": 20
  },
  "request_id": "req_01J8G2X9..."
}
```

### 2.3 Error Envelope
```json
{
  "error": {
    "code": "ERROR_CODE_NAME",
    "message": "Thông điệp mô tả lỗi thân thiện với client",
    "details": [ ... ]
  },
  "request_id": "req_01J8G2X9..."
}
```

---

## 3. Danh mục Endpoint Mốc T1

### 3.1 Health Check Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/health`
- **Auth:** Public (không yêu cầu Bearer token).
- **Response 200:**
  ```json
  {
    "data": {
      "status": "ok",
      "timestamp": "2026-09-17T21:30:00.000Z"
    },
    "request_id": "req_12345678"
  }
  ```

---

## 4. Danh mục Error Codes Chuẩn (T1 Platform)

| Mã Lỗi | HTTP Status | Ý nghĩa & Nguyên nhân |
|---|:---:|---|
| `AUTH_REQUIRED` | 401 | Thiếu header `Authorization` hoặc thiếu tiền tố `Bearer` |
| `AUTH_INVALID_TOKEN` | 401 | Token sai cú pháp, hết hạn hoặc không tìm thấy user tương ứng |
| `USER_LOCKED` | 403 | Tài khoản user bị khóa (`status = LOCKED`), chặn toàn bộ protected routes (QD03) |
| `INVALID_REQUEST` | 400 | Body request sai cú pháp JSON (Malformed JSON) hoặc request không hợp lệ |
| `VALIDATION_FAILED` | 422 | Dữ liệu không vượt qua kiểm tra miền giá trị DTO / Zod schema |
| `RESOURCE_NOT_FOUND` | 404 | Tài nguyên không tồn tại |
| `FORBIDDEN` | 403 | Truy cập bị cấm do vi phạm quyền hạn RBAC hoặc ownership |
| `CONFLICT` | 409 | Xung đột trạng thái tài nguyên hoặc trùng lặp dữ liệu |
| `INTERNAL_ERROR` | 500 | Lỗi hệ thống không dự kiến; che giấu 100% stack trace và database internals |
| `AUTH_CONFIGURATION_ERROR` | 500 | Lỗi cấu hình xác thực hệ thống khi triển khai production |

---

## 5. Danh mục Contracts Khóa tại T1

Toàn bộ các module downstream tiêu thụ qua single entrypoint `@/contracts`:
1. `RequestContext`: Chứa `request_id`, `user_id`, `role` (`BUYER | SELLER | ADMIN`), `shop_id` (chỉ dành cho SELLER). Bất biến qua `Object.freeze`.
2. `ICatalogPort`: Port khóa variant, đọc giá/tồn/status bàn giao cho Người 5.
3. `ICartPort`: Port lấy snapshot các dòng cart được chọn và đánh dấu đã checkout.
4. `IVoucherPort`: Port đánh giá và tiêu thụ voucher trong transaction.
5. `IAuditPort`: Port ghi nhận `AdminAuditRecord` cùng transaction.
