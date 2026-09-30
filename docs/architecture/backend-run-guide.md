# Hướng dẫn Vận hành Backend & Cấu hình Môi trường (Backend Run Guide)

Tài liệu này hướng dẫn thiết lập biến môi trường, khởi chạy ứng dụng và quy chuẩn an toàn fail-fast trong các môi trường development, test và production.

---

## 1. Danh mục Biến môi trường (Environment Variables)

| Tên biến | Bắt buộc (Prod) | Giá trị mặc định (Dev) | Ý nghĩa |
|---|:---:|---|---|
| `NODE_ENV` | Có | `development` | Môi trường thực thi (`development`, `test`, `production`). |
| `DATABASE_URL` | Có | `postgresql://...` | Connection URI tới PostgreSQL database pool. |
| `SUPABASE_URL` | Có | N/A | Base URL của Supabase project (ví dụ `https://xyz.supabase.co`). |
| `SUPABASE_JWKS_URL` | Có | N/A | URL endpoint JWKS chứa public keys để verify JWT token. |
| `SUPABASE_JWT_AUDIENCE` | Không | `authenticated` | Audience claim JWT hợp lệ. |
| `PORT` | Không | `3000` | Port HTTP server lắng nghe. |
| `CORS_ORIGIN` | Có | `http://localhost:3000` | Danh sách origin cho phép CORS. |

---

## 2. Cơ chế Kiểm tra Fail-Fast khi Khởi động

Theo quy chuẩn Phase 6 (`validateEnvConfig`), khi ứng dụng chạy ở môi trường `NODE_ENV=production`:
- Nếu thiếu `DATABASE_URL`: Server dừng ngay lập tức và ném lỗi `DATABASE_CONFIGURATION_ERROR`.
- Nếu thiếu `SUPABASE_URL` hoặc `SUPABASE_JWKS_URL`: Server dừng ngay lập tức và ném lỗi `AUTH_CONFIGURATION_ERROR`.
- Nếu thiếu `TRUST_PROXY`: Server dừng ngay lập tức và ném lỗi `CONFIGURATION_ERROR` (bắt buộc cấu hình số hop e.g. `1` hoặc CIDR proxy để ngăn chặn giả mạo IP và bảo vệ rate limiter).

Mục đích: Không bao giờ cho phép một container/process production khởi động khi cấu hình bảo mật hoặc database chưa hoàn chỉnh, tránh rủi ro mở cổng mà không thể xác thực an toàn.

---

## 3. File môi trường dùng chung

Backend và frontend dùng duy nhất `/.env` ở root repository. Sao chép root `.env.example` thành `.env`; không tạo `backend/.env`, `frontend/.env.local` hoặc template riêng theo từng ứng dụng. Backend server, Prisma, integration tests và các script nạp root env; Next.js cũng nạp root env qua `frontend/next.config.ts`.

Frontend chỉ nhận các biến có tiền tố `NEXT_PUBLIC_`. Không đặt Supabase secret key, database URL, Google Client Secret hoặc SMTP app password vào các biến public. Google OAuth và SMTP credentials được cấu hình trực tiếp trong Supabase Dashboard.

```dotenv
cp .env.example .env
```

---

## 4. Lệnh Vận hành & Quality Gates

### Chạy phát triển (Local Development)
```bash
npm run dev
```

### Khởi chạy Production Server
```bash
npm start
```

### Chạy kiểm thử toàn bộ (All Native Tests)
```bash
npm run test:node
```

### Chạy kiểm thử Transaction PostgreSQL thật
```bash
npm run test:transaction:pg
```

### Seed danh mục development/test cho FE

FE dùng ba category UUID cố định trong development fixtures để thử filter và tạo sản phẩm. Backend có command seed idempotent dành riêng cho development/test; script từ chối `NODE_ENV=production`, yêu cầu xác nhận project ref và cờ cho phép tường minh. Script chỉ insert khi ID chưa tồn tại và sẽ rollback nếu các ID đó đang thuộc danh mục có dữ liệu khác.

Chỉ chạy sau khi đã xác nhận `SUPABASE_URL`, `DATABASE_URL`, `DIRECT_URL` cùng trỏ tới project development/test mong muốn:

```dotenv
NODE_ENV=development
DATABASE_ENVIRONMENT=development
EXPECTED_SUPABASE_PROJECT_REF=<project-ref-development-da-xac-minh>
ALLOW_DEVELOPMENT_CATEGORY_SEED=true
```

Sau khi cấu hình các biến database trong root `.env`, chạy từ `backend/`:

```bash
npm run db:seed:dev-categories
```

| Category UUID | Tên |
|---|---|
| `00000000-0000-0000-0000-000000000010` | Mỹ phẩm & Chăm sóc sắc đẹp |
| `00000000-0000-0000-0000-000000000011` | Thời trang & Phụ kiện |
| `00000000-0000-0000-0000-000000000012` | Thiết bị điện tử |

Đây là dữ liệu fixture dev/test, không chạy trên production. Seed không tạo `GET /categories`; FE chỉ dùng UUID sau khi seed thành công vào đúng database mà API đang đọc.

### Kiểm tra kiểu tĩnh (TypeScript Typecheck)
```bash
npm run typecheck
```

### Kiểm tra cú pháp (ESLint)
```bash
npm run lint
```

### Build gói production (Production Bundle)
```bash
npm run build
```
