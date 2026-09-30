# Tiến độ FE — Người 1 (Platform và Integration Lead)

## Trạng thái hiện tại

- Phase/ticket: Dino MVP 30/09 — Block 0, Workstream A & Workstream C Admin APIs (P0-01, P0-02, P0-04, P0-07, P0-08, P0-09, A-101, A-102, A-103, A-104, C-401, C-402)
- Cập nhật lần cuối: 2026-09-30
- Đang làm: Đã hoàn tất toàn bộ checklist được giao cho Người 1 trong 08-implementation-plan.md:
  1. Block 0: Khóa OpenAPI & Contract Drift (P0-01, P0-02), Capability Readiness Registry & Build Guard (P0-04), Error Envelope completeness (P0-09).
  2. Workstream A: Seller Onboarding flow & AuthContext session refresh (A-101, A-102), Gating Seller screens theo trạng thái PENDING của Shop (A-103), Safe returnTo open-redirect protection (A-104).
  3. Workstream C: Admin API hardening & bảo vệ tài khoản ADMIN với 403 ADMIN_TARGET_PROTECTED (C-401, C-402).
  Quality Gates đạt 100%: 226/226 tests FE pass, 610/610 tests BE pass, typecheck 0 lỗi, lint 0 lỗi, build Turbopack 22/22 routes thành công.
- Nhánh/PR: dev
- Bị block bởi: Không
- Việc tiếp theo: Phối hợp cùng Người 2, 3, 4, 5 hoàn tất integration và release smoke.

## Nhật ký theo ngày

### 2026-09-30 — Dino MVP 30/09 (Block 0, Workstream A, Workstream C Admin API & Gating)

