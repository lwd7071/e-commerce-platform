# Nhật ký tiến độ — Người 2 (Database và Supabase)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-16
- Đang làm: DB2-06B — migration Schema Freeze v1 đã deploy và smoke test database pass
- Bị block bởi: Chờ hoàn thiện scaffold/typecheck của Người 1; chưa có seed/Auth sync và transaction helper của ứng dụng

## Nhật ký theo ngày

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

Chưa có mục bàn giao được xác nhận trong nhật ký này.

## Việc còn lại trong mốc hiện tại

- [ ] Chuyển đủ 22 bảng Schema Freeze v1 thành migration SQL; xác định PK, FK, CHECK, UNIQUE và partial unique index bắt buộc.
- [ ] Soạn RLS default-deny policy, seed tối thiểu, Supabase Auth/Storage configuration mẫu và `.env.example`.
- [ ] Xác định interface cho database client, transaction helper và test database.
- [ ] Sau khi Người 1 hoàn thành scaffold và cấu trúc config: tích hợp migration, database client và transaction helper.
- [ ] Sau khi Người 1 hoàn thành test runner và CI skeleton: tích hợp migration CI.
- [ ] Sau khi Người 1 khóa `RequestContext` và identity repository interface: chạy auth seed và identity sync test.
- [ ] Sau khi Người 3, 4 và 5 công bố query pattern: kiểm tra query/index theo từng domain.
