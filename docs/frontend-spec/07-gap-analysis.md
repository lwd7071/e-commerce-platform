# 07. Gap analysis và integration readiness

> **Phiên bản:** 1.1.0  
> **Trạng thái:** MVP user/buyer runtime work in progress; provider smoke tests remain pending (updated 2026-09-29)

## 1. Cách đánh giá

Không dùng phần trăm cảm tính. Mỗi capability nhận một trạng thái dựa trên bằng chứng runtime:

- `READY`: có contract và runtime integration path hoạt động.
- `PARTIAL`: dùng được một phần nhưng thiếu data/behavior cho UI.
- `BLOCKED`: không thể hoàn tất production flow.

Phân biệt hoàn tất mốc backend với integration readiness FE: T3 hardening/quality gates hoàn tất theo [backend progress](../progress/README.md), nhưng chỉ các service được inject trong `createRuntimeApp()` mới được xem là live API. Router có thể trả 501 hoặc placeholder nếu dependency chưa được nối. Dùng `05-api-contract.md` làm bảng endpoint chi tiết.

## 2. Gaps ưu tiên

### GAP-01 — Order reads, review và notification runtime wiring

- **Severity:** BLOCKER.
- **Hiện trạng:** `OrderQueryService` và PostgreSQL repository đã được inject; buyer/seller/admin ownership query có integration test thật. Review và notification còn 501. Address item routes đã được nối và test HTTP/PostgreSQL.
- **Ảnh hưởng:** Order center và địa chỉ có thể đọc dữ liệu thật; review/notification chưa thể bật.
- **Còn lại:** wire review/notification services và kiểm tra OpenAPI schema cho order reads.
- **Đóng gap khi:** order query, address và các domain còn lại có runtime tests tương ứng; review/notification vẫn ghi riêng là ngoài phạm vi MVP Buyer.

### GAP-02 — Checkout/payment contract và provider

- **Severity:** BLOCKER cho online payment.
- **Hiện trạng:** checkout core hoạt động với `COD|ONLINE`, selected cart và Idempotency-Key; không có payment provider session/QR/webhook. Payment endpoint hiện là retry.
- **Giải pháp:** FE triển khai checkout core không QR. Nếu cần online payment thật, BE thiết kế create-session, callback/webhook, status polling và idempotency riêng.
- **Đóng gap khi:** payment contract có provider-agnostic response và E2E sandbox test.

### GAP-03 — Enriched cart response

- **Severity:** BLOCKER cho cart UI production.
- **Hiện trạng:** đã triển khai PostgreSQL join cho tên/variant/ảnh chính/giá hiện tại/shop/tồn kho và trạng thái khả dụng; item inactive/hết hàng vẫn có trong response.
- **FE:** adapter chuyển DTO sang view model, lỗi không fallback sang fixtures và checkout chỉ chọn item khả dụng.
- **Evidence:** integration test PostgreSQL cho ảnh null, decimal, inactive/out-of-stock và ownership; frontend test cho DTO mapping/error propagation.

### GAP-04 — Catalog detail/read models

- **Severity:** HIGH.
- **Hiện trạng:** product list thiếu rating/sold; detail thiếu images, shop metadata và reviews; `shop_id` filter không được hỗ trợ.
- **Giải pháp:** bổ sung detail read model, public reviews và seller-scoped product list riêng thay vì public `shop_id` tùy tiện.

### GAP-05 — Categories

- **Severity:** BLOCKER cho seller create/admin category; MEDIUM cho homepage.
- **Hiện trạng:** public `GET /categories` đã mount, chỉ trả ACTIVE categories theo danh sách phẳng roots-first; frontend adapter dùng API thật và cache kết quả.
- **Còn lại:** admin create/update/status với validation parent cycle và active status.
- **Fallback:** static config chỉ dùng development và chỉ chứa category UUID sau khi chạy [guarded dev/test seed](../architecture/backend-run-guide.md) trên đúng DB runtime. Không tự bịa/generate UUID: product filter so khớp trực tiếp `category_id` trong DB nên UUID không tồn tại trả mảng rỗng. Nếu chưa xác minh được seed trên đúng target thì ẩn filter.

### GAP-06 — Authentication onboarding

- **Severity:** BLOCKER cho registration.
- **Hiện trạng:** migration trigger provision `BUYER/ACTIVE`, onboarding transaction tạo profile hoặc shop `PENDING`, chống retry/trùng; code FE có signup OTP/Google callback/recovery flows.
- **Còn lại:** Supabase/Google provider, OTP/recovery templates, email SMTP và email/Google signup smoke thật chưa được cấu hình/xác minh. Chưa coi registration production-ready cho đến khi có evidence provider.

### GAP-07 — Profile API

- **Severity:** HIGH.
- **Hiện trạng:** `GET/PATCH /profile` đã mount; chỉ sửa họ tên/số điện thoại; email/role/avatar không được nhận trong PATCH. Frontend tải/lưu profile; upload avatar bị disabled.
- **Còn lại:** external smoke test và bổ sung API rate limit evidence.

### GAP-08 — Admin read APIs và moderation scope

- **Severity:** BLOCKER cho admin UI.
- **Hiện trạng (source audit 2026-09-29):** `POST /admin/users/:id/lock` and `/unlock` are mounted and wired to `ModerationService`; there are no user/log/shop/product list routes or shop/product moderation routes.
- **Giải pháp:** cursor pagination + filters; expose moderation actions có audit; không dùng client-supplied target type tùy ý.