- **Đã làm:**
  - **P0-01, P0-02 & P0-03 (OpenAPI, Contract Drift & /health/readiness):**
    - Hiện thực endpoint `GET /api/v1/health/readiness` (và `/health/readiness`) trong `backend/src/platform/routes/health.ts`: trả về `version: 1.4.0`, `commit`, kiểm tra kết nối DB/Auth/Storage và 12 capabilities trạng thái `LIVE` khớp với manifest FE. Tự động trả 503 nếu DB degraded.
    - Cập nhật tài liệu OpenAPI 3.1 `backend/src/platform/openapi/openapi-spec.ts` cho `/health/readiness`.
    - Viết unit tests tích hợp trong `backend/test/platform/health-route.spec.ts` (PASS 100%).
    - Mở rộng ma trận `CANONICAL_BACKEND_PATHS` trong `frontend/test/contract-drift-q807.spec.ts` với đầy đủ các endpoint mới (`/health/readiness`, `/auth/me`, `/auth/onboarding`, `/categories`, `/profile`, `/admin/users`, `/admin/shops`, `/reviews`, `/order-items/{id}/review`, `/product-variants/{id}/stock`).
  - **P0-04 (Capability Readiness Registry & Build Guard):**
    - Tạo `frontend/src/lib/config/capabilities.ts` quản lý 12 MUST capabilities (`LIVE | MOCK_DEV_ONLY | BLOCKED`) và hàm `validateReleaseReadiness()`.
    - Viết 5 unit tests trong `frontend/test/capabilities.spec.ts` (PASS 100%).
    - Gắn `validateReleaseReadiness()` vào `frontend/next.config.ts`, tự động chặn build production nếu mock còn bật hoặc capability MUST chưa LIVE.
  - **P0-09 (Error Envelope Completeness):**
    - Rà soát `backend/src/platform/http/envelope.ts` và `error-handler.ts`, đảm bảo mọi response lỗi có `request_id`, bảo toàn kiểm tra `deepStrictEqual` trong `API-ENV-05`.
  - **A-101 & A-102 (Seller Onboarding & Session Refresh):**
    - Cập nhật `AuthUser` và `AuthContext` lưu trữ `shopStatus` (`PENDING | ACTIVE | SUSPENDED | LOCKED`).
    - Cung cấp phương thức `reloadUser()` trong `AuthContext` để refetch profile từ `GET /auth/me` khi shop được Admin duyệt mà không cần đăng nhập lại.
  - **A-103 (Gate Seller Navigation & Screens by Shop Status):**
    - Trong `seller-products-screen.tsx`: hiển thị notice banner cảnh báo `PENDING`, vô hiệu hóa nút `+ Thêm sản phẩm mới`, vô hiệu hóa action trong EmptyState, và vô hiệu hóa nút "Chỉnh tồn kho" trong bảng sản phẩm.
    - Trong `seller-product-create-screen.tsx`: hiển thị banner cảnh báo, vô hiệu hóa nút Submit và chặn `handleSubmit` khi shop `PENDING`.
    - Trong `seller-dashboard-screen.tsx`: hiển thị notice banner cảnh báo `PENDING`.
  - **A-104 (Safe returnTo & Open Redirect Protection):**
    - Củng cố `sanitizeReturnTo` trong `frontend/src/lib/auth/route-guards.ts`, chặn đứng URL ngoài, protocol-relative (`//`), và vector backslash bypass (`/\`).
    - Viết bộ test `frontend/test/seller-onboarding-gating.spec.ts` (6/6 tests PASS).
  - **C-401 & C-402 (Admin API Hardening & ADMIN_TARGET_PROTECTED):**
    - Tạo exception `AdminTargetProtectedError` (HTTP 403 `ADMIN_TARGET_PROTECTED`).
    - Thêm `getUserRole` vào `ITargetLookupRepository` và `PgModerationTargetRepository`.
    - Cập nhật `ModerationService.moderateTarget`: từ chối mọi thao tác lock/unlock tài khoản ADMIN với HTTP 403 `ADMIN_TARGET_PROTECTED`.
    - Viết unit & integration tests trong `moderation-service.spec.ts` (Case 10) và `admin-routes.spec.ts` (Case 8) (PASS 100%).
- **Quyết định UI/contract:**
  - Quy tắc phân quyền shop pending: Người bán có shop PENDING được phép xem các màn hình quản trị nhưng toàn bộ tính năng thay đổi dữ liệu (tạo sản phẩm, sửa tồn kho) bị khóa chặt ở cả client lẫn server.
  - Quy tắc bảo vệ Admin: Tuyệt đối không cho phép khóa tài khoản Admin qua giao diện moderation (403 ADMIN_TARGET_PROTECTED).
- **Test/kiểm tra:**
  - Frontend: **226/226 tests PASS (38 test suites)**.
  - Backend: **610/610 tests PASS (172 suites)**.
  - Typecheck: **0 lỗi** trên cả frontend và backend.
  - ESLint: **0 lỗi, 0 warnings** trên cả frontend và backend.
  - Build: **Next.js Turbopack build pass 22/22 routes**.
- **Handoff:**
  - Bàn giao `AuthContext.reloadUser` và `shopStatus` cho Người 3 (Seller catalog) và Người 5 (Admin approve/shop moderation).
- **Blocker:** Không.
- **Còn lại:** Sẵn sàng cho Block 2 (Integration & Production deploy).

### 2026-09-29 — Đồng bộ role metadata với route RBAC (BUYER-only cho /orders & /notifications)

- **Đã làm:**
  - Khắc phục lỗ hổng phân quyền giao diện tại `frontend/src/lib/auth/route-guards.ts`:
    - Đặt `allowedRoles: ["BUYER"]` cho `/orders` (loại bỏ hoàn toàn cấp quyền thừa cho `SELLER`, `ADMIN`).
    - Đặt `allowedRoles: ["BUYER"]` cho `/notifications` (thay vì mở cho mọi role đã đăng nhập).
    - Quy tắc `/orders` tự động áp dụng tiền tố an toàn cho toàn bộ route con như `/orders/[id]/review`.
  - Bổ sung kiểm thử hồi quy (Regression Test) trong `frontend/test/route-guards.spec.ts`:
    - Xác nhận `/orders` yêu cầu auth và chỉ cho phép `BUYER`.
    - Xác nhận route con `/orders/order-123/review` kế thừa guard và chỉ cho phép `BUYER`.
    - Xác nhận `/notifications` yêu cầu auth và chỉ cho phép `BUYER`, cấm `SELLER` và `ADMIN`.
- **Quyết định UI/contract:**
  - Guard phân quyền phía FE ngăn chặn sớm việc render màn hình nhầm role ở client. Backend API vẫn tiếp tục thực thi xác thực quyền độc lập qua `RequestContext` và RBAC middleware.
- **Test/kiểm tra:**
  - Route guard regression test xác nhận chặn đứng mọi role ngoài `BUYER`.
  - Typecheck, lint, test và production build pass sạch 100%.
- **Handoff:**
  - Bàn giao route guard đã vá lỗi cho Người 2 (UI Shell), Người 4 (Cart/Checkout) và Người 5 (Orders/Review).
- **Blocker:** Không.
- **Còn lại:** Không còn task nào tồn đọng.

### 2026-09-28 — F-101 đến F-107 & Scaffold Frontend Foundation

- **Đã làm:**
  - Khởi tạo toàn bộ workspace `frontend/` độc lập theo yêu cầu nhóm (`package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `frontend/.gitignore`).
  - **F-101:** Triển khai `env.ts` (validate fail-fast, cấm rò rỉ secret key), `supabase-client.ts` singleton an toàn browser.
  - **F-102:** Hiện thực `ApiClient` fetch wrapper: unwrap SuccessEnvelope, xử lý an toàn 204 No Content, timeout 10s với AbortController, sinh/theo dõi `X-Request-Id`, bóc tách error body sang class `AppError`.
  - **F-103:** Triển khai đầy đủ các endpoint API modules: `catalog.api.ts`, `buyer.api.ts`, `order.api.ts`, `voucher.api.ts`.
  - **F-104:** Hiện thực `money.adapter.ts` xử lý format tiền VND decimal-safe string, tránh triệt để lỗi floating point.
  - **F-105:** Triển khai `AuthProvider` và hook `useAuth()`: quản lý session, JWT access token, giải mã vai trò (`BUYER | SELLER | ADMIN`), tự động kết nối token provider vào ApiClient.
  - **F-106:** Triển khai `route-guards.ts`: bảo vệ route theo role, chống open redirect với `sanitizeReturnTo`.
  - **F-107 & C-004:** Triển khai `types.ts` và `repository-factory.ts`: cung cấp trừu tượng repository và bộ switch linh hoạt giữa Live API và Mock fixtures dựa theo config `features.useMock()`, UI không cần branch code.
  - **B-303 & B-304:** Triển khai 2 trang `/login` (bọc Suspense boundary an toàn cho searchParams) và `/register` (chọn role BUYER/SELLER, validate form, accessible labels, loading indicator).
  - **Dino Text-only Branding & Phase 2-7 Integration:** Cập nhật logo và copy tại `/login` và `/register` sang nhận diện thương hiệu "Dino" text-only theo chỉ đạo của Lead Vĩ Đông; rà soát và vá lỗi linter React 19 trong `cart-screen.tsx` và `checkout-screen.tsx`.
  - **HomePage (`src/app/page.tsx`):** Dựng trang chủ hiện đại với Navigation, Hero, Value Badges, Product Grid (dùng `next/image`, CSS variables và `moneyAdapter.formatVND`), hỗ trợ graceful offline fallback khi backend chưa chạy lúc build.
