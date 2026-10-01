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
- Cập nhật lần cuối: 2026-10-02.
- Đang làm: ADMIN-02 đến ADMIN-14; chưa có capability Admin nào được nghiệm thu trọn vẹn do còn thiếu kiểm chứng PostgreSQL thật, UI/A11y hoặc browser E2E.
- Bị block bởi: chưa có; các feature mở rộng tuân CR-ADMIN-01 đã được Chủ dự án duyệt trực tiếp qua yêu cầu triển khai plan.
- Workspace lúc bắt đầu có thay đổi chưa commit trong Buyer/Seller progress docs và untracked `lvvd.jpg`; không thuộc thay đổi Admin này.

## Work tracker

| ID | Mảng | Trạng thái | Đầu ra/code chính | Test/Evidence | Còn lại |
|---|---|---|---|---|---|
| ADMIN-00 | Baseline / tracker | IN_PROGRESS | Tạo journal Admin; baseline được cập nhật theo từng lát cắt. | Backend native suite PASS 682/682; backend typecheck PASS. Frontend suite PASS 63 files / 308 tests (`--testTimeout=15000`); frontend typecheck/lint/build PASS. PostgreSQL checkout integration chạy serial PASS 32/32; report integration PASS 1/1. OpenAPI drift PASS. Full DB suite chưa được chạy vì approval review chặn suite rộng có thể drop/truncate fixed/public tables trên target gắn nhãn production. | Cần test DB riêng được xác minh để chạy full suite và E2E. |
| ADMIN-01 | CR / acceptance | DONE | CR-ADMIN-01 chốt scope, campaign snapshot/retry, report definitions, Order/audit rules, API, migration constraints và acceptance. | Owner phê duyệt qua “PLEASE IMPLEMENT THIS PLAN”; không giả lập reviewer độc lập. | Đồng bộ rules/API/docs sau khi implementation tương ứng pass. |
| ADMIN-02 | FE/API boundary | IN_PROGRESS | Xóa live silent fallback; map Users/Shops DTO thật; thống nhất Admin stats/audit OpenAPI/generated types; Review API UI. | TDD live failure 1 file/2 tests PASS; Admin API/UI 2 files/5 tests PASS; `npm run api:types:check` PASS. | Hợp nhất hai Admin repository đang trùng, cursor envelopes, full screen-wide retry/error states. |
| ADMIN-03 | Users | IN_PROGRESS | Existing list, search, lock/unlock, ADMIN-target guard and audit endpoints retained; FE uses real API DTO mapping. | Full backend native suite PASS 655/655; ADMIN route test suite passes in focused 50/50 set; live failure test protects against fake fallback. | Cursor/filter contract, user detail, complete user-action tests and real PostgreSQL rollback evidence. |
| ADMIN-04 | Shops | IN_PROGRESS | Existing list, approve/profile guard, lock/unlock; PENDING surfaced on Admin shop page/dashboard link. | Full backend native suite PASS 655/655; Admin shop APIs covered in baseline route/service tests; UI work remains. | Cursor/detail, contact/pickup requirements on real DB, concurrent command/audit rollback and UI action tests. |
| ADMIN-05 | Categories | IN_PROGRESS | Repository dùng GET/POST/PATCH `/admin/categories`, map trạng thái thật, tạo/sửa/status; UI hỗ trợ tạo/sửa/ngừng/khôi phục; gỡ physical delete. | Red: `cd frontend; npm test -- --reporter=dot test/admin-category-api.spec.ts` — 2 failed do status bị ép ACTIVE và thiếu updateCategory. Green focused suite PASS 1 file/2 tests; full FE suite 56 files/293 tests, typecheck/lint/build PASS. | User-action UI test, real PostgreSQL route/catalog visibility, category writes need atomic audit. |
| ADMIN-06 | Product/Review moderation | IN_PROGRESS | Admin Product/Review read APIs; HIDE/RESTORE đổi trạng thái trong cùng transaction với moderation record và AdminLog; bảng Product bỏ số báo cáo giả; thêm trang `/admin/reviews` có lọc, modal reason và cập nhật trạng thái. | Red REST: `cd backend; npx tsx --test test/platform/admin-routes.spec.ts` — route chưa tồn tại trả 404. Green: route + service tests PASS 35/35. Service TDD red cho HIDE: trạng thái vẫn ACTIVE; green product/review service tests PASS. FE red cho Product DTO: API trả snake_case thay vì model UI; green API/UI tests PASS 2 files / 5 tests. Backend typecheck PASS. | Cần real PostgreSQL test cho status/audit rollback, product public read sau ẩn/khôi phục, cursor pagination và review UI polish/Axe. |
| ADMIN-07 | Orders | IN_PROGRESS | Admin list/detail includes global search/status/shop/buyer/date filters, cursor paging, items/payments/shipment/timeline; Admin state commands require reason and write audit with history in the same transaction. FE page supports list, search, detail and intervention. | Red: Admin confirm initially had no reason guard. Green: focused backend order/Admin suite PASS 45/45; Admin order screen action test PASS 1/1; backend/frontend typecheck PASS. Existing PostgreSQL order-query runtime tests passed 6/6 in the full suite before fixture failures. | Verify Admin intervention audit rollback/races on isolated PostgreSQL DB; all state transitions; browser journey. |
| ADMIN-08 | PLATFORM voucher | IN_PROGRESS | Admin voucher list includes PLATFORM and SHOP scopes; writes create/edit/status only `PLATFORM` and force `shop_id=NULL`; reason and audit are required. Used vouchers reject condition edits but allow status change. Added `/admin/vouchers` screen. | TDD UI red: missing Admin voucher screen module. Green: `cd frontend; npm test -- --reporter=dot test/admin-vouchers-screen.spec.tsx` — current focused PASS 2/2 (create + edit); backend voucher/audit tests PASS 7/7. | Real PostgreSQL checkout application and transaction rollback tests, status-dialog/a11y and end-to-end. |
| ADMIN-09 | Notification campaign | IN_PROGRESS | Added forward-only campaign/recipient migration; create snapshots ACTIVE BUYER or SELLER recipients; `Idempotency-Key` replays same payload; background worker sends SYSTEM notifications in batches with stable unique `event_id`; UI creates a group campaign and shows progress. | Red UI: missing screen module. Backend focused snapshot/idempotency + worker tests PASS 2/2; campaign UI test PASS 1/1; backend/frontend typecheck PASS. | PostgreSQL integration for snapshot/crash/retry/unique delivery, count-zero case, final gates and full journey. |
| ADMIN-10 | Audit viewer | IN_PROGRESS | Read-only `/admin/audit-logs` with action/target/actor/date filters, stable cursor `(created_at, log_id)`, paginated envelope, dedicated screen with details and target links. | TDD red: `listAuditLogsPage` missing (2 failures); green backend focused Admin read/routes PASS 30/30; Audit UI PASS 2/2. | PostgreSQL commit/rollback evidence; validate cursor/filter cases against PG; legacy dashboard only reads first page. |
| ADMIN-11 | Dashboard/report | IN_PROGRESS | Added `/admin/reports`: inclusive date filters, status counts, daily GMV by Asia/Ho_Chi_Minh, top completed-order shops/products, moderation actions. FE has date filters, bar chart + equivalent table, loading/error/empty states. | Service TDD red: `getOperationalReport` missing (2 failures); green focused backend read/routes PASS 30/30; report screen PASS 2/2; real PG date-boundary/QD19 integration PASS 1/1. | Real PG tie-break and broader range cases; browser E2E. |
| ADMIN-12 | UI / accessibility | IN_PROGRESS | Applied UI/UX Pro Max to Admin report and audit screens: responsive tables, accessible labelled chart with equivalent table, filters, detail disclosure and error/retry/empty states. | Report UI PASS 2/2; Audit UI PASS 2/2. Keyboard modal focus, contrast, Axe and 375/768/1024/1440 review not yet run. | Complete all-screen visual/responsive/accessibility review and reason modal focus tests. |
| ADMIN-13 | E2E/security | NOT STARTED | Full Admin browser journey with test data and RBAC checks. | — | — |
| ADMIN-14 | Final gates/docs | IN_PROGRESS | Tracker updated after Audit/report slices with observed current gates. | Backend native PASS 682/682; typecheck/lint PASS. FE tests PASS 63 files / 308 tests; typecheck/lint/build PASS. Checkout PG integration PASS 32/32 serial; report PG integration PASS 1/1. OpenAPI drift PASS. Full DB suite was rejected by automatic approval review because it may drop/truncate fixed/public tables on a production-labeled target; E2E not pass-verified. | Finish remaining feature/PG coverage on dedicated test DB; rerun final gates and browser journey. |

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

## Quy tắc cập nhật

- Mỗi capability chỉ chuyển sang `DONE` sau test đỏ trước implementation và test xanh sau implementation, cùng lệnh/kết quả.
- PostgreSQL constraint, transaction, audit rollback, cursor concurrency và campaign restart test phải dùng PostgreSQL thật.
- Không sửa Schema Freeze hoặc migration đã phát hành.
- Không chạy migration/seed trên production để nghiệm thu.
- Ghi blocker, suite timeout và môi trường không chạy được nguyên trạng; không ghi là pass.

