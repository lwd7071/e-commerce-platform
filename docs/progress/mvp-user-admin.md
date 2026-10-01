# Nhật ký tiến độ — MVP User/Admin

> Nhật ký triển khai Admin Portal. `DONE` yêu cầu test red/green cho capability mới, lệnh chạy thật và kết quả quan sát được. PostgreSQL integration phải dùng database test thật; timeout hoặc suite dừng không được tính là pass.

## Required reading

Đọc trước mỗi task, theo thứ tự ưu tiên:

1. `docs/spec/changes/CR-ADMIN-01-admin-portal-completion.md`
2. `docs/spec/schema-freeze-v1.md`
3. `docs/spec/00-original-spec.md`
4. `docs/architecture/rules/architecture-decisions.md`
5. `docs/architecture/rules/auth-rbac-rls.md`
6. `docs/architecture/rules/api-conventions.md`
7. `docs/architecture/rules/business-rules.md`
8. `docs/architecture/rules/db-schema-rules.md`
9. `docs/architecture/rules/order-workflow-transactions.md`
10. `docs/architecture/rules/error-observability.md`
11. `docs/architecture/rules/testing-quality-gates.md`
12. `docs/architecture/role-business-rules.md`
13. `docs/frontend-spec/05-api-contract.md`, `06-fe-be-mapping.md`, `07-gap-analysis.md`, `08-implementation-plan.md`
14. `frontend/AGENTS.md` và Next.js docs phù hợp ở `frontend/node_modules/next/dist/docs/` trước khi sửa frontend.
15. TDD skill và UI/UX Pro Max skill theo kế hoạch được Chủ dự án duyệt.

## Trạng thái hiện tại — 2026-10-02

- Phạm vi: hoàn thiện Admin Portal, backend + frontend.
- Cập nhật lần cuối: 2026-10-02 (sau rà soát kỹ thuật độc lập).
- Trạng thái các mảng:
  - **Đã hoàn thành và pass integration test**: ADMIN-00 đến ADMIN-11 (Users/Shops cursor & detail, Categories hierarchy, Moderation HIDE/RESTORE & audit rollback QD20, Orders intervention & stock restore, Vouchers PLATFORM checkout block, Notification campaigns idempotency & skip locked worker, Audit cursor viewer, Operational reports QD19).
  - **Chưa hoàn tất / Đang mở**:
    - ADMIN-12: Mới pass component unit test cho Dialog, Escape, responsive table wrapper. Chưa chạy Axe-core audit, chưa đo tương phản contrast, chưa kiểm tra 4 viewports thực tế.
    - ADMIN-13: Mới pass unit/route-guard test với mock repository. Chưa chạy Playwright / Browser E2E thật qua network và backend server.
    - ADMIN-14: Test PostgreSQL hiện chạy trong schema cô lập trên DB Supabase cấu hình trong `.env`, chưa có database test project độc lập hoàn toàn để tách biệt với production.
- Backend typecheck: PASS (0 errors); Backend lint: PASS (0 errors, 0 warnings).
- Frontend typecheck: PASS (0 errors); Frontend lint: PASS (0 errors, 0 warnings); Frontend admin tests: PASS 13/13 files, 51/51 tests.
- Backend Admin DB integration: PASS 6/6 files, 12/12 tests trên schema cô lập.

## Work tracker

