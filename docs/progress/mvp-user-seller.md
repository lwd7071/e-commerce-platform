# MVP User/Seller implementation log

> Nhật ký triển khai Seller theo cùng format với [MVP User/Buyer](./mvp-user-buyer.md). `DONE` cần có test/evidence cụ thể; Approved CR cho phép triển khai nhưng không đồng nghĩa đã nghiệm thu toàn bộ Seller.

## Required reading / nguồn chuẩn

Đã đối chiếu trước và trong implementation theo thứ tự ưu tiên:

1. [Approved Change Requests](../spec/changes/) và [Schema Freeze v1](../spec/schema-freeze-v1.md) — Schema Freeze không bị chỉnh sửa.
2. [Architecture Rules index](../architecture/rules/README.md) và [Business Rules](../architecture/rules/business-rules.md) — QD04–06, QD08, QD11, QD13, QD16, QD19; RB-LB02/06/11; RB-LQH07/08.
3. [Auth/RBAC/RLS](../architecture/rules/auth-rbac-rls.md) — Seller identity, Shop ownership và `ACTIVE` business guard.
4. [Order Workflow](../architecture/rules/order-workflow-transactions.md) — state machine, shipment handover, voucher và cancel.
5. [API Conventions](../architecture/rules/api-conventions.md), [DB Schema Rules](../architecture/rules/db-schema-rules.md), [Error Catalog](../architecture/rules/error-observability.md), [Testing Quality Gates](../architecture/rules/testing-quality-gates.md).
6. [Role Business Rules](../architecture/role-business-rules.md), [Frontend Spec](../frontend-spec/README.md), `frontend/AGENTS.md`, TDD và UI/UX Pro Max skills.
7. [CR-SELLER-01](../spec/changes/CR-SELLER-01-full-seller-operations.md) — **Approved trực tiếp bởi Chủ dự án ngày 2026-10-01**. Đây là thay đổi đã duyệt để implementation; không tự suy diễn thêm quyền Seller hoặc thay đổi Schema Freeze.

## Trạng thái hiện tại — 2026-10-01

- Phạm vi: MVP Seller operations, Backend + Frontend.
- Cập nhật lần cuối: 2026-10-01.
- Đang làm: hoàn thiện/đối chiếu acceptance còn mở; code implementation đã được push trong commit `cf2003b` (`feat(seller): complete seller operations`) lên `origin/dev`.
- Bị block bởi: PostgreSQL từ xa chập chờn trong lần rerun catalog variant add/remove; lần gần nhất gặp `ETIMEDOUT` tại truy vấn Seller product detail sau update. Test giữ variant có lịch sử đã pass. Cần chạy lại add/remove khi DB reachable.
- Trạng thái tổng: **IN_PROGRESS** — các capability chính đã có code và gate FE xanh; còn ảnh Product update, media logo tùy chọn, focused Seller UI behavior tests, full browser E2E và backend full Vitest completion.

## Work tracker

