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

## Trạng thái hiện tại — 2026-10-01 (snapshot HEAD `fd353e1`)

- Phạm vi: MVP Seller operations, Backend + Frontend.
- Cập nhật lần cuối: 2026-10-01, sau các commit `38b4501`, `1b7e014`, `2b9f4a6` và `fd353e1` trên `origin/dev`.
- Đang làm: hoàn thiện acceptance và cập nhật evidence cho phần code mới; lần cập nhật tài liệu này không chạy test mới.
- Bị block bởi: PostgreSQL từ xa chập chờn trong lần rerun catalog variant add/remove; lần gần nhất gặp `ETIMEDOUT` tại truy vấn Seller product detail sau update. Test giữ variant có lịch sử đã pass. Cần chạy lại add/remove khi DB reachable.
- Trạng thái tổng: **IN_PROGRESS** — Product image editing, Shop logo media, một số UI tests và một Seller browser E2E đã được thêm sau lần ghi trước; cần cập nhật kết quả chạy test. Còn full lifecycle E2E với backend/DB thật, xác minh lại variant integration đang timeout, và backend full Vitest completion.

## Work tracker

| ID | Mảng | Trạng thái | Đầu ra/code chính | Kiểm tra/evidence | Còn lại |
|---|---|---|---|---|---|
| SELLER-00 | Change control / architecture | DONE | CR-SELLER-01 ghi quyết định, acceptance và owner approval. Rules đồng bộ tại `docs/architecture/role-business-rules.md`, `rules/auth-rbac-rls.md`, `rules/business-rules.md`, `rules/error-observability.md`. | Owner đã duyệt trực tiếp ngày 2026-10-01; CR được commit/push cùng implementation. `schema-freeze-v1.md` không đổi. | Review consistency sau khi đóng các hạng mục còn lại. |
| SELLER-01 | Shop profile / approval | IMPLEMENTED | Backend `GET/PATCH /seller/shop` scope theo authenticated owner; PENDING/ACTIVE có thể cập nhật hồ sơ Shop; trạng thái bị khóa chỉ đọc. Admin approve kiểm tra pickup address + contact phone nguyên tử trước status/audit. FE `/seller/shop`; không dùng Buyer `/addresses` làm địa chỉ lấy hàng. Shop logo media đã được thêm. | REST/PostgreSQL evidence lịch sử được ghi trong CR; commit `38b4501` thêm UI Shop test và logo media; `1b7e014` bổ sung hardening/kiểm thử. Chưa ghi lượt chạy mới sau các commit này. | Chạy focused UI và logo migration/integration tests sau các cập nhật. |
| SELLER-02 | Seller dashboard / KPI | IMPLEMENTED | `/seller/kpi` và reporting module dùng Shop trong request context; dashboard loại bỏ Shop ID mẫu, admin repository và public catalog thấp tồn; trạng thái loading/empty/error. | Focused Seller REST tests; lượt FE pass cũ như bên dưới. Chưa thấy focused KPI screen test trong các commit bổ sung gần nhất. | Thêm UI behavior test KPI và xác minh trong full lifecycle với backend thật. |
| SELLER-03 | Seller catalog / product lifecycle | IMPLEMENTED, DB RERUN NEEDED | Backend seller list cursor/filter, private detail kể cả Product INACTIVE, edit Product + variants; stock/status command riêng; `HIDDEN` không được Seller tự bật. SKU scope theo Shop, giá dương; biến thể bỏ khỏi form được xóa nếu chưa có Order, giữ `INACTIVE` nếu đã có Order. FE `/seller/products`, `/seller/products/[id]/edit`. Product image edit (thêm/xóa) đã được triển khai. | Backend focused REST evidence cũ; PostgreSQL giữ variant có Order pass, nhưng lần rerun add/remove gần nhất timeout. Commit `2b9f4a6` thêm PostgreSQL integration cho product image update; commit `38b4501` thêm UI product edit test. Chưa ghi kết quả chạy mới sau đó. | Chạy lại variant integration khi DB ổn định; chạy focused UI và image integration tests mới. |
| SELLER-04 | Product categories / media | IMPLEMENTED, VERIFICATION PENDING | Tạo Product dùng category API thật; upload/finalize media và create API chỉ chấp nhận media đã finalize. Product images có thể thêm/xóa khi edit; Shop logo media đã có endpoint/migration và UI. | Code/test được thêm ở `38b4501`, hardening ở `1b7e014`, OpenAPI + PostgreSQL image update integration ở `2b9f4a6`. Test có trong repo không đồng nghĩa đã chạy pass. | Chạy migration, logo/media và image integration/UI test suites; ghi kết quả cụ thể. |
| SELLER-05 | Seller orders / fulfillment | IMPLEMENTED | Order list phân trang theo `status/limit/cursor`; detail trả history timeline; scope theo Shop; FE xem timeline/load-more và reload sau HTTP 409. Seller transitions tuân state machine, bàn giao yêu cầu bằng chứng shipment. | Focused Seller order REST tests; PostgreSQL order pagination/history và checkout/order integrations đã pass riêng (evidence lịch sử). E2E hiện tại không đi qua luồng fulfillment. | Full browser E2E với backend thật còn thiếu. Seller không tự xác nhận `COMPLETED`/`DELIVERY_FAILED`. |
| SELLER-06 | Seller notifications | IMPLEMENTED | Seller đọc/mark-read notification cá nhân theo `recipient_id=context.user_id`, không phụ thuộc Shop ACTIVE; Seller navigation và notification screen được mở. Event writes cho lifecycle order được nối runtime. | Focused notification REST/runtime tests và navigation tests; full FE test suite pass. | Xác minh event lifecycle trong luồng browser E2E. |
| SELLER-07 | Shop vouchers | IMPLEMENTED | Seller voucher endpoints; backend tự gắn Shop; code normalized/unique, validation điều kiện; voucher có usage chỉ deactivate. FE `/seller/vouchers`. | REST/PostgreSQL evidence cũ; `38b4501` thêm voucher UI test; Seller E2E mock có thao tác tắt voucher. Chưa ghi kết quả chạy mới. | Chạy test mới; kiểm chứng checkout concurrency/effect trong E2E tích hợp thật. |
| SELLER-08 | Revenue reporting | IMPLEMENTED | `/seller/reports/revenue?from&to`, scope Shop context, chỉ Order `COMPLETED` theo QD19; FE `/seller/reports` date filters và Seller repository riêng. | PostgreSQL report evidence cũ; `38b4501` thêm reports UI test; Seller E2E mock có thao tác xem báo cáo. Chưa ghi kết quả chạy mới. | Chạy test mới và xác minh report trong full flow thật. |
| SELLER-09 | OpenAPI / wiring | DONE FOR CURRENT CONTRACT | Endpoint contracts được wire trong `app.ts`, OpenAPI spec và generated FE API types/adapters. | `frontend npm run api:types:check` — PASS, generated types khớp backend OpenAPI. | Chạy lại generator/check khi contract thay đổi tiếp theo. |
| SELLER-10 | Acceptance / quality | IN_PROGRESS | REST/PostgreSQL seams, Seller UI action tests và mocked browser lifecycle E2E hiện có trong repo. | Kết quả trước commit bổ sung: backend `test:node` 641/641; focused Seller REST 43; FE 48 files/274 tests; typecheck/lint/build và OpenAPI drift pass. Các commit mới thêm UI/E2E và PostgreSQL image integration; chưa có lượt chạy lại được ghi nhận. | Backend full Vitest chưa có pass toàn suite được ghi nhận; variant rerun từng gặp ETIMEDOUT; chưa có full browser E2E onboarding → approval → real product → checkout → fulfillment → report với backend/DB thật. |