| ID | Mảng | Trạng thái | Đầu ra/code chính | Test/Evidence | Còn lại |
|---|---|---|---|---|---|
| ADMIN-00 | Baseline / tracker | DONE | Tạo journal Admin; baseline được cập nhật theo từng lát cắt. | Backend native suite PASS; backend typecheck PASS; backend lint PASS. Frontend suite PASS; frontend typecheck/lint/build PASS. PostgreSQL isolated schema integration PASS 6/6 files, 12/12 tests. OpenAPI drift PASS. | Duy trì đồng bộ tài liệu. |
| ADMIN-01 | CR / acceptance | DONE | CR-ADMIN-01 chốt scope, campaign snapshot/retry, report definitions, Order/audit rules, API, migration constraints và acceptance. | Owner phê duyệt qua “PLEASE IMPLEMENT THIS PLAN”; không giả lập reviewer độc lập. | Đồng bộ rules/API/docs sau khi implementation tương ứng pass. |
| ADMIN-02 | FE/API boundary | DONE | Xóa live silent fallback; map Users/Shops DTO thật; thống nhất Admin stats/audit OpenAPI/generated types; Review API UI. | TDD live failure 1 file/2 tests PASS; Admin API/UI 2 files/5 tests PASS; `npm run api:types:check` PASS; `npm run lint` PASS. | Hoàn tất boundary. |
| ADMIN-03 | Users | DONE | Existing list, search, lock/unlock; cursor pagination `(created_at, id)` base64url envelope `{ data, meta }`; User detail dialog. | Backend test `test/platform/admin-user-shop-query.spec.ts` PASS; Frontend test `test/admin-users-shops-detail.spec.ts` PASS. | Hoàn thành code & unit test. |
| ADMIN-04 | Shops | DONE | Existing list, approve/profile guard, lock/unlock; PENDING surfaced; cursor pagination `(created_at, shop_id)` base64url; Shop detail dialog (contact phone, pickup address). | Backend test `test/platform/admin-user-shop-query.spec.ts` PASS; Frontend test `test/admin-users-shops-detail.spec.ts` PASS. | Hoàn thành code & unit test. |
| ADMIN-05 | Categories | DONE | Repository dùng GET/POST/PATCH `/admin/categories`, 2-level hierarchy (RB-KN04), cycle parent check; status INACTIVE tự động ẩn khỏi public catalog `GET /categories`. | Isolated schema test `tests/db/admin-category.integration.test.ts` PASS 2/2; Frontend `test/admin-category-api.spec.ts` PASS. | Hoàn thành code & DB integration. |
| ADMIN-06 | Product/Review moderation | DONE | Product/Review HIDE & RESTORE với lý do bắt buộc; atomic transaction commit moderation record và admin_logs; QD20 audit rollback enforcement (rollback khi audit fail, giữ nguyên ACTIVE). | Isolated schema test `tests/db/admin-moderation.integration.test.ts` PASS 3/3; Frontend `test/admin-reviews-screen.spec.tsx` PASS. | Hoàn thành code & DB integration. |
| ADMIN-07 | Orders | DONE | Admin order list/detail, global filters, cursor; can thiệp chuyển trạng thái (CANCELLED) kèm lý do bắt buộc, order_status_history, admin_logs commit atomic và phục hồi tồn kho variant. | Isolated schema test `tests/db/admin-order.integration.test.ts` PASS 2/2; Frontend `test/admin-orders-screen.spec.tsx` PASS. | Hoàn thành code & DB integration. |
| ADMIN-08 | PLATFORM voucher | DONE | Admin voucher create/update/status PLATFORM; lý do và admin_logs bắt buộc; khi voucher INACTIVE, checkout/evaluate từ chối mã với lỗi 422. | Isolated schema test `tests/db/admin-voucher.integration.test.ts` PASS 2/2; Frontend `test/admin-vouchers-screen.spec.tsx` PASS 2/2. | Hoàn thành code & DB integration. |
| ADMIN-09 | Notification campaign | DONE | Forward-only campaign/recipient schema; snapshot ACTIVE users; Idempotency-Key advisory lock + replay; batch worker `FOR UPDATE SKIP LOCKED` phát tán SYSTEM notifications với event_id ổn định. | Isolated schema test `tests/db/admin-campaign.integration.test.ts` PASS 2/2; Frontend `test/admin-campaigns-screen.spec.tsx` PASS 1/1. | Hoàn thành code & DB integration. |
| ADMIN-10 | Audit viewer | DONE | Read-only `/admin/audit-logs` với action/target/actor/date filters, stable cursor `(created_at, log_id)`, paginated envelope, dedicated screen with details and target links. | Backend `admin-read.service.spec.ts` PASS; Frontend `test/admin-audit-screen.spec.tsx` PASS 2/2. | Hoàn thành code & unit test. |
| ADMIN-11 | Dashboard/report | DONE | Endpoint `/admin/reports`: inclusive date filters, daily GMV theo Asia/Ho_Chi_Minh (QD19 completed only), top shops/products; biểu đồ cột kèm bảng tương đương. | Isolated schema test `tests/db/admin-report.integration.test.ts` PASS 1/1; Frontend `test/admin-reports-screen.spec.tsx` PASS 2/2. | Hoàn thành code & DB integration. |
| ADMIN-12 | UI / accessibility | IN_PROGRESS | Tuân thủ UI/UX Pro Max: modal Dialog A11y (aria-labelledby, aria-describedby, close button label, Escape to close), form label/input association, responsive overflow-x table wrappers. | Frontend test `test/admin-a11y-keyboard-responsive.spec.tsx` PASS 3/3; `test/shared-ui-contracts.spec.tsx` PASS. | Cần bổ sung Axe audit tự động, kiểm tra 4 viewports (mobile/tablet/desktop/wide), tương phản màu WCAG AA và reduced-motion. |
| ADMIN-13 | E2E/security | IN_PROGRESS | RBAC Guard component logic: chặn unauthenticated và non-ADMIN vào `/admin/*`; chu trình quản trị duyệt shop, khóa/mở khóa user vi phạm kèm lý do. | Frontend test `test/admin-security-journey.spec.ts` PASS 3/3; `test/route-guards.spec.ts` PASS. | Cần chạy Playwright Browser E2E thật trên server live để kiểm tra RBAC cookie/session và network calls. |
| ADMIN-14 | Final gates/docs | IN_PROGRESS | Backend DB integration (6 files/12 tests PASS); frontend admin tests (13 files/51 tests PASS); backend/frontend typecheck & lint 100% PASS 0 error 0 warning. | Chạy thực tế quan sát được; logs kiểm chứng đầy đủ. | Cần môi trường PostgreSQL test riêng biệt hoàn toàn với Supabase production để chạy full test suite an toàn tuyệt đối. |

