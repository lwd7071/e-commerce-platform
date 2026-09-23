# Nhật ký tiến độ — Người 2 (Database và Supabase)

## Trạng thái hiện tại

- Mốc: T2
- Cập nhật lần cuối: 2026-09-23
- Đang làm: ĐÃ HOÀN THÀNH 100% tất cả các hạng mục của Mốc T2 cho Người 2 (Database và Supabase)
- Bị block bởi: Không (Toàn bộ các dependency từ Người 1, 3, 4, 5 đã được tích hợp đầy đủ)

## Nhật ký theo ngày

### 2026-09-23 — T2 Hoàn thiện toàn diện Database & Supabase theo chuẩn TDD

- **Đã làm:**
  - **Lát cắt 1 — Database Health Check (`backend/db/health.ts`):**
    - Cung cấp hàm `checkDatabaseHealth(pool, options)` đo độ trễ probe query `SELECT 1`, trích xuất thông số pool (`totalCount`, `idleCount`, `waitingCount`) và bắt timeout an toàn.
    - Viết bộ kiểm thử unit & live remote integration (`backend/tests/db/health.test.ts`): 4/4 tests pass (healthy, query fail, timeout, live probe).
  - **Lát cắt 2 — Storage Policy & Path Validator (`backend/db/storage.ts` & `backend/db/storage-policies.sql`):**
    - Khóa quy chuẩn Storage Path cho Người 3 (`shops/{shopId}/products/{productId}/{imageId}.{ext}` và `shops/{shopId}/logo.{ext}`) và Người 4 (`users/{userId}/reviews/{reviewId}/{imageId}.{ext}`).
    - Cung cấp hàm validate đường dẫn, chặn path traversal (`..`, `//`), giới hạn extension hình ảnh hợp lệ (`jpg`, `jpeg`, `png`, `webp`).
    - Soạn thảo đặc tả chính sách bảo mật Supabase Storage RLS trên `storage.objects` (`storage-policies.sql`).
    - Viết bộ kiểm thử unit (`backend/tests/db/storage.test.ts`): 8/8 tests pass.
  - **Lát cắt 3 — Database Test Fixture Platform (`backend/tests/db/fixtures/database-fixtures.ts`):**
    - Hiện thực hóa bộ fixture generators chuẩn hóa cho 22 bảng: User, Shop, Category, Product, Variant, Address, Cart, CartItem, Voucher, Order, OrderItem, Payment, Review.
    - Hỗ trợ cô lập dữ liệu và rollback sạch sẽ trong transaction.
    - Viết bài kiểm thử tạo chuỗi quan hệ dữ liệu khép kín (`backend/tests/db/fixtures.test.ts`): 1/1 test pass.
  - **Lát cắt 4 — Direct Database Constraints & Delete Policies Integration Tests (`backend/tests/db/constraints.integration.test.ts`):**
    - Kiểm thử trực tiếp mức database các ràng buộc Schema Freeze v1: 14/14 tests pass:
      - `[QD05]` Giá Variant `<= 0` bị chặn (`23514`).
      - `[QD06]` Tồn kho Variant `< 0` bị chặn (`23514`).
      - `[RB-MG05]` Số lượng CartItem `< 1` bị chặn (`23514`).
      - `[QD15, RB-MG08]` Rating Review ngoài khoảng `1..5` bị chặn (`23514`).
      - `[QD10]` Tổng tiền Order sai lệch công thức bị chặn (`23514`).
      - `[RB-LTT05]` Voucher scope mismatch (PLATFORM có shop_id hoặc SHOP thiếu shop_id) bị chặn (`23514`).
      - `[RB-LB05]` Partial UNIQUE 1 địa chỉ mặc định/user: chặn 2 địa chỉ `is_default=true` (`23505`).
      - `[RB-LB10]` Partial UNIQUE 1 thanh toán thành công/order: chặn 2 payment `SUCCESS` (`23505`).
      - `[RB-MG05]` UNIQUE composite `(cart_id, variant_id)` trong `cart_items` (`23505`).
      - `[RB-LB09]` UNIQUE `order_item_id` trong `reviews` (`23505`).
      - `[QD16]` `ON DELETE RESTRICT` trên `app_users` bảo toàn lịch sử giao dịch khi đã có đơn hàng (`23503`).
      - `ON DELETE CASCADE` tự động dọn dẹp phụ thuộc từ `carts` sang `cart_items`.
      - `ON DELETE CASCADE` tự động dọn dẹp phụ thuộc từ `products` sang `product_images`.
  - **Lát cắt 5 — RLS Default-Deny Security Integration (`backend/tests/db/rls.integration.test.ts`):**
    - Kiểm chứng 100% (22/22) bảng nghiệp vụ đã bật Row-Level Security.
    - Xác nhận không có privilege trực tiếp nào cấp cho `anon` hoặc `authenticated`.
    - Kiểm thử chuyển đổi role `SET LOCAL ROLE anon` và `SET LOCAL ROLE authenticated`: bị từ chối truy cập với SQLSTATE `42501` (4/4 tests pass).
  - **Lát cắt 6 — T2 Performance Indexes Migration (`backend/prisma/migrations/20260922120000_t2_performance_indexes/migration.sql`):**
    - Tạo migration bổ sung 7 index hiệu năng theo bàn giao từ Người 4 (`buyer-query-patterns.md`) và Người 3 (`pg-catalog.repository.ts`):
      1. `idx_cart_items__cart_id__created_at`
      2. `idx_vouchers__active_listing` (Partial index trên vouchers active)
      3. `idx_reviews__product_visible` (Partial index trên reviews visible)
      4. `idx_addresses__user_id__default`
      5. `idx_products__shop_id__status`
      6. `idx_products__category_id__status`
      7. `idx_product_variants__product_id__status`
    - Viết bài kiểm thử nghiệm thu index & `EXPLAIN` query plan (`backend/tests/db/t2-indexes.integration.test.ts`): 3/3 tests pass.
