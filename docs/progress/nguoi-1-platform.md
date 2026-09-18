# Nhật ký tiến độ — Người 1 (Platform và Integration Lead)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-18
- Đang làm: Hoàn thành Phase 1 - 5 nền tảng T1, chờ Người 2 bàn giao DB app_users và Người 3/4/5 wiring routes
- Bị block bởi: Không (Phần làm ngay của T1 đã hoàn thành; phần chờ Người 2, 3, 4, 5 sẽ tiến hành khi có bàn giao)

## Nhật ký theo ngày

### 2026-09-18 (Khắc phục GitHub Actions Backend quality)

- Đã làm:
  - Điều tra hai commit Transaction mới (`6a8457b`, `0be6b7a`) bị GitHub Actions báo `1/3 checks`.
  - Xác định Backend quality dừng ngay tại bước `npm ci`, trước lint/typecheck/test, với lỗi `npm error Invalid Version:`.
  - Tái hiện được lỗi bằng `npm ci --dry-run` trên workspace.
  - Phân tích `backend/package-lock.json` và phát hiện nhiều optional dependency entries thiếu trường `version`, chủ yếu trong cây `esbuild`, `rollup` và `fsevents`.
  - Regenerate `backend/package-lock.json` từ `backend/package.json`; lockfile mới không còn entry package thiếu version và `npm ci --dry-run` đã pass.
- Quyết định kỹ thuật:
  - Giữ nguyên workflow Node `22.20.0` và npm `11.12.1`; sửa nguồn gây lỗi là lockfile thay vì bỏ qua `npm ci` hoặc nới quality gate.
  - Không thay đổi dependency trực tiếp hay hành vi runtime; chỉ chuẩn hóa metadata lockfile để Linux CI và local npm cùng resolve được dependency tree.
- Contract/port thay đổi:
  - Không.
- Blocker phát sinh:
  - Không.
- Test đã chạy:
  - `npm ci --dry-run --ignore-scripts --no-audit --no-fund` — pass sau khi regenerate lockfile.
  - Backend quality trước đó fail tại `Install backend dependencies`; lint/typecheck/build/test bị skip do `npm ci` fail.
  - Local full backend suite trên cùng commit — Node 229/229 pass, Vitest 14 suites / 78 tests pass, typecheck/build pass.

### 2026-09-17

- Đã làm:
  - Soạn thảo và đệ trình Change Request `CR-ARCH-01` tách bạch Node.js/Express REST API core và Payload CMS content service.
  - Khởi tạo toolchain: `package.json`, `tsconfig.json` (Bundler mode, noEmit), `eslint.config.js` (Flat config v9), `.github/workflows/ci.yml`.
  - Triển khai API envelope chuẩn (`SuccessEnvelope`, `PaginatedEnvelope`, `ErrorEnvelope`) và `GET /api/v1/health`.
  - Xây dựng middleware `requestIdMiddleware` xác thực regex `^req_[a-zA-Z0-9_-]{4,60}$`, xử lý 3 nhánh valid/missing/invalid.
  - Xây dựng hệ thống error catalog (`AppError`), middleware `errorHandlerMiddleware` bắt Malformed JSON (400) và 500 che giấu DB internals.
  - Xây dựng hàm `redactSensitiveData` và `createPlatformLogger` làm sạch `otp`, `password`, `token`, `secret`, `api_key`, `card`.
  - Triển khai `RequestContext` bất biến `Object.freeze`, quy tắc gán `shop_id` độc quyền cho `SELLER` (`BUYER`/`ADMIN` là undefined).
  - Triển khai `createAuthMiddleware` bảo vệ chốt chặn an ninh `QD03` (`USER_LOCKED` trả 403), fail-fast `AUTH_CONFIGURATION_ERROR` trên production.
  - Khóa thư mục `src/contracts` dùng chung, re-export các ports của Catalog, Cart, Voucher, Audit.
  - Soạn thảo tài liệu `docs/architecture/api-initial-spec.md`.
  - Mở Dependency Ticket `DEP-01` gửi Người 3 về việc dọn dẹp thư mục duplicate `backend/tests/`.