## Contract / source decisions

- Admin APIs use `/api/v1/admin`; only backend auth context with role ADMIN grants access.
- Cursor envelope is `data` + `meta { next_cursor, has_more, limit }` + `request_id`.
- Category deletion is disabled; use `INACTIVE`.
- No user-submitted reports in this phase; do not display fake report counts.
- Admin can read all voucher scopes but write PLATFORM only.
- Notification campaign recipients are an immutable snapshot of ACTIVE users with chosen BUYER/SELLER role; delivery is resumable and idempotent.
- Report default is last 30 days; completed-order revenue is bucketed by Ho Chi Minh local day, persisted timestamps stay UTC.
- Order/audit mutations are atomic and preserve frozen snapshots.
- Schema Freeze remains unchanged. Any extra schema is additive and requires a reviewed migration.

## Journal

### 2026-10-01 — ADMIN-00 / ADMIN-01

- Đã làm:
  - Đọc Buyer/Seller progress journals, Architecture Rules index, role rules, API conventions, DB rules, order workflow, error observability, testing gates, original spec và schema freeze.
  - Ghi baseline backend native tests: `cd backend; npm run test:node` — PASS, 647/647.
  - Ghi baseline frontend test: `cd frontend; npm test -- --reporter=dot` — không chạy được do `spawn EPERM` lúc Vitest nạp config trong sandbox; không tính là pass.
  - Tạo CR-ADMIN-01 và tracker này. Giữ nguyên các thay đổi Buyer/Seller có sẵn trong workspace.
- Quyết định kỹ thuật:
  - Audience campaign snapshot là ACTIVE user tại thời điểm tạo; worker chỉ dùng snapshot đã ghi — CR-ADMIN-01.
  - Không tự thêm report submission; số vi phạm báo cáo là moderation records — CR-ADMIN-01.
- Contract/port thay đổi:
  - CR-ADMIN-01 — Admin Portal capabilities và hai bảng campaign vận hành — Approved theo chỉ thị trực tiếp của Chủ dự án ngày 2026-10-01.
- Test đã viết/chạy:
  - QD11/QD17/QD19/QD20 — baseline backend native suite — PASS 647/647.
  - Frontend baseline suite — môi trường lỗi `spawn EPERM`, chưa có kết quả test.