## Nhật ký theo ngày

### Acceptance update — 2026-10-02

- Latest selected PostgreSQL acceptance: 13 files / 84 tests passed (8 isolated-schema files / 27 tests; Shop-logo/media 2 files / 19 tests; two selected catalog variant add/remove/history tests; checkout runtime + PostgreSQL 2 files / 36 tests). This resolves the recorded variant timeout for the two selected behaviors only; it does not constitute the entire catalog suite.
- Cleanup verification on the user-authorized in-progress Supabase project removed 14 exact-match `p5_checkout_<32 hex>` schemas and one exact-match `p4_checkout_e2e_<32 hex>` schema after their table sets matched the checkout fixtures. A final read-only check found no matching test schemas and no rows for the fixed Seller variant fixture IDs. No migration, reset, seed, Admin change, or live browser lifecycle flow was run.
- The catalog variant tests still run against fixed IDs in `public`, with test-hook cleanup; final read-only counts were zero. Use unique isolated schemas for future acceptance where feasible.

- Frontend quality gates rerun in this checkout: all **56 files / 293 tests pass**, typecheck/lint/build exit 0 (build generated 26 pages). This includes Admin test files present in the shared checkout; the result is only a frontend suite result, not Seller live acceptance.
- Backend typecheck/lint/build exit 0. Backend `test:node` rerun on the current workspace: **657/657 pass**; this supersedes the prior 650/651 snapshot.
- PostgreSQL suites rerun on the user-confirmed in-progress Supabase project: 8 isolated-schema files / 27 tests plus Shop-logo/media 2 files / 19 tests passed. Two selected catalog variant add/remove/history tests also passed against fixed-ID `public` fixtures after read-only preflight showed all fixture IDs unused. Checkout runtime and PostgreSQL suites then passed 36 tests in isolated schemas. Cleanup verification removed exact-match leftover checkout schemas and confirmed all matching test schemas and fixed-ID fixture rows absent.
- No migration/reset/seed/provider smoke or live browser flow ran. The selected checkout PostgreSQL tests ran against isolated test schemas, despite exercising destructive cleanup operations inside those schemas.
- Current full frontend rerun: 294 tests passed; one Admin suite failed during collection because its imported `admin-campaigns-screen` file is missing. Focused Seller voucher UI test passed. Frontend build/typecheck pass; lint excluding Admin exits 0, while full lint is blocked by an Admin hooks lint error. No Seller Admin-scope files were changed to conceal these failures.
- Seller task evidence in the tracker above remains a mix of historical completed runs and tests added but not rerun after later commits. In particular, real browser flow Shop approval → Product/media → Buyer checkout → Seller fulfillment → Buyer confirm → Seller report is still not proven by current evidence; the E2E source that mocks API is UI coverage only.
- Open acceptance remains: make variant integration fixtures isolated, run Product image/Seller UI tests after newest changes, and execute the live full lifecycle flow Shop approval → Product/media → Buyer checkout → Seller fulfillment → Buyer confirm → report. No Seller task is promoted to `DONE` by this update.