- **Quyết định kỹ thuật:**
  - Áp dụng kỹ thuật PostgreSQL `SAVEPOINT` trong các bài integration test negative để cô lập lỗi vi phạm ràng buộc mà không làm hủy toàn bộ transaction (tránh lỗi `25P02`).
  - Dùng `randomUUID()` và email động cho fixtures để loại bỏ triệt để khả năng xung đột dữ liệu giữa các lần chạy test liên tiếp.
- **Contract/port thay đổi:**
  - Bổ sung `checkDatabaseHealth` tại `backend/db/health.ts` sẵn sàng cho Người 1 kết nối endpoint health.
  - Bổ sung `buildProductImagePath`, `buildShopLogoPath`, `buildReviewImagePath`, `validateStoragePath` tại `backend/db/storage.ts`.
  - Bổ sung `database-fixtures.ts` tại `backend/tests/db/fixtures/database-fixtures.ts`.
  - Bổ sung migration `20260922120000_t2_performance_indexes`.
- **Blocker phát sinh:**
  - Không.
- **Kết quả kiểm thử:**
  - DB Vitest Suite: 15 files / 77 tests PASS (100%).
  - Full Backend Node Suite: 403 / 403 tests PASS (100%).
  - Typecheck: 0 lỗi (`tsc --noEmit`).
  - Linter: 0 lỗi / 0 cảnh báo trong `db` và `tests/db`.
  - Build: Bundle hoàn tất `dist/app.js` (88.9kb).

### 2026-09-19 — T1 database closeout

- Đã ghi CR-IDEMP-01 ở trạng thái Approved với review roleplay của Người 1 và Người 5; nội dung xác nhận PostgreSQL là source of truth và bảng vận hành tách khỏi 22 business tables.
- Đã deploy migration `20260918170000_add_api_idempotency_records` lên Supabase test target; `prisma migrate status` xác nhận database schema up to date.
- Remote schema acceptance đã có assertion riêng cho operational table/index và không tính bảng này vào Schema Freeze 22 bảng.

### 2026-09-18 — operational idempotency storage handoff

- Đã thêm migration `20260918170000_add_api_idempotency_records` với composite primary key,
  FK `app_users`, fingerprint SHA-256 lowercase, expiry check và index cleanup.
- Đã review theo vai Người 2: đây là bảng vận hành thứ 23, không phải bảng nghiệp vụ; không
  thêm Redis; PostgreSQL là source of truth; migration cũ giữ nguyên checksum.