| ID | Mảng | Trạng thái | Đầu ra/code chính | Kiểm tra/evidence | Còn lại |
|---|---|---|---|---|---|
| SELLER-00 | Change control / architecture | DONE | CR-SELLER-01 ghi quyết định, acceptance và owner approval. Rules đồng bộ tại `docs/architecture/role-business-rules.md`, `rules/auth-rbac-rls.md`, `rules/business-rules.md`, `rules/error-observability.md`. | Owner đã duyệt trực tiếp ngày 2026-10-01; CR được commit/push cùng implementation. `schema-freeze-v1.md` không đổi. | Review consistency sau khi đóng các hạng mục còn lại. |
| SELLER-01 | Shop profile / approval | IMPLEMENTED | Backend `GET/PATCH /seller/shop` scope theo authenticated owner; PENDING/ACTIVE có thể cập nhật hồ sơ Shop; trạng thái bị khóa chỉ đọc. Admin approve kiểm tra pickup address + contact phone nguyên tử trước status/audit. FE `/seller/shop`; không dùng Buyer `/addresses` làm địa chỉ lấy hàng. | Focused REST + PostgreSQL Shop completion/atomic approval pass đã ghi trong CR; backend typecheck/lint/build và FE checks pass. | Thêm/ghi rõ focused UI user-action tests cho PENDING/ACTIVE/locked và lỗi lưu nếu cần acceptance UI đầy đủ. |
| SELLER-02 | Seller dashboard / KPI | IMPLEMENTED | `/seller/kpi` và reporting module dùng Shop trong request context; dashboard loại bỏ Shop ID mẫu, admin repository và public catalog thấp tồn; trạng thái loading/empty/error. | Focused Seller REST tests; full FE tests, typecheck/lint/build pass. | Thêm UI behavior test KPI và kiểm chứng runtime E2E sau khi flow Seller tổng thể hoàn chỉnh. |
| SELLER-03 | Seller catalog / product lifecycle | IMPLEMENTED, DB RERUN NEEDED | Backend seller list cursor/filter, private detail kể cả Product INACTIVE, edit Product + variants; stock/status command riêng; `HIDDEN` không được Seller tự bật. SKU scope theo Shop, giá dương; biến thể bỏ khỏi form được xóa nếu chưa có Order, giữ `INACTIVE` nếu đã có Order. FE `/seller/products`, `/seller/products/[id]/edit`. | Backend focused REST product detail/edit tests pass. PostgreSQL giữ variant có Order pass; add/remove không có history đã pass ở lần trước, nhưng rerun gần nhất rớt `ETIMEDOUT` ở detail read sau update. | Khi DB ổn định chạy lại cả hai DB tests; thêm focused FE edit/add/remove user-action test. |
| SELLER-04 | Product categories / media | PARTIAL | Tạo Product dùng category API thật, không fallback fixture trong live; upload/finalize media và create API chỉ chấp nhận media đã finalize, không nhận preset/arbitrary URL; form giữ dữ liệu nếu lỗi. | FE `category-adapter-live`/product create tests nằm trong full FE Vitest 274/274; PostgreSQL catalog media acceptance có suite hiện hành. | Chưa có sửa/thay/gỡ Product images khi edit. Media logo `SHOP_LOGO` là optional trong CR và chưa triển khai. |
| SELLER-05 | Seller orders / fulfillment | IMPLEMENTED | Order list phân trang theo `status/limit/cursor`; detail trả history timeline; scope theo Shop; FE xem timeline/load-more và reload sau HTTP 409. Seller transitions tuân state machine, bàn giao yêu cầu bằng chứng shipment. | Focused Seller order REST tests; PostgreSQL order pagination/history và checkout/order integrations đã pass riêng; full FE tests pass. | Chưa chạy browser E2E end-to-end Seller fulfillment. Không cho Seller tự xác nhận `COMPLETED`/`DELIVERY_FAILED`. |
| SELLER-06 | Seller notifications | IMPLEMENTED | Seller đọc/mark-read notification cá nhân theo `recipient_id=context.user_id`, không phụ thuộc Shop ACTIVE; Seller navigation và notification screen được mở. Event writes cho lifecycle order được nối runtime. | Focused notification REST/runtime tests và navigation tests; full FE test suite pass. | Xác minh event lifecycle trong luồng browser E2E. |
| SELLER-07 | Shop vouchers | IMPLEMENTED | Seller voucher GET/POST/PATCH/status endpoints; backend tự gắn Shop; code normalized/unique, validation điều kiện; voucher có usage không đổi điều kiện, chỉ deactivate. FE `/seller/vouchers`. | Focused REST + PostgreSQL voucher ownership/used-voucher tests pass; FE full suite pass. | Bổ sung UI behavior tests; checkout concurrency/effect trong E2E Seller/Buyer. |
| SELLER-08 | Revenue reporting | IMPLEMENTED | `/seller/reports/revenue?from&to`, scope Shop context, chỉ Order `COMPLETED` theo QD19; FE `/seller/reports` date filters và Seller repository riêng. | PostgreSQL report integration pass cho Shop scope/date/QD19; FE full suite pass. | Bổ sung UI behavior test và verify report update trong full flow. |
| SELLER-09 | OpenAPI / wiring | DONE FOR CURRENT CONTRACT | Endpoint contracts được wire trong `app.ts`, OpenAPI spec và generated FE API types/adapters. | `frontend npm run api:types:check` — PASS, generated types khớp backend OpenAPI. | Chạy lại generator/check khi contract thay đổi tiếp theo. |
| SELLER-10 | Acceptance / quality | IN_PROGRESS | REST/PostgreSQL test seams và FE user action seam theo kế hoạch TDD; architecture/SOLID boundaries tách route/service/repository theo domain. | Backend `npm run test:node` — 641/641 pass ở lượt đã ghi trước đó; focused Seller REST — 43 pass ở lượt trước. Backend typecheck/lint/build — pass. Frontend `npm test` — 48 files / 274 tests pass; typecheck/lint/build — pass. OpenAPI drift — pass; `git diff --check` — pass. | Full backend Vitest chưa pass toàn suite (lượt full trước bị dừng sau mismatch assertion; assertion đã sửa). Catalog rerun bị ETIMEDOUT. Chưa có full browser Seller E2E. |