### Latest verification — 2026-10-02

This entry supersedes the earlier “variant rerun timeout” and “new UI/DB tests not yet rerun” notes where the selected tests below cover those items. It does not claim the full Seller acceptance lifecycle is complete.

- Buyer/Seller frontend behavior selection: **25 files / 144 tests passed**. This includes the currently selected Seller screens and Buyer checkout/review/auth UI; it is not the full frontend suite.
- Seller/checkout real-PostgreSQL acceptance on the user-authorized Supabase project: **8 files / 50 tests passed** across Seller Shop, voucher, reporting, Product image update, Shop logo/media, order query and checkout suites. These suites passed using isolated schemas; selected test-schema prefixes were absent in the post-run read-only check.
- This run supersedes the prior variant timeout for the selected Seller variant behaviors in the preceding acceptance update: add/remove/history selection completed successfully in the earlier run. It does not assert every catalog integration case passed.
- Live review-media smoke also passed against Supabase Storage (presign → actual object upload → API finalize), with the temporary Auth user, media row and Storage object removed by cleanup. This verifies the shared media lifecycle used by Seller, but is not a full Product/Shop-logo browser flow.
- Added a destructive-reset-free Playwright guest boundary check: `$env:E2E_BASE_URL='http://localhost:3000'; npx playwright test e2e/guest-access-live.spec.ts` — **1/1 PASS**. It confirms the public catalog route renders and a guest visiting `/cart` is redirected to login.
- Still open: a single live browser journey covering Shop approval → Product/media → Buyer checkout → Seller fulfillment → Buyer confirmation → Seller report; real provider-backed Buyer OTP/Google/recovery flows; the broad backend/frontend quality gates affected by current concurrent Admin changes. Some Admin integration tests emitted missing-table logs from the local runtime worker during the selected DB run; selected Seller/checkout command exited successfully. Admin files were not changed in this pass.
- Status remains **IN_PROGRESS**. Do not promote all Seller tasks to `DONE` based on implementation or these selected suites alone. No migration, reset or seed was run in this acceptance pass.