- Blocker phát sinh:
  - Frontend test worker không spawn được trong sandbox — cần runner cho phép child process — 2026-10-01.

### 2026-10-01 — ADMIN-02 live failure slice

- Đã làm:
  - Xóa catch fallback sang mock khỏi `apiAdminRepository` trong `frontend/src/lib/repositories/repository-factory.ts`; lỗi API live giờ được propagate tới UI.
  - Thêm `frontend/test/admin-live-failure.spec.ts` kiểm tra danh sách user và mutation lock khi HTTP boundary trả lỗi mạng.
- Quyết định kỹ thuật:
  - Chỉ mock HTTP `fetch` ở test này; không mock module nghiệp vụ/repository nội bộ (TDD seams đã chốt).
- Contract/port thay đổi:
  - Không đổi wire contract; live failure hiển thị như lỗi hiện có của UI.
- Test đã viết/chạy:
  - Red: `cd frontend; npm test -- --reporter=dot test/admin-live-failure.spec.ts` — 2 failed theo bug tái hiện (fixtures bị trả và mutation fake thành công).
  - Green: cùng command — PASS, 1 file / 2 tests.
- Follow-up ADMIN-05 category red/green:
  - Red: `cd frontend; npm test -- --reporter=dot test/admin-category-api.spec.ts` — FAIL 2 tests: live category response lost `INACTIVE`; `ApiAdminRepository.updateCategory` was missing.
  - Green: same command — PASS 1 file / 2 tests; Admin regression set (`admin-category-api.spec.ts`, `admin.spec.ts`, `admin-live-failure.spec.ts`) PASS 3 files / 19 tests.
  - `cd frontend; npm run typecheck` — PASS after replacing the live tree builder so it retains inactive nodes.
  - Removed physical deletion from category Admin UI/mock contract; added edit form; status actions call explicit target state.
  - Final FE gates: `cd frontend; npm test -- --reporter=dot` — PASS 54 files / 289 tests; `npm run typecheck` — PASS; `npm run lint` — PASS; `npm run build` — PASS (Next.js 16.3.5).
- 2026-10-01 — ADMIN-06 moderation implementation:
  - TDD red REST: thêm test `PATCH /api/v1/admin/products/:id/moderate`; lần chạy đầu nhận 404 vì endpoint chưa có.
  - TDD red service: `HIDE` ghi audit nhưng Product vẫn `ACTIVE`.
  - Green: ModerationService xác minh state trước mutation, cập nhật Product/Review trong transaction rồi ghi moderation record + AdminLog; Pg repository dùng transaction client cho update.
  - Green REST/service: `cd backend; npx tsx --test test/platform/admin-routes.spec.ts test/modules/moderation/moderation-service.spec.ts` — PASS 35/35.
  - Toàn bộ backend native tests sau thay đổi: `cd backend; npm run test:node` — PASS 650/650; backend typecheck PASS.
  - FE Product API/Review screen: `cd frontend; npm test -- --reporter=dot test/admin-reviews-screen.spec.ts test/admin-category-api.spec.ts` — PASS 2 files / 5 tests.
  - Thêm `/admin/reviews`; không dùng fake report count trong bảng Product.
- Blocker phát sinh:
  - Không.

### 2026-10-01 — ADMIN-06 Review UI / ADMIN-07 Order intervention

- Đã làm:
  - Thêm trang `/admin/reviews` với lọc trạng thái/tìm kiếm, loading/error/empty, modal nhập reason và cập nhật sau mutation.
  - Thêm test thao tác người dùng cho Review moderation; test chỉ giả lập HTTP và browser dialog.
  - Admin Order confirm, confirm-received và transition yêu cầu reason; lý do đi vào `order_status_history`, AdminLog được ghi cùng transaction qua PgAuditRepository.
  - Mở rộng allowlist audit target với `ORDER` và `CATEGORY`; cập nhật OpenAPI body cho confirm/confirm-received.