### GAP-09 — Media upload

- **Severity:** HIGH.
- **Hiện trạng:** UI cần product/avatar/review images nhưng API chỉ nhận URL; chưa có presign/finalize contract.
- **Giải pháp:** định nghĩa bucket/path ownership, MIME/size/count, signed upload, finalize/cleanup và authorization.
- **Fallback:** URL text input chỉ cho development.

### GAP-10 — Notification completeness

- **Severity:** MEDIUM.
- **Hiện trạng:** runtime chưa wire; không có mark-all-read; không có realtime transport.
- **Giải pháp:** wire REST trước, thêm bulk read; realtime là phase riêng bằng Supabase Realtime/SSE/WebSocket sau khi có yêu cầu.

### GAP-11 — Error/OpenAPI drift

- **Severity:** HIGH.
- **Hiện trạng:** OpenAPI có kiểm thử hai chiều theo từng method với route Express đang mount; response DTO cụ thể vẫn cần được mở rộng khi endpoint được wire.
- **Giải pháp:** giữ kiểm thử method+path hai chiều trong CI; bổ sung response schemas cụ thể và contract fixtures khi backend hoàn thành từng gap.

### GAP-12 — Seller analytics

- **Severity:** MEDIUM.
- **Hiện trạng:** reporting domain tồn tại nhưng chưa có HTTP seller stats; order list runtime cũng chưa sẵn sàng.
- **Giải pháp:** sau GAP-01, quyết định FE aggregate cho dataset nhỏ hay endpoint `/seller/stats`; ưu tiên endpoint server-side.

## 3. Readiness matrix

| Capability | State | FE có thể làm ngay | Điều kiện production |
|---|---|---|---|
| FE foundation/design system | `READY` | Có | lint/typecheck/a11y |
| Login | `PARTIAL` | Email/password and Google OAuth source flow exists | Supabase provider config and live auth smoke tests |
| Registration | `PARTIAL` | Email OTP, onboarding and Google first-login completion are implemented in source | Trigger migration applied; provider/template/SMTP config and real signup smoke tests |
| Product list | `READY` | Có | adapter + loading/error |
| Product detail core | `PARTIAL` | Có | placeholder/ẩn unsupported UI |
| Categories | `READY` | Live API adapter | Runtime PostgreSQL integration test |
| Cart mutation/selection | `READY` | Có | integration test |
| Cart display | `READY` | Enriched live read model; unavailable rows remain visible | PostgreSQL and frontend adapter tests |
| Address list/create | `READY` | Có | integration test |
| Address edit/default/delete | `READY` | Owner-scoped APIs; checkout snapshot preserved | PostgreSQL integration and runtime route tests |
| Voucher | `READY` | Có | decimal handling |
| Checkout core | `READY` | Có sau cart selection | idempotency E2E |
| Online provider payment | `BLOCKED` | UI prototype | GAP-02 |
| Order center | `READY` for API | Live query service and DTO adapter | PostgreSQL runtime ownership tests; production order E2E |
| Cancel/confirm/transition/payment retry | `READY` for mutation only | có thể dùng contract thật với order ID hợp lệ | reads/order IDs cần GAP-01; payment provider vẫn GAP-02 |
| Review submit | `NOT_IMPLEMENTED` | UI text/rating bằng mock, production submit off | GAP-01; images còn GAP-09 |
| Notifications | `NOT_IMPLEMENTED` | UI mock/gated | GAP-01 và GAP-10; route hiện trả 501 |
| Profile | `PARTIAL` | Live GET/PATCH UI/API for name/phone | API rate limit evidence and live auth smoke |
| Seller create product | `PARTIAL` | form/URL images | GAP-05, GAP-09 |
| Seller fulfillment | `STUB` for list; mutation ready | mock queue; action handler có thật khi có order ID | GAP-01 order query/repository |
| Seller KPI | `BLOCKED` | mock | GAP-12 |
| Admin | `PARTIAL` | mock reads; có thể dựng isolated lock/unlock action | GAP-08 reads; mutation cần target ID |

## 4. Quyết định sản phẩm/API cần chốt cho phase tiếp theo

Các mục sau không làm milestone T3 chưa hoàn tất; đây là các capability hoặc quyết định ngoài phạm vi hardening hiện tại, cần chốt nếu muốn mở rộng FE production:

1. Online payment có nằm trong MVP không; provider nào và callback model gì?
2. Media upload dùng Supabase Storage trực tiếp hay backend presign?
3. Admin/seller management APIs nào sẽ thuộc phase kế tiếp?

## 5. Hướng triển khai FE theo runtime hiện có

- Dùng API thật cho categories, profile, addresses, enriched cart, orders, checkout, vouchers và các catalog endpoints hiện có.
- Không dùng client cart prices để tính checkout; backend đọc lại giá/tồn kho trong transaction.
- Không gọi review/notification writes/reads trong production; hiện trả 501. Làm UI độc lập bằng fixture, giữ submit gated.
- Seller product discovery, admin reads, seller stats và media routes vẫn chưa được mount.
- Không dùng `/buyers/addresses`, `/buyers/profile` hoặc FE DTO hiện có nếu chưa sửa theo `06-fe-be-mapping.md`.
- Google/OTP/recovery cần cấu hình dashboard tương ứng; Gmail SMTP mặc định phù hợp demo, cần chuyển email provider và rà rate limits trước production.

Cho tới khi các quyết định trên được chốt, FE phải giữ repository boundary và feature flags để tránh khóa kiến trúc vào mock.
