# Nhật ký tiến độ — Người 1 (Platform và Integration Lead)

## Trạng thái hiện tại

- Mốc: T2
- Cập nhật lần cuối: 2026-09-21
- Đang làm: Hoàn thành Phase 1, Phase 2, Phase 3, Phase 4 (Admin Lock/Unlock endpoints); chuẩn bị Phase 5 (ESLint 9 tech-stack.md và Quality Gates)
- Bị block bởi: Không

## Nhật ký theo ngày

### 2026-09-21 (T2 Phase 4 — Admin User Lock & Unlock Endpoints)

- Đã làm:
  - Xây dựng router `src/platform/http/routes/admin-routes.ts` bọc qua middleware RBAC `requireRole('ADMIN')` cho 2 endpoints:
    - `POST /api/v1/admin/users/:id/lock`
    - `POST /api/v1/admin/users/:id/unlock`
  - Tích hợp chuẩn xác `ModerationService.moderateTarget` với đầy đủ context người thực hiện (`admin_id` từ `req.context.user_id`), ghi nhận audit log và trả về envelope thành công chuẩn:
    `{ data: { user_id, status, updated_at }, request_id }`.
  - Mount `createAdminRouter` vào `src/platform/http/app.ts` và mở rộng `T1RouteApplications` hỗ trợ `moderation?: IModerationService`.
  - Viết bộ test `test/platform/admin-routes.spec.ts` gồm 12 test cases:
    - TDD Cycle 4.1 (Lock User): 7 cases (401 unauth, 403 non-admin role, 422 missing reason QD17, 404 user not found RB-KN20, 409 already locked, 200 success lock, 403 USER_LOCKED enforcement QD03 khi user bị khóa gọi protected route).
    - TDD Cycle 4.2 (Unlock User): 5 cases (403 non-admin role, 422 missing reason QD17, 404 user not found RB-KN20, 409 already active, 200 success unlock).
  - Toàn bộ 12/12 tests của Phase 4 đều PASS. Tổng bộ unit tests đạt 320/320 PASS.
- Quyết định kỹ thuật:
  - Sử dụng middleware RBAC `requireRole('ADMIN')` để bảo vệ tài nguyên admin ngay từ lớp HTTP routing trước khi đi vào domain service.
  - Kiểm chứng chặt chẽ quy định QD03: Ngay sau khi admin khóa tài khoản, request tiếp theo từ user đó (kể cả có mang token hợp lệ) đều bị chặn đứng với mã lỗi 403 `USER_LOCKED`.
- Contract/port thay đổi:
  - Cung cấp 2 HTTP routes mới: `POST /api/v1/admin/users/:id/lock` và `POST /api/v1/admin/users/:id/unlock`.
- Blocker phát sinh:
  - Không.
  - Đã tích hợp file cấu hình `.env` cho database vào `backend/.env`, bảo đảm an toàn qua `.gitignore`.
- Test đã viết:
  - `[ADMIN-01]` -> `[ADMIN-07]`: Admin Lock User (401, 403, 422 QD17, 404 RB-KN20, 409 USER_ALREADY_LOCKED, 200 OK envelope, 403 QD03 USER_LOCKED enforcement) — Unit test — Kết quả: pass.
  - `[ADMIN-08]` -> `[ADMIN-12]`: Admin Unlock User (403, 422 QD17, 404 RB-KN20, 409 USER_ALREADY_ACTIVE, 200 OK envelope) — Unit test — Kết quả: pass.

### 2026-09-21 (T2 Phase 3 — Audit Logging Adapter & ModerationService Atomic Transaction)