- **Quyết định UI/contract:**
  - Áp dụng triệt để bảng màu và quy chuẩn từ `09-ui-ux-rules.md §3`: Nút chính đồng nhất dùng `--button-primary-bg` (`#BF3A6F`) và `--button-primary-fg` (trắng), đạt chuẩn tương phản 5.19:1 WCAG AA.
  - Mọi endpoint module xuất ra qua `src/lib/index.ts` làm seam dùng chung duy nhất cho toàn đội.
- **Test/kiểm tra:**
  - `npm run typecheck`: **0 errors**.
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run test`: **41/41 tests PASS (100%)** (`test/api-client.spec.ts`, `test/resilience-q806.spec.ts`, `test/contract-drift-q807.spec.ts`, `test/money-adapter.spec.ts`, `test/route-guards.spec.ts`, `test/category-adapter.spec.ts`, `test/catalog-pagination.spec.ts`, `test/cart-checkout.spec.ts`).
  - `npm run build`: **Next.js Turbopack build thành công**, pre-render sạch sẽ toàn bộ 11 routes.
- **Handoff:**
  - Đã tích hợp và kiểm thử thông suốt toàn bộ Phase 1–8 cùng Người 2 (UI Shell), Người 3 (Catalog), Người 4 (Cart/Checkout) và Người 5 (Orders/Admin).
- **Blocker:** Không.
- **Còn lại:** Không còn task nào tồn đọng.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| API client + AppError/envelope | Người 3, 4, 5 | Parser 204/timeout/error, request_id, 12 tests pass | Đã bàn giao | `src/lib/api/` |
| Auth/route guard | Người 2, 3, 4, 5 | Session/role/returnTo behavior + test | Đã bàn giao | `src/lib/auth/` |
| Mock/API repository switch | Người 2, 3, 4, 5 | Interface, flag, contract test, fixtures | Đã bàn giao | `src/lib/repositories/` |
| Central Seams Export | Toàn đội FE | Export toàn diện ApiClient, Auth, Repositories, Adapters | Đã bàn giao | `src/lib/index.ts` |
| Resilience & Drift Suites | Toàn đội | 8 bài test resilience và 3 bài test drift contract | Đã bàn giao | `test/resilience-q806.spec.ts`, `test/contract-drift-q807.spec.ts` |

## Việc được giao

- [x] C-001/C-003–005 — phối hợp contract, flag, repository boundary, quyết định FE-BE.
- [x] F-101–107 — env, API client, adapters, auth, route guards, mock/API switch.
- [x] B-303/B-304 — login thật, registration UI có gating.
- [x] Q-801/Q-806–808 — build/lint, resilience khi offline/error, contract drift, remove release mocks.