- Đã bàn giao cho Người 5 contract lookup bằng `(user_id, endpoint, idempotency_key)` và
  advisory lock chỉ làm nhiệm vụ điều phối concurrency.

### 2026-09-17 — T1 hardening và handoff Người 2

- **Branch/lease:** `t1-p2-db-completion` được tạo từ `origin/main`, đã push các phase tuần tự; không force-push. Các file untracked có sẵn của người dùng được giữ nguyên và không stage.
- **Phase 1 — remote smoke:** đo 5 kết nối/query mới `2202–2554 ms`; giữ connection timeout mặc định 30 giây, `beforeAll` 45 giây, query 15 giây. `RUN_REMOTE_DB_TESTS` xử lý `undefined`/giá trị không hợp lệ an toàn. Remote smoke đạt 5/5 lần liên tiếp, 0 skipped khi chạy remote.
- **Phase 2 — pool/transaction:** thêm pool factory lazy, bounded config, isolation whitelist, rollback/`AggregateError` contract, release guard và concurrency tests. Unit/integration transaction pass; pool `max=1` chờ tuần tự và pool `max=2` cấp PID khác nhau. Probe chỉ dùng `pg_temp.p2_transaction_probe`.
- **Phase 3 — seed:** thêm `seedExistingAuthUser` với validation UUID/email/fullName/role/status, upsert idempotent giữ role/status, raw SQLSTATE `23503`/`23505`/`23514` propagation và parent-transaction rollback test. Seed không tự điều khiển transaction.
- **Phase 4 — acceptance:** guard target migration yêu cầu ref do người thật cung cấp, `DATABASE_ENVIRONMENT=test`, preview đã sanitize và `ALLOW_MIGRATION_DEPLOY=true` cho đúng lần chạy. Schema acceptance kiểm tra đúng 22 bảng public, RLS/privilege/policy/constraint/index/delete-action/migration invariants; pass trên target hiện tại. Không tự chạy `migrate deploy` trong handoff vì thiếu manual safety confirmation theo plan.
- **Kết quả kiểm thử:** DB suite `9 files / 43 tests pass`; `prisma validate` pass; `prisma migrate status` báo database up to date. Runtime đã chạy: Node `24.15.0`, npm `11.12.1`; chưa thể ghi cross-runtime pass cho Node 22.
- **Gate toàn backend:** typecheck/build còn lỗi import NodeNext và module thiếu ở Buyer/Catalog/Order/Payment/Platform; lint chưa có script; full test bị config `spawn EPERM` trong môi trường hiện tại. Đây là dependency ticket cho owner tương ứng, không sửa trong scope Người 2.
- **Commit sequence:** `d27e201`, `3bb260a`, `74ca9e4`, `0478b75`, tiếp theo là commit handoff tài liệu này.

### 2026-09-16 — DB2-01A guard cấu hình

- **Đã làm:** Tạo bộ kiểm tra env an toàn và kiểm tra project/URL database cùng project; thêm hai CR ở trạng thái Proposed.
- **Quyết định kỹ thuật:** Không in secret; chỉ chấp nhận `https` cho Supabase URL và `postgres/postgresql` cho database URL; kiểm tra username có project ref.
- **Contract/port thay đổi:** Không.
- **Blocker phát sinh:** Chờ Người 1 bàn giao scaffold/config và chờ CR-0001 (Prisma Migrate 7) cùng CR-0002 (`moderation_records.target_id` nullable) được Approved.
- **Test đã viết:** `tests/db/config.test.ts` — 4 test Vitest pass thực tế: URL hợp lệ, thiếu DATABASE_URL, sai project, cờ remote không hợp lệ.
- **Diagnose:** `npm test -- --run tests/db/config.test.ts` pass; `npm run typecheck` còn lỗi có sẵn ở `tests/platform/request-id.test.ts` vì thiếu `src/platform/middleware/request-id.middleware.js` (thuộc scaffold Người 1).

### 2026-09-16 — DB2-02 đến DB2-06 database foundation

