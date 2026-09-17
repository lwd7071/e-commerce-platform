# Nhật ký tiến độ — Người 2 (Database và Supabase)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-17
- Đang làm: T1 database hardening đã hoàn tất trên branch `t1-p2-db-completion`; chờ review/merge và xác nhận runtime Node 22 của Người 1
- Bị block bởi: Chưa được phép chạy migration deploy acceptance nếu chưa có `EXPECTED_SUPABASE_PROJECT_REF` do người thật cung cấp và xác nhận target disposable; full backend gates còn lỗi owner khác

## Nhật ký theo ngày

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

## Việc còn lại trong mốc hiện tại

- [x] Chuyển đủ 22 bảng Schema Freeze v1 thành migration SQL; xác định PK, FK, CHECK, UNIQUE và partial unique index bắt buộc.
- [x] Soạn RLS default-deny guard, seed tối thiểu, Supabase Auth/Storage configuration mẫu và `.env.example`.
- [x] Xác định interface cho database client, transaction helper và test database.
- [x] Tích hợp migration, database client và transaction helper; acceptance deploy còn chờ manual target confirmation.
- [ ] Sau khi Người 1 hoàn thành test runner và CI skeleton: tích hợp migration CI.
- [ ] Sau khi Người 1 khóa `RequestContext` và identity repository interface: chạy auth seed và identity sync test.
- [ ] Sau khi Người 3, 4 và 5 công bố query pattern: kiểm tra query/index theo từng domain.

## Dependency tickets / việc cần phối hợp

- **Người 1:** pin Node `22.20.x`/npm `11.x`, hoàn thiện shared config/CI, `RequestContext` và identity repository; sau đó chạy lại full backend gates.
- **Người 3:** không thêm `sale_price` nếu chưa có CR Approved; email case-insensitive cần CR riêng nếu muốn đổi constraint.
- **Người 4:** dùng cùng `PoolClient` transaction contract cho Voucher decrement + usage.
- **Người 5:** xử lý `40001`/`40P01` ở orchestration/idempotency layer; T1 helper không retry.
- **Human gate:** cung cấp độc lập `EXPECTED_SUPABASE_PROJECT_REF` và xác nhận target disposable trước bất kỳ `migrate deploy` nào.