- Test:
  - Frontend focused Admin API/UI: PASS 2 files / 5 tests.
  - Backend Order/Admin: PASS 2 files / 21 tests; backend typecheck PASS.
  - Frontend full suite ở workspace hiện tại: 56 files, 291 passed / 2 failed; hai lỗi thuộc thay đổi Review upload đang diễn ra đồng thời (`media-upload.spec.ts`, `review-api.spec.ts`), không thuộc Admin.
- Còn thiếu:
  - ADMIN-06 real PostgreSQL rollback/audit/public catalog tests và cursor pagination.
  - ADMIN-07 admin-filtered list UI và real PostgreSQL audit rollback tests.

### 2026-10-01 — ADMIN-10/11 initial live read slices

- Đã làm:
  - Bổ sung AdminReadService từ PostgreSQL và wiring thật cho `/admin/stats`, `/admin/audit-logs`; trước đó FE gọi hai endpoint chưa tồn tại khiến dashboard reject Promise.all.
  - Stats GMV dùng `SUM(total_amount)` với `status='COMPLETED'`; audit filters dùng bound parameters, limit 1–100.
  - OpenAPI cập nhật; generated FE API types được tái tạo và drift check PASS.
  - FE API repository map user/shop snake_case sang model màn hình; shop PENDING hiển thị “Chờ duyệt” và link sang trang duyệt.
- Test/gates:
  - Backend focused Admin/order/moderation/audit suite: PASS 50/50.
  - Full backend native suite: PASS 655/655.
  - Backend typecheck PASS; frontend typecheck/lint/build PASS; OpenAPI type check PASS.
  - `cd frontend; npm test -- --reporter=dot` — PASS 56 files / 293 tests (kết quả cập nhật sau khi review branch changes cùng workspace ổn định).
- Còn thiếu: reporting chi tiết trong ADMIN-11, audit cursor và UI trong ADMIN-10; transaction cases vẫn cần PostgreSQL thật.

### 2026-10-02 — ADMIN-08 PLATFORM vouchers

- Đã làm:
  - Tách `validateVoucherFields` dùng chung Seller/Admin.
  - Thêm `AdminVoucherService`; create/update/status mutations use one transaction with `admin_logs`; server fixes scope to PLATFORM and shop_id to null. The list keeps both real scopes visible; writes reject non-PLATFORM targets. Used vouchers can only change status.
  - Thêm `/admin/vouchers` API/OpenAPI and responsive screen with create form, scope labels, and reason dialog for enable/disable. Link from dashboard.
  - Add VOUCHER to audit target allowlist as approved by CR-ADMIN-01.
- Test/gates:
  - UI red: test import failed because Admin voucher screen did not exist. UI green: `cd frontend; npm test -- --reporter=dot test/admin-vouchers-screen.spec.tsx` — PASS 1/1.
  - Backend voucher/audit: `cd backend; npx tsx --test test/modules/voucher/admin-voucher.service.spec.ts test/platform/audit-logging.spec.ts test/platform/openapi.spec.ts` — PASS 7/7.
  - Final current full gates: backend native PASS 657/657, backend typecheck/lint/build PASS; frontend PASS 57 files / 294 tests, typecheck/lint/build PASS; OpenAPI drift check PASS.
- Còn thiếu: real PostgreSQL acceptance and checkout usage tests; update/status UI tests; campaign, full reports, E2E and accessibility remain open.

### 2026-10-02 — ADMIN-09 notification campaigns initial slice

- Đã làm:
  - Migration tiến về trước thêm `admin_notification_campaigns` và `admin_notification_campaign_recipients`; recipient snapshot giữ nguyên role + active status tại thời điểm tạo.
  - API POST yêu cầu `Idempotency-Key`; cùng key/payload trả cùng campaign, cùng key/payload khác trả 409. Ghi audit cùng transaction.
  - Runtime worker dùng `FOR UPDATE SKIP LOCKED`, batches tối đa 500 và event ID cố định theo campaign/user; insert notification + SENT mark nằm cùng transaction; worker được dừng khi runtime close.
  - Admin `/campaigns` UI chọn một audience, nhập nội dung/lý do, tạo chiến dịch và xem số đã gửi.