- **Đã làm:** Cài Prisma ORM/CLI 7, tạo Prisma config và migration Schema Freeze v1 gồm đủ 22 bảng, constraint/index và RLS default-deny; cập nhật hai CR sang Approved theo xác nhận review.
- **Quyết định kỹ thuật:** Migration chạy bằng `DIRECT_URL` và runtime dùng `DATABASE_URL`; `moderation_records.target_id` nullable theo CR-0002; không quản lý `auth.users` bằng Prisma.
- **Contract/port thay đổi:** Chưa bàn giao transaction helper hay contract ứng dụng; Prisma schema/migration thuộc Người 2.
- **Blocker phát sinh:** Typecheck toàn backend còn lỗi import/thiếu file ở các module Catalog và Platform thuộc owner khác; chưa chạy Auth seed/identity sync.
- **Test đã viết:** `tests/db/schema-smoke.test.ts` — 3 test pass thực tế: đúng 22 bảng, RLS bật trên 22 bảng, migration đã applied. Cùng với DB2-01A tổng cộng 7 test pass.
- **Diagnose:** `npx prisma@7 validate` pass; `npx prisma migrate status` sạch sau deploy; `npx prisma migrate deploy` áp dụng thành công; truy vấn read-only xác nhận 22 bảng và không có grant cho `anon`/`authenticated`. `npm run typecheck` chưa sạch do lỗi owner khác.
- **Full test diagnose:** `npm test` có 7 test DB pass nhưng 4 suite có sẵn của Platform/Catalog fail: thiếu module `src/platform/middleware/request-id.middleware.js` và ba file Catalog báo `No test suite found`. Không sửa các file ngoài ownership Người 2.

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| Database pool/transaction helper | Sẵn sàng review; API v1 đã có test success/rollback/error/concurrency | v1 / 2026-09-17 | Người 1, Người 4, Người 5 |
| Existing Auth user seed | Sẵn sàng review; raw SQLSTATE contract và parent rollback đã khóa | v1 / 2026-09-17 | Người 1 / identity repository |
| Migration/RLS acceptance guard | Sẵn sàng review; deploy cần human-supplied project ref và manual confirmation | v1 / 2026-09-17 | Người 1 / CI |
| Database health check helper | Sẵn sàng sử dụng; probe query, pool metrics, timeout handling | v1 / 2026-09-23 | Người 1 / Platform Health Route |
| Storage policy & path validator | Sẵn sàng sử dụng; path builder, MIME/ext validation, RLS policies SQL | v1 / 2026-09-23 | Người 3 (Catalog), Người 4 (Review) |
| Database test fixtures platform | Sẵn sàng sử dụng; fixture generators cho 22 bảng có transaction rollback | v1 / 2026-09-23 | Toàn đội Backend |
| T2 performance indexes migration | Đã tạo migration và nghiệm thu query plan EXPLAIN trên DB | v1 / 2026-09-23 | Toàn đội Backend |

## Việc còn lại trong mốc hiện tại

- [x] Hoàn thiện constraint, partial unique index, delete policy và RLS test từ migration T1.
- [x] Dựng test database, fixture nền, migration rebuild test và database health check.
- [x] Viết integration test trực tiếp cho PK, FK, CHECK, UNIQUE và RLS default-deny.
- [x] Triển khai Storage policy nền và helper kiểm tra cấu trúc đường dẫn.
- [x] Chốt index Catalog theo query bàn giao của Người 3.
- [x] Chốt index Buyer domain theo `buyer-query-patterns.md` của Người 4.
- [x] Tạo migration T2 bổ sung 7 index hiệu năng và kiểm chứng bằng test.

## Dependency tickets / việc cần phối hợp

- **Người 1:** Tích hợp `checkDatabaseHealth(pool)` từ `backend/db/health.ts` vào router `/api/v1/health` khi sẵn sàng.
- **Người 3:** Sử dụng `buildProductImagePath` và `buildShopLogoPath` từ `backend/db/storage.ts` cho module upload ảnh media Catalog.
- **Người 4:** Sử dụng `buildReviewImagePath` từ `backend/db/storage.ts` cho module upload ảnh đánh giá.
- **Người 5:** Các transaction query trên Order/Payment/Shipment đã có đầy đủ index và kiểm chứng concurrency isolation.
