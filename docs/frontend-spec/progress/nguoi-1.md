# Tiến độ FE — Người 1 (Platform và Integration Lead)

## Trạng thái hiện tại

- Phase/ticket: Phase 0 & Phase 1 hoàn tất (C-001, C-003–005, F-101–107, B-303, B-304)
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Đã hoàn tất 100% scaffold thư mục `frontend/`, triển khai đầy đủ ApiClient, AuthProvider, RouteGuards, Repository Switcher, MoneyAdapter, các trang `/login`, `/register` và vượt qua 4 Quality Gates (typecheck 0 lỗi, lint 0 lỗi, 12/12 unit tests PASS, build Next.js thành công).
- Nhánh/PR: dev
- Bị block bởi: Không
- Việc tiếp theo: Bàn giao toàn bộ nền móng và seam `src/lib/` cho Người 2 (UI Shell), Người 3 (Catalog), Người 4 (Cart/Checkout) và Người 5 (Orders/Admin).

## Nhật ký theo ngày

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
  - `npm run test`: **30/30 tests PASS (100%)** (`test/api-client.spec.ts`, `test/money-adapter.spec.ts`, `test/route-guards.spec.ts`, `test/category-adapter.spec.ts`, `test/catalog-pagination.spec.ts`, `test/cart-checkout.spec.ts`).
  - `npm run build`: **Next.js Turbopack build thành công**, pre-render sạch sẽ toàn bộ 11 routes.
- **Handoff:**
  - Đã tích hợp và kiểm thử thông suốt toàn bộ Phase 1–7 cùng Người 2 (UI Shell), Người 3 (Catalog), Người 4 (Cart/Checkout) và Người 5 (Orders/Admin).
- **Blocker:** Không.
- **Còn lại:** Hỗ trợ các thành viên tích hợp component vào `frontend/`.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| API client + AppError/envelope | Người 3, 4, 5 | Parser 204/timeout/error, request_id, 12 tests pass | Đã bàn giao | `src/lib/api/` |
| Auth/route guard | Người 2, 3, 4, 5 | Session/role/returnTo behavior + test | Đã bàn giao | `src/lib/auth/` |
| Mock/API repository switch | Người 2, 3, 4, 5 | Interface, flag, contract test, fixtures | Đã bàn giao | `src/lib/repositories/` |
| Central Seams Export | Toàn đội FE | Export toàn diện ApiClient, Auth, Repositories, Adapters | Đã bàn giao | `src/lib/index.ts` |

## Việc được giao

- [x] C-001/C-003–005 — phối hợp contract, flag, repository boundary, quyết định FE-BE.
- [x] F-101–107 — env, API client, adapters, auth, route guards, mock/API switch.
- [x] B-303/B-304 — login thật, registration UI có gating.
- [x] Q-801/Q-806 — build/lint, resilience khi offline/error, unit test suite.