### 2026-10-01 — CR-SELLER-01 / Seller operations

- Đã làm:
  - Thêm self-service Shop và kiểm tra điều kiện Admin duyệt; tách Shop pickup address khỏi Buyer delivery address.
  - Nối Seller dashboard KPI, catalog pagination/private detail/edit, order pagination/history, notification, voucher management và revenue report giữa backend runtime/API/OpenAPI với FE.
  - Thêm flow tạo/sửa/thay variant có bảo toàn lịch sử Order; ảnh tạo Product yêu cầu media upload/finalize thật.
  - Các cập nhật sau snapshot `cf2003b`: triển khai Shop logo và sửa/thay/gỡ Product images; thêm UI tests, Seller browser E2E mock API, logo hardening, OpenAPI cập nhật và PostgreSQL image integration test (`38b4501`, `1b7e014`, `2b9f4a6`, `fd353e1`).
  - Cập nhật architecture rules và CR traceability; commit `cf2003b` đã push lên `origin/dev`.
- Quyết định kỹ thuật:
  - Scope Seller lấy từ request identity và Shop ownership phía server; không tin `shop_id` client.
  - Stock tách khỏi Product edit; variant có lịch sử Order chỉ soft-deactivate. Product moderation `HIDDEN` không thể tự re-activate.
  - Report chỉ cộng Order `COMPLETED` theo QD19. Shop logo và Product image editing đã được bổ sung sau lần ghi ban đầu.
- Contract/port thay đổi:
  - CR-SELLER-01 — Seller Shop/catalog/order/notification/voucher/KPI/report operations — **Approved** bởi Chủ dự án 2026-10-01 — triển khai; API/OpenAPI/FE types cập nhật.
- Test đã viết/chạy:
  - REST tests cho Shop/KPI/Voucher/Report/notification/product/orders/moderation — 43 focused tests pass trong lượt trước.
  - PostgreSQL Shop, Voucher, reporting, order, checkout suite được chạy riêng và pass như log CR.
  - Catalog add/remove variant test từng pass ở lượt trước; rerun cuối chỉ hai variant tests có một test xanh (ordered variant retained) và một test lỗi `ETIMEDOUT` trong PostgreSQL remote detail read. Không quy lỗi này thành test assertion pass; cần rerun.
  - Frontend Vitest — 48 files / 274 tests pass; typecheck, lint, build pass. Backend typecheck, lint, build pass. API types generation/check và `git diff --check` pass.
  - Các con số trên là evidence trước nhóm commit bổ sung. Các UI/E2E/PostgreSQL tests mới có trong repo nhưng chưa có kết quả chạy mới được xác nhận trong nhật ký.
- Blocker phát sinh:
  - PostgreSQL test connection timeout đến remote endpoints khi query sau update — cần DB reachable để xác nhận lại variant add/remove — 2026-10-01.
- Còn lại:
  - Chạy lại variant PostgreSQL integration khi DB ổn định và ghi kết quả (lần cuối ghi nhận timeout).
  - Chạy focused UI tests, mocked Seller browser E2E, product image integration và logo/media suites mới; cập nhật pass/fail cụ thể.
  - Hoàn tất backend full Vitest và chạy browser E2E onboarding → Shop approval → Product → Buyer checkout → Seller fulfill → Buyer confirm → report với backend/DB thật. E2E hiện có mock API, chỉ bao phủ Shop profile, Product image edit, voucher và report.

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