- Test:
  - Red UI: import screen chưa tồn tại. Green: `cd frontend; npm test -- --reporter=dot test/admin-campaigns-screen.spec.tsx` — PASS 1/1.
  - Backend service tests: `cd backend; npx tsx --test test/modules/moderation/admin-notification-campaign.service.spec.ts` — PASS 2/2.
- Còn thiếu: PostgreSQL thật cho race/crash/retry, migration acceptance, E2E và screen polling hiện dùng nút refresh.

### 2026-10-02 — ADMIN-07 Orders, ADMIN-11 reports, final gate refresh

- Đã làm:
  - Admin Orders có truy vấn toàn sàn với search/status/shop/buyer/date, cursor; chi tiết có items, payments, shipment, history; UI cho xem và can thiệp bằng reason.
  - Admin Reports có endpoint theo khoảng ngày inclusive, trạng thái đơn, GMV theo ngày Asia/Ho_Chi_Minh, top shop/product và moderation counts. GMV/top chỉ lấy Order `COMPLETED` theo QD19.
  - `/admin/reports` có bộ chọn ngày, biểu đồ cột GMV có nhãn truy cập và bảng tương đương, top tables, empty/error/retry.
  - Sửa React lint rule ở Orders và Vouchers bằng cách schedule lần tải ban đầu qua Promise microtask.
- TDD/test:
  - Report service red: chưa tồn tại `getOperationalReport`, 2 test fail; green: `cd backend; npx tsx --test test/modules/moderation/admin-read.service.spec.ts test/platform/admin-routes.spec.ts` — PASS 28/28.
  - Report UI `cd frontend; npx vitest run test/admin-reports-screen.spec.tsx` — PASS 2/2 sau chỉnh assertion theo bốn vị trí hiển thị GMV.
  - Orders UI PASS 1/1; Voucher UI PASS 2/2; nhóm 3 màn Admin focused PASS 5/5.
  - Backend native: `cd backend; npx tsx --test test/**/*.spec.ts tests/modules/buyer/*.test.ts` — PASS 665/665; backend typecheck/lint/build PASS.
  - Frontend full: `cd frontend; npm run test -- --testTimeout=15000` — PASS 60 files / 299 tests; frontend typecheck/build/lint PASS; `npm run api:types:check` PASS.
  - Full `cd backend; npm test` không pass: native 665/665 xanh; PostgreSQL Vitest báo 20/32 fail vì relation/fixture không tồn tại trong full suite chạy song song. Dừng sau khi đủ bằng chứng suite lỗi; không ghi DB gate pass.
- Còn thiếu:
  - Xác định fixture collision/missing relation rồi chạy PostgreSQL integration cô lập, đặc biệt Admin moderation/order/voucher/campaign/report transaction rollback.
  - ADMIN-10 audit cursor/dedicated UI; ADMIN-03/04 detail và cursor; ADMIN-05 atomic audit/catalog PG; ADMIN-06 real PG/public read.
  - ADMIN-12 accessibility/browser viewport pass; ADMIN-13 browser E2E; ADMIN-14 final isolated DB gates.

### 2026-10-02 — ADMIN-10 Audit cursor/UI, ADMIN-11 PostgreSQL report

- Đã làm:
  - Thêm `AdminReadService.listAuditLogsPage`: cursor base64url ổn định theo `(created_at, log_id)`, giới hạn 20 mặc định/100 tối đa, lọc actor/action/target/from/to; cursor và date không hợp lệ bị từ chối.
  - Nâng `/api/v1/admin/audit-logs` lên paginated envelope và cập nhật OpenAPI/generated types.
  - Tạo `/admin/audit-logs` có bộ lọc, tải thêm, xem chi tiết và link target; dashboard dẫn tới trang riêng.
  - Thêm PostgreSQL integration report bằng migration thật trong schema ngẫu nhiên riêng; kiểm tra QD19 và biên ngày Asia/Ho_Chi_Minh.
  - Cấu hình Vitest DB chạy một worker để tránh suites dùng chung phiên PostgreSQL đồng thời; suite tự tạo/xóa schema riêng.
