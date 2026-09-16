# CR-0001 — Chọn Prisma ORM 7 và Prisma Migrate 7

- **Trạng thái:** Approved
- **Ngày:** 2026-09-16
- **Owner:** Người 2 — Database và Supabase

## Nội dung đề xuất

Chọn Prisma ORM 7 và Prisma Migrate 7 cho backend. Migration được lưu trong
`backend/prisma/migrations/` và là nguồn triển khai schema duy nhất. Prisma
Client dùng `DATABASE_URL` cho runtime; Prisma Migrate dùng `DIRECT_URL` cho
thao tác migration. Không dùng `prisma db push` và không tạo song song lịch sử
migration bằng Supabase CLI.

## Ảnh hưởng

- Bổ sung Prisma 7, PostgreSQL adapter/driver và `prisma.config.ts`.
- Các CHECK, partial unique index và RLS có thể được bổ sung bằng SQL trong
  migration đã tạo với `--create-only` rồi được review.
- Không quản lý `auth.users` hoặc `storage.*` bằng Prisma Migrate.

## Điều kiện áp dụng

Chỉ áp dụng sau khi trạng thái được đổi thành **Approved** theo quy trình CR.
