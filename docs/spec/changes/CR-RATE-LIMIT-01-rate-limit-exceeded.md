# CR-RATE-LIMIT-01 — Bổ sung mã lỗi RATE_LIMIT_EXCEEDED vào Error Catalog

## Trạng thái

**Approved** — 2026-09-24. Đây là Change Request quy tắc kỹ thuật độc lập theo quy định tại `rules/README.md`, được phê duyệt trước khi triển khai code rate limiter mốc T3.

## Quyết định

- Bổ sung mã lỗi chính thức `RATE_LIMIT_EXCEEDED` với HTTP status `429` vào bảng "Validation và conflict chung" trong `docs/architecture/rules/error-observability.md §2`.
- Mã lỗi phục vụ middleware Layered Rate Limiting của Platform tại mốc T3, ngăn chặn các hành vi tấn công brute-force, DDoS, spam login/checkout theo đặc tả tại `api-conventions.md §4` ("429: Vượt rate limit: Spam login/checkout") và `error-observability.md §4` ("WARN: validation abuse, forbidden access").
- Định dạng response khi vi phạm rate limit tuân thủ nghiêm ngặt chuẩn Error Envelope:
  ```json
  {
    "error": {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Quá nhiều yêu cầu từ client. Vui lòng thử lại sau."
    },
    "request_id": "req_..."
  }
  ```
- Response kèm các headers điều hướng tiêu chuẩn: `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

## Review và phê duyệt

1. Người 1 (Platform Lead) đề xuất Change Request.
2. Người 2 (Database & Security Review) và Người 5 (Transaction Core Review) phê duyệt kỹ thuật theo cơ chế Change Governance.

Reviewer: Người 2, Người 5; ngày phê duyệt: 2026-09-24.

## Phạm vi implementation

- Cập nhật mục 2 file `docs/architecture/rules/error-observability.md`.
- Hiện thực hóa `RateLimitExceededError` trong `backend/src/platform/errors/app-error.ts`.
- Hiện thực hóa middleware `rate-limiter.ts` trong `backend/src/platform/http/middlewares/rate-limiter.ts`.