- Đã làm:
  - Xây dựng `src/platform/audit/pg-audit.repository.ts` hiện thực hóa interface `IAuditPort` (ghi vào bảng `admin_logs`), hỗ trợ ngữ cảnh transaction (truyền pool hoặc trx client), kiểm tra chặt chẽ cấu trúc polymorphic target theo `RB-KN20`.
  - Định nghĩa domain types cho kiểm duyệt tại `src/modules/moderation/domain/moderation.types.ts`.
  - Hiện thực hóa `ModerationService` trong `src/modules/moderation/services/moderation.service.ts` tuân thủ nghiêm ngặt 6 bước kiểm tra ưu tiên:
    1. Kiểm tra `target_type` hợp lệ (`USER`, `SHOP`, `PRODUCT`, `REVIEW`) ➔ 422 `VALIDATION_FAILED`.
    2. Kiểm tra `target_id` hợp lệ (UUID v4) ➔ 422 `VALIDATION_FAILED`.
    3. Kiểm tra lý do `reason` bắt buộc (QD17) ➔ 422 `REASON_REQUIRED`.
    4. Kiểm tra sự tồn tại của target trong bảng nguồn (RB-KN20) ➔ 404 `RESOURCE_NOT_FOUND`.
    5. Kiểm tra tính lũy kế / idempotent ➔ 409 `USER_ALREADY_LOCKED` hoặc `USER_ALREADY_ACTIVE`.
    6. Thực thi trong Atomic Database Transaction (QD20): Cập nhật trạng thái target, ghi nhận bản ghi kiểm duyệt, và gọi `IAuditPort.logAdminAction`. Nếu ghi audit log thất bại ➔ rollback toàn bộ và bắn 500 `AUDIT_WRITE_FAILED`.
  - Viết unit test cho Audit Adapter: `test/platform/audit-logging.spec.ts` (4/4 pass).
  - Viết unit test cho ModerationService: `test/modules/moderation/moderation-service.spec.ts` (9/9 pass).
  - Toàn bộ unit suite `node:test` đạt 308/308 pass.
- Quyết định kỹ thuật:
  - Thiết kế `ITargetRepository` và `ITransactionManager` theo kiến trúc Ports & Adapters (Hexagonal Architecture) giúp cô lập hoàn toàn business logic và atomic rollback test mà không bị lệ thuộc vào instance DB thật ở unit test suite.
  - Xử lý rollback an toàn qua Unit of Work / Transaction Manager đảm bảo không bao giờ có hành động kiểm duyệt nào được commit mà không có audit log đi kèm.
- Contract/port thay đổi:
  - Thêm `IAuditPort` implementation: `PgAuditRepository`.
  - Thêm domain interface: `ITargetRepository`, `ITransactionManager`, `IModerationService`.
- Blocker phát sinh:
  - Không.
- Test đã viết:
  - `[AUDIT-01]` -> `[AUDIT-04]`: `PgAuditRepository` write, missing params, RB-KN20 polymorphic enum & pair checks — Unit test — Kết quả: pass.
  - `[MOD-01]` -> `[MOD-09]`: `ModerationService` 6-step priority order (target type 422, target id 422, QD17 reason 422, RB-KN20 not found 404, idempotency 409, QD20 atomic rollback 500 AUDIT_WRITE_FAILED, happy path commit) — Unit test — Kết quả: pass.

### 2026-09-21 (T2 Phase 2 — Error Catalog & Database Exception Mapper)

- Đã làm:
  - Bổ sung các class lỗi vào `src/platform/errors/app-error.ts`: `ReasonRequiredError` (422), `AuditWriteFailedError` (500), `DependencyUnavailableError` (503), và `InvalidStateTransitionError` (409 nhận mã lỗi cụ thể `USER_ALREADY_LOCKED`, `USER_ALREADY_ACTIVE`).
  - Nâng cấp `errorHandlerMiddleware` trong `src/platform/http/middlewares/error-handler.ts` để bắt và ánh xạ các mã lỗi Postgres:
    - Mã `23505` (unique violation) ➔ 409 (`USER_EMAIL_CONFLICT`, `SHOP_ALREADY_EXISTS`, `VOUCHER_CODE_CONFLICT`, `SKU_CONFLICT`).
    - Mã `23503` (foreign key violation) phân 2 nhánh chuẩn: Insert/Update tham chiếu bản ghi cha không tồn tại ➔ 404 `RESOURCE_NOT_FOUND`; Delete vi phạm ràng buộc RESTRICT ➔ 409 `RESOURCE_DELETE_NOT_ALLOWED`.
    - Mã `23514` (check constraint violation) ➔ 422 `VALIDATION_FAILED`.
  - Bảo đảm tuyệt đối không để lộ chuỗi SQL, tên constraint hoặc stack trace trong response client.
  - Viết thêm 8 test case trong `test/platform/error-handling.spec.ts` (14/14 tests pass, full suite 295/295 tests pass).