- Quyết định kỹ thuật:
  - Chọn Phương án 1 Bundler + esbuild cho `tsconfig` và build bundle ra `dist/app.js` — Lý do: Giải quyết triệt để 12 lỗi TS2835 và 7 lỗi TS5097 mà không xâm lấn sửa file Người 3/4.
  - Sử dụng native `node:test` + `tsx` cho mốc T1 — Lý do: Đồng bộ và bảo toàn 100% test suite hiện có của Catalog và Buyer.
- Contract/port thay đổi:
  - `RequestContext`: Khóa interface bất biến (`request_id`, `user_id`, `role`, `shop_id?`) — Trạng thái: Đã khóa — Ảnh hưởng: Người 2, 3, 4, 5.
  - `ICatalogPort`: Re-export từ Người 3 sang `@/contracts` — Trạng thái: Đã khóa — Ảnh hưởng: Người 5.
  - `ICartPort` & `IVoucherPort`: Re-export từ Người 4 sang `@/contracts` — Trạng thái: Đã khóa — Ảnh hưởng: Người 5.
  - `IAuditPort`: Khóa interface ghi `AdminAuditRecord` — Trạng thái: Đã khóa — Ảnh hưởng: Người 5.
- Blocker phát sinh:
  - Dependency Ticket `DEP-01`: Thư mục `backend/tests/` bị duplicate 100% từ Catalog — Cần: Người 3 gộp/xóa — Từ ngày: 2026-09-17 (Platform đã cấu hình CI/tsconfig/eslint ignore để không ảnh hưởng kiểm thử).
- Test đã viết:
  - `[API-ENV-01]` -> `[API-ENV-05]`: Envelope & Health endpoint — Integration — Kết quả: pass
  - `[ERR-01]` -> `[ERR-04]`, `[LOG-01]`, `[LOG-02]`: Error Handling & Redaction (có OTP) — Integration — Kết quả: pass
  - `[AUTH-01]` -> `[AUTH-08]`, `QD03`, `RB-MG01`, `QD02`: RequestContext & Auth Guard — Integration — Kết quả: pass
  - `[CONTRACT-01]`, `[CONTRACT-02]`: Shared contracts re-export — Unit/Contract — Kết quả: pass

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| `RequestContext` | Đã khóa | v1 / 2026-09-17 | Người 2, 3, 4, 5 |
| `api-envelope` | Đã khóa | v1 / 2026-09-17 | Người 3, 4, 5 |
| `IAuditPort` | Đã khóa | v1 / 2026-09-17 | Người 5 |
| `ICatalogPort` (Re-export) | Đã khóa | v1 / 2026-09-17 | Người 5 |
| `ICartPort` (Re-export) | Đã khóa | v1 / 2026-09-17 | Người 5 |
| `IVoucherPort` (Re-export) | Đã khóa | v1 / 2026-09-17 | Người 5 |

## Việc còn lại trong mốc hiện tại

- [x] Scaffold Payload/Node.js backend, cấu trúc module, `package.json` và TypeScript.
- [x] Thiết lập test runner, lint, typecheck, build và CI skeleton.
- [x] Cài API envelope, request ID, error middleware và health endpoint.
- [x] Định nghĩa `RequestContext`, shared contract folder, naming convention và Auth repository interface; khóa contract dùng chung và soạn tài liệu API ban đầu.
- [ ] Sau khi Người 2 bàn giao migration `app_users`, seed User và database connection: xác minh Supabase JWT, chặn User `LOCKED` và chạy auth smoke test.
- [ ] Sau khi Người 3 khóa endpoint DTO và Catalog port: wiring route Catalog.
- [ ] Sau khi Người 4 khóa Cart/Voucher port: wiring route Cart/Voucher.
- [ ] Sau khi Người 5 khóa checkout/order command và response contract: wiring route checkout/order.
