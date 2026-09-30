# 07. Gap analysis và integration readiness

> **Phiên bản:** 1.4.0
>
> **Trạng thái:** MVP CONTRACT FREEZE; EXECUTION/READINESS TRACKED IN FILE 08 (updated 2026-09-30)

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
- **Hiện trạng:** `GET/PATCH /profile` đã mount; chỉ sửa họ tên/số điện thoại; email/role không sửa qua PATCH. Avatar dùng endpoint riêng `PATCH /profile/avatar` với `media_id` đã finalize; FE upload thật và avatar còn sau reload trong E2E Supabase test.
- **Còn lại:** backend-host smoke (`/health/readiness` đang trả 404) và bổ sung API rate limit evidence.

### GAP-08 — Admin read APIs và moderation scope

- **Severity:** HIGH cho Admin UI/release.
- **Hiện trạng:** Admin users/shops list và lock/approve actions cùng category CRUD/status routes đã có; frontend Admin UI/RBAC acceptance còn mở theo plan. Log viewer và product/review moderation nâng cao chưa có; một số list/action còn cần pagination, protected target và atomic audit evidence.
- **Còn lại:** hoàn thiện Admin UI/RBAC E2E và các hardening items còn mở trong C-401–C-406.

### GAP-09 — Media upload

- **Severity:** HIGH.
- **Hiện trạng:** Product và avatar có presign/upload/finalize/attach qua Supabase Storage với lifecycle/cleanup và policy. Review image chưa được hỗ trợ runtime: purpose `REVIEW` bị reject; live UI không hiển thị upload giả.
- **Còn lại:** nối Review media vào lifecycle/authorization contract; generated FE OpenAPI types đã có nhưng chưa chuyển hết các wire DTO viết tay.

### GAP-10 — Notification completeness

- **Severity:** MEDIUM.
- **Hiện trạng:** REST list/read runtime và FE đã nối; authenticated Buyer E2E trên Supabase test xác nhận mark-read còn sau reload. Không có mark-all-read endpoint hoặc realtime transport.
- **Còn lại:** backend-host smoke; bulk tiếp tục gọi read từng item có giới hạn, không giả định bulk endpoint. Realtime là phase riêng nếu có yêu cầu.

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
| Review submit/read | `READY/PARTIAL_MEDIA` | Text/rating + review API; image preview is not a real upload | C-201–C-206; implement REVIEW media lifecycle |
| Notifications | `READY` | Live list/read UI/API; Buyer E2E mark-read survives reload on Supabase test | Host smoke; realtime is not implemented |
| Profile | `READY/PARTIAL_RELEASE` | Live GET/PATCH and avatar upload/attach; avatar survives reload on Supabase test | Backend-host smoke and API rate limit evidence |
| Seller create product | `READY/PARTIAL_RELEASE` | Live form/API and real Storage image upload; Seller E2E passed on Supabase test | Host/release verification; Shop must be ACTIVE |
| Seller fulfillment | `READY/PARTIAL_SHIPMENT` | Live order query/actions | C-101–C-107 timeline/shipment/confirm-received |
| Seller KPI | `BLOCKED` | mock | GAP-12 |
| Admin users/shops | `AVAILABLE/PARTIAL_HARDENING` | Nối API thật | C-401/C-402 pagination, side effects, atomic audit |
| Admin categories | `UI_READY/BLOCKED_RUNTIME` | Tree/form UI, production mutation off | C-403/C-405 Admin CRUD/status |

## 4. Quyết định sản phẩm/API đã khóa

1. COD là payment production MVP; online provider không chặn release.
2. Media dùng backend presign/finalize theo `media_id`, magic-byte validation và Supabase Storage policy.
3. Admin MVP gồm users, shops, categories và atomic audit write; audit viewer/product-review moderation/KPI nằm backlog.
4. Seller MVP gồm onboarding Shop PENDING, approve, create product có media, stock và ACTIVE↔INACTIVE.

## 5. Hướng triển khai FE theo runtime hiện có

- Dùng API thật cho categories, profile, addresses, enriched cart, orders, checkout, vouchers và các catalog endpoints hiện có.
- Không dùng client cart prices để tính checkout; backend đọc lại giá/tồn kho trong transaction.
- Review/notification giữ `BLOCKED` trong production cho tới khi runtime services/integration tests pass; development fake boundary phải có badge demo.
- Seller product/media/Admin category là target contract trong file 05/08; Admin users/shops reads đã có và phải chuyển sang API thật.
- Không dùng `/buyers/addresses`, `/buyers/profile` hoặc FE DTO hiện có nếu chưa sửa theo `06-fe-be-mapping.md`.
- Google/OTP/recovery cần cấu hình dashboard tương ứng; Gmail SMTP mặc định phù hợp demo, cần chuyển email provider và rà rate limits trước production.

Cho tới khi các quyết định trên được chốt, FE phải giữ repository boundary và feature flags để tránh khóa kiến trúc vào mock.

## 6. Quyết định đóng gap ngày 30/09/2026

Các câu hỏi ở mục 4 đã được chốt cho MVP:

- Online payment không chặn MVP; COD là luồng production.
- Media dùng backend presign/finalize theo `media_id`, Storage policy của Supabase và magic-byte validation.
- Seller onboarding dùng `/auth/onboarding`, tạo Shop `PENDING`; Admin approve trước mutation.
- Buyer `confirm-received` là đường MVP đưa Order `SHIPPING → COMPLETED`; thiếu Shipment trả conflict, không tự tạo.
- Review runtime phải có cả create, public list và rating aggregate.
- Notification runtime phải phát event cho order lifecycle, confirm-received và moderation.
- Admin MVP gồm users, shops, categories và atomic audit writes. Audit viewer, product/review moderation và KPI được hoãn.
- Production readiness dùng build manifest + `/health/readiness`; không silent mock fallback.

Gap còn lại và owner/acceptance cụ thể nằm trong [08-implementation-plan.md](./08-implementation-plan.md); nội dung readiness cũ phía trên chỉ dùng làm lịch sử audit nếu mâu thuẫn với section này.