- Quyết định kỹ thuật:
  - Phân biệt rõ 2 nhánh của lỗi FK 23503 (Insert 404 vs Delete Restrict 409) theo đúng catalog `error-observability.md` Mục 2.
  - Giữ class `InvalidStateTransitionError` kế thừa `ConflictError` và nhận mã lỗi ngữ cảnh linh hoạt để dùng chuẩn xác cho nghiệp vụ User/Shop/Order.
- Contract/port thay đổi:
  - Không.
- Blocker phát sinh:
  - Không.
- Test đã viết:
  - `[ERR-05]` -> `[ERR-08]`: AppError subclasses (`REASON_REQUIRED`, `AUDIT_WRITE_FAILED`, `DEPENDENCY_UNAVAILABLE`, `InvalidStateTransitionError`) — Unit test — Kết quả: pass.
  - `[PG-01]` -> `[PG-04]`: Postgres error translation (23505, 23503 insert 404, 23503 delete 409, 23514 422) — Unit test — Kết quả: pass.

### 2026-09-21 (T2 Phase 1 — RBAC Middleware & Role/Ownership Guards)

- Đã làm:
  - Tạo file `src/platform/http/middlewares/rbac.ts` cung cấp `requireRole(...roles)`, `requireBuyerOwnership`, `requireShopOwnership`.
  - Triển khai Role Guard: request thiếu context trả `401 AUTH_REQUIRED`, sai role trả `403 RESOURCE_FORBIDDEN`.
  - Triển khai Buyer Ownership Guard chống Resource Enumeration theo `auth-rbac-rls.md` Mục 3: truy cập tài nguyên của Buyer khác trả dứt khoát `404 RESOURCE_NOT_FOUND`.
  - Triển khai Seller Shop Ownership Guard: truy cập sai `shop_id` trả `403 RESOURCE_FORBIDDEN`.
  - Cho phép Admin bypass quyền sở hữu đối với các tài nguyên khi command cho phép.
  - Viết bộ unit test TDD toàn diện tại `test/platform/rbac-middleware.spec.ts` (10/10 tests pass).
- Quyết định kỹ thuật:
  - Tách `requireBuyerOwnership` (404 anti-enumeration) và `requireShopOwnership` (403 forbidden) để đảm bảo an ninh thông tin riêng tư của Buyer.
  - Đặt toàn bộ Unit test trong `test/platform/` chạy qua `node:test` + `tsx`, độc lập 100% với database instance.
- Contract/port thay đổi:
  - Không.
- Blocker phát sinh:
  - Không.
- Test đã viết:
  - `[RBAC-01]` -> `[RBAC-04]`: `requireRole` unauthenticated, wrong role, matching role, multi-role — Unit test — Kết quả: pass.
  - `[OWNER-01]` -> `[OWNER-06]`: Buyer ownership (404), Seller ownership (403), Admin bypass — Unit test — Kết quả: pass.

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

## Cập nhật 2026-09-18 — local PostgreSQL PR gate và CR-ARCH-01

- Đã ghi nhận CR-ARCH-01 `Approved` sau review kỹ thuật mô phỏng của Người 2 và Người 5;
  CR PR đã merge vào `dev` với merge commit `679fc05`.
- Đã bổ sung PostgreSQL `17.6` service container cho Backend quality, fixture `auth.users`,
  role `anon`/`authenticated`, migration deploy trên database trống và bật DB integration
  tests trong PR không cần remote secret.
- Đã nâng `actions/checkout` và `actions/setup-node` lên v7, giữ Node `22.20.0` và npm
  `11.12.1`. Không sửa lockfile hoặc secret.
- Kiểm tra local: `typecheck`, `build`, `git diff --check` pass.

## Cập nhật 2026-09-18 — Supabase JWT seam