## Nhật ký theo ngày

### 2026-10-01 — CR-SELLER-01 / Seller operations

- Đã làm:
  - Thêm self-service Shop và kiểm tra điều kiện Admin duyệt; tách Shop pickup address khỏi Buyer delivery address.
  - Nối Seller dashboard KPI, catalog pagination/private detail/edit, order pagination/history, notification, voucher management và revenue report giữa backend runtime/API/OpenAPI với FE.
  - Thêm flow tạo/sửa/thay variant có bảo toàn lịch sử Order; ảnh tạo Product yêu cầu media upload/finalize thật.
  - Cập nhật architecture rules và CR traceability; commit `cf2003b` đã push lên `origin/dev`.
- Quyết định kỹ thuật:
  - Scope Seller lấy từ request identity và Shop ownership phía server; không tin `shop_id` client.
  - Stock tách khỏi Product edit; variant có lịch sử Order chỉ soft-deactivate. Product moderation `HIDDEN` không thể tự re-activate.
  - Report chỉ cộng Order `COMPLETED` theo QD19; Shop logo vẫn optional, ảnh Product update để lại hạng mục mở.
- Contract/port thay đổi:
  - CR-SELLER-01 — Seller Shop/catalog/order/notification/voucher/KPI/report operations — **Approved** bởi Chủ dự án 2026-10-01 — triển khai; API/OpenAPI/FE types cập nhật.
- Test đã viết/chạy:
  - REST tests cho Shop/KPI/Voucher/Report/notification/product/orders/moderation — 43 focused tests pass trong lượt trước.
  - PostgreSQL Shop, Voucher, reporting, order, checkout suite được chạy riêng và pass như log CR.
  - Catalog add/remove variant test từng pass ở lượt trước; rerun cuối chỉ hai variant tests có một test xanh (ordered variant retained) và một test lỗi `ETIMEDOUT` trong PostgreSQL remote detail read. Không quy lỗi này thành test assertion pass; cần rerun.
  - Frontend Vitest — 48 files / 274 tests pass; typecheck, lint, build pass. Backend typecheck, lint, build pass. API types generation/check và `git diff --check` pass.
- Blocker phát sinh:
  - PostgreSQL test connection timeout đến remote endpoints khi query sau update — cần DB reachable để xác nhận lại variant add/remove — 2026-10-01.
- Còn lại:
  - Sửa/thay/gỡ ảnh Product trong edit.
  - Chọn có cần triển khai SHOP_LOGO theo yêu cầu sản phẩm (optional).
  - Thêm focused Seller UI user-action tests cho Shop/Product/Orders/Vouchers/Reports.
  - Chạy lại catalog PostgreSQL variant test; hoàn tất backend full Vitest; chạy browser E2E onboarding → Shop approval → Product → Buyer checkout → Seller fulfill → Buyer confirm → report.

## Tài liệu/rules áp dụng

- [CR-SELLER-01](../spec/changes/CR-SELLER-01-full-seller-operations.md)
- [Role Business Rules](../architecture/role-business-rules.md)
- [Business Rules](../architecture/rules/business-rules.md)
- [Auth/RBAC/RLS](../architecture/rules/auth-rbac-rls.md)
- [Order Workflow](../architecture/rules/order-workflow-transactions.md)
- [API Conventions](../architecture/rules/api-conventions.md)
- [DB Schema Rules](../architecture/rules/db-schema-rules.md)
- [Error Catalog](../architecture/rules/error-observability.md)
- [Testing Quality Gates](../architecture/rules/testing-quality-gates.md)

## Quy tắc ghi nhận tiến độ

- Capability chỉ ghi `DONE` khi acceptance tương ứng có test và evidence pass; `IMPLEMENTED` nghĩa là có code nhưng chưa đóng đủ acceptance.
- Ghi lệnh/số lượng/kết quả đúng lượt chạy; timeout hoặc suite bị dừng không được tính là pass.
- Không suy diễn remote test pass thành production deployment hoặc full E2E pass.
- Không sửa Schema Freeze để hợp thức hóa implementation; thay đổi nghiệp vụ mới phải qua CR và approval.
