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

Mục đích: Không bao giờ cho phép một container/process production khởi động khi cấu hình bảo mật hoặc database chưa hoàn chỉnh, tránh rủi ro mở cổng mà không thể xác thực an toàn.

---

## 3. Mẫu File Cấu hình `.env.example`

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce_dev
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_AUDIENCE=authenticated
CORS_ORIGIN=http://localhost:3000
```

---

## 4. Lệnh Vận hành & Quality Gates

### Chạy phát triển (Local Development)
```bash
npm run dev
```

### Chạy kiểm thử toàn bộ (All Native Tests)
```bash
npm run test:node
```

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