- Đã thêm `SupabaseJwtVerifier` dùng `jose@6.2.12`, remote JWKS URL/issuer/audience nhận
  từ cấu hình server-side; token không được phép tự cung cấp JWKS hoặc issuer.
- Đã thêm `PgAuthRepository` đọc `app_users` và shop owner theo query tham số hóa, không
  trả password/secret.
- TDD: malformed token trả `AUTH_INVALID_TOKEN` 401; typecheck và native test pass.

## Cập nhật 2026-09-18 — T1 HTTP composition

- Đã mount đủ route matrix Catalog, Address/Cart/Voucher và Order/Payment dưới
  `/api/v1`; public Catalog list dùng cursor envelope, protected routes dùng `RequestContext`
  và role guard.
- Controller chỉ parse snake_case, dựng envelope và chuyển input qua application interfaces;
  unknown query/body field trả `VALIDATION_FAILED`.
- Đã thêm `createRuntimeApp()` tạo một pool, `PgAuthRepository` và `SupabaseJwtVerifier`;
  production composition không dùng stub verifier.
- TDD route contracts pass: public products, reject `page`, protected buyer address.
- Runtime now wires `PgCatalogHttpService` and `PgCheckoutService` in addition to Buyer,
  so all T1 route groups have concrete PostgreSQL-backed application adapters.

## Cập nhật 2026-09-18 — sửa điều kiện remote DB CI

- GitHub Actions nhận đúng ba secret remote DB sau khi ánh xạ từ `backend/.env`:
  `SUPABASE_TEST_URL`, `SUPABASE_TEST_DATABASE_URL`, `SUPABASE_TEST_DIRECT_URL`.
- Remote DB suite chạy pass đủ 43/43 test; workflow fail do kiểm tra field `.numSkipped`, trong khi JSON reporter của Vitest dùng `numPendingTests` và không tạo field `numSkipped`.
- Đã đổi guard CI sang `.numPendingTests // 0` và bổ sung reporter verbose để khi có test fail sẽ hiện tên test/lỗi đã được mask secret.

## Cập nhật 2026-09-19 — T1 final integration

- Đã thêm `backend/scripts/auth-smoke.ts`: tạo Auth user test, seed `app_users`, gọi protected Address route bằng JWT thật, chuyển user sang `LOCKED`, xác nhận `403 USER_LOCKED`, rồi cleanup trong `finally`.
- Đã thêm job `remote-auth` chỉ chạy trên push `dev/main`, không chạy trên PR và không in token/response nhạy cảm.
- Đã nâng remote database job còn sót từ checkout/setup-node v4 lên v7.
- Final review roleplay: Người 2 và Người 5 review CR-ARCH-01; route/auth/CI contract đã được bàn giao cho T1.

## Cập nhật 2026-09-19 — auth smoke closeout

- Auth smoke ban đầu phát hiện controller làm mất receiver context của class application service, khiến protected Address route trả 500 dù JWT đã xác thực thành công.
- Đã sửa route seam bind method về đúng application receiver và thêm regression test tại `test/platform/t1-route-contracts.spec.ts`.
- GitHub Actions run `35377697980` đã xanh toàn bộ: Frontend quality, Backend quality với PostgreSQL 17.6, Remote DB quality và Remote Supabase auth smoke.

- [x] Scaffold Payload/Node.js backend, cấu trúc module, `package.json` và TypeScript.
- [x] Thiết lập test runner, lint, typecheck, build và CI skeleton.
- [x] Cài API envelope, request ID, error middleware và health endpoint.
- [x] Định nghĩa `RequestContext`, shared contract folder, naming convention và Auth repository interface; khóa contract dùng chung và soạn tài liệu API ban đầu.
- [ ] Sau khi Người 2 bàn giao migration `app_users`, seed User và database connection: xác minh Supabase JWT, chặn User `LOCKED` và chạy auth smoke test.
- [ ] Sau khi Người 3 khóa endpoint DTO và Catalog port: wiring route Catalog.
- [ ] Sau khi Người 4 khóa Cart/Voucher port: wiring route Cart/Voucher.
- [ ] Sau khi Người 5 khóa checkout/order command và response contract: wiring route checkout/order.
