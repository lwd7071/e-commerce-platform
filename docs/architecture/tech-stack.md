# Canonical Tech Stack

## Trạng thái và nguồn chuẩn

Đây là nguồn chuẩn về runtime, framework, package manager và tooling của repository. Ranh giới kiến trúc và business rule vẫn theo [`rules/architecture-decisions.md`](rules/architecture-decisions.md), Schema Freeze và các Change Request Approved.

Mọi thay đổi runtime hoặc framework phải cập nhật đồng thời file này, manifest, lockfile, CI và `CONTRIBUTING.md` qua pull request.

## Runtime và package manager

| Thành phần | Version chuẩn | Trạng thái |
|---|---:|---|
| Node.js | `22.20.0` | Bắt buộc |
| npm | `11.12.1` | Bắt buộc |
| TypeScript backend | `5.8.x` | Đã dùng |
| TypeScript frontend | `5.8.x` | Đã dùng |

Node 20 và Node 24 không được dùng để xác nhận CI T1. Lockfile chỉ được sinh bằng npm `11.12.1`.

## Frontend

| Thành phần | Version/trạng thái |
|---|---|
| Next.js | `16.3.5` |
| React / React DOM | `19.2.8` |
| Tailwind CSS | `4.x` |
| Lucide React | Theo lockfile |
| Deployment | Vercel, chưa coi là hoàn tất nếu chưa có cấu hình deploy |

Next.js sở hữu UI và session phía trình duyệt. Frontend gọi backend qua `/api/v1`, không chứa database URL, service-role key hoặc business rule quyết định cuối cùng.

## Backend và CMS

| Thành phần | Version/trạng thái |
|---|---|
| Node.js | `22.20.0` |
| Payload CMS | `3.89.x`, package đã có; CMS bootstrap thực tế chưa hoàn tất |
| Express | `4.21.x` |
| esbuild | `0.25.x` |
| API | REST `/api/v1` |

Payload/Node.js xác minh JWT, RBAC, ownership, transaction, audit và business logic. Payload CMS content chỉ quản lý banner, campaign, FAQ và nội dung marketing; không chứa checkout/order/payment logic.

## Supabase và database

| Thành phần | Version/trạng thái |
|---|---|
| Supabase Auth | Nguồn định danh duy nhất |
| Supabase PostgreSQL | Nguồn dữ liệu chuẩn |
| Supabase Storage | Avatar, shop logo, product/review image |
| Prisma ORM/Migrate | `7.10.x` |
| PostgreSQL driver | `pg 8.23.x` |

- Prisma Migrate là nguồn migration duy nhất.
- Runtime dùng `DATABASE_URL`; migration dùng `DIRECT_URL`.
- Không dùng `prisma db push`.
- Không quản lý `auth.users` hoặc `storage.*` bằng Prisma migration.
- `@supabase/supabase-js` chưa được tự thêm nếu chưa có use case và pull request cụ thể.

## Testing

| Nhóm | Runner |
|---|---|
| Platform/Buyer/Transaction native suites | `node:test` qua `tsx` |
| Database và Catalog Vitest suites | Vitest `3.x` |
| Browser E2E | Playwright — planned, chưa cài |

Hai runner là trạng thái chuyển tiếp đến review cuối T2. Remote DB suite bắt buộc chạy trên push `dev`/`main`; PR có thể chỉ chạy unit/integration không cần remote credentials.

## Dependency boundaries

- Next.js không đọc hoặc ghi trực tiếp bảng nghiệp vụ.
- Payload là điểm duy nhất ghi dữ liệu nghiệp vụ từ ứng dụng.
- Supabase Auth là nguồn user identity; `auth.users.id` ánh xạ vào `app_users.user_id`.
- PostgreSQL enforce PK/FK/UNIQUE/CHECK/index; backend sở hữu business authorization và transaction boundary.
- Thay đổi stack không được tự động kéo theo thay đổi Schema Freeze.