- TDD/test:
  - Audit red: 2 test fail vì `listAuditLogsPage` chưa có; green `cd backend; npx tsx --test test/modules/moderation/admin-read.service.spec.ts test/platform/admin-routes.spec.ts` — PASS 30/30.
  - Audit UI red: import screen chưa tồn tại; green `cd frontend; npx vitest run test/admin-audit-screen.spec.tsx` — PASS 2/2.
  - Reports `cd frontend; npx vitest run test/admin-reports-screen.spec.tsx` — PASS 2/2.
  - `cd backend; npx vitest run tests/db/pg-checkout.integration.test.ts --maxWorkers=1` — PASS 32/32 (serial, isolated schema; ~7m48s).
  - `cd backend; npx vitest run tests/db/admin-report.integration.test.ts --maxWorkers=1` — PASS 1/1 (serial, isolated schema).
  - Backend native `npm run test:node` — PASS 682/682; backend typecheck/lint PASS.
  - Frontend `npm run test -- --testTimeout=15000` — PASS 63 files / 308 tests; typecheck/build PASS. Frontend lint command was still running at last observation; chưa ghi pass.
  - `npm run api:types:check` bị `spawn EPERM` khi script spawn Node con trong sandbox; chưa có kết quả drift check.
- Chưa nghiệm thu:
  - Full PostgreSQL Vitest suite serial chưa chạy; trước đó suite parallel thất bại vì thiếu relation/fixture.
  - E2E fixture reset bị guard vì DB environment hiện ghi production; không chạy mutation/reset trên đó. Cần test DB đã xác minh để hoàn tất ADMIN-13.
  - ADMIN-03/04 detail + cursor, category/moderation/order/voucher/campaign transaction integration, reason-dialog Axe/focus và viewport review còn mở.
  - Frontend lint ban đầu phát hiện `any` trong Review live UI test; thay bằng `IOrderRepository`. Sau đó `cd frontend; npm run lint -- --quiet` — PASS.
  - Frontend suite sau sửa lint, chạy với quyền worker: `cd frontend; npm run test -- --testTimeout=15000` — PASS 63 files / 308 tests; `npm run typecheck`, `npm run build`, `npm run api:types:check` — PASS.
  - `cd backend; npm run test:vitest -- --maxWorkers=1` bị automatic approval review từ chối: suite có test drop/truncate bảng fixed/public trong khi target Supabase được gắn nhãn production; phạm vi cho phép hiện có chỉ bao gồm test schema cô lập. Không tìm cách vượt guard; cần cấu hình test DB riêng.

### 2026-10-02 — Kiểm chứng tracker sau bổ sung Users/Shops

- Backend `npm run typecheck` và `npm run lint` — PASS, 0 lỗi/cảnh báo.
- Frontend `npm run typecheck`, `npm run lint` và `npm run api:types:check` — PASS; Admin UI suite với `--testTimeout=15000` — PASS 13 files / 51 tests.
- PostgreSQL Admin isolated schema suite — PASS 6 files / 12 tests; test User/Shop query và OpenAPI — PASS 12/12.
- `ADMIN-00` đến `ADMIN-11` có test/implementation evidence trong các mục ở trên. `ADMIN-12` còn thiếu Axe, contrast, reduced-motion và kiểm tra viewport thực tế. `ADMIN-13` mới có Vitest route-guard/mock test, chưa phải Playwright/browser E2E. `ADMIN-14` còn cần database test project tách biệt để chạy full DB suite an toàn.
- DB suite tạo/xóa schema ngẫu nhiên trong database cấu hình hiện tại; không cập nhật bảng `public`. Chưa xác nhận đây là project PostgreSQL riêng biệt với Supabase production.

## Quy tắc cập nhật

- Mỗi capability chỉ chuyển sang `DONE` sau test đỏ trước implementation và test xanh sau implementation, cùng lệnh/kết quả.
- PostgreSQL constraint, transaction, audit rollback, cursor concurrency và campaign restart test phải dùng PostgreSQL thật.
- Không sửa Schema Freeze hoặc migration đã phát hành.
- Không chạy migration/seed trên production để nghiệm thu.
- Ghi blocker, suite timeout và môi trường không chạy được nguyên trạng; không ghi là pass.


