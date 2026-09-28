# Tiến độ FE — Người 1 (Platform và Integration Lead)

## Trạng thái hiện tại

- Phase/ticket: Phase 0 & Phase 1 — C-001, C-003, C-004, F-101, F-102
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Khởi tạo và thiết lập Kế hoạch Chi tiết Triển khai FE Platform & Foundation (Base Types, Env Validation, ApiClient Core, Auth Context & Route Guards, Mock/API Repository Switcher)
- Nhánh/PR: codex/fe-nguoi-1-foundation (chuẩn bị)
- Bị block bởi: Không
- Việc tiếp theo: Triển khai F-101 (Env & Supabase client), F-102 (API Client với parser envelope/error/timeout), F-105 (Auth Provider & Session), bàn giao sớm cho Người 3, 4, 5

## Nhật ký theo ngày

### 2026-09-28 — Lập Kế hoạch Chi tiết Triển khai FE Platform & Foundation (Phase 0 -> Phase 3)

- **Đã làm:**
  - Rà soát toàn bộ tài liệu kiến trúc Frontend (`docs/frontend-spec/01` đến `09`) và phân tích đối chiếu với Backend runtime trên nhánh `dev`.
  - Thiết lập kế hoạch hành động 4 giai đoạn chi tiết theo đúng phân công trong `08-implementation-plan.md`:
    - **Giai đoạn 1: Phase 0 — Contract Freeze & Guardrails (C-001, C-003, C-004, C-005):**
      - Đối soát và chốt OpenAPI 3.1 Spec từ Backend (`http://localhost:3000/api/v1/openapi.json` đã chuẩn hóa URL và đầy đủ các domain routes).
      - Xây dựng hệ thống Feature Flags tại `src/lib/config/features.ts` (`NEXT_PUBLIC_USE_MOCK`, `NEXT_PUBLIC_API_URL`, phân định rõ môi trường dev vs prod).
      - Thiết kế Base Repository Interfaces tại `src/lib/repositories/` đảm bảo ranh giới rõ ràng, React components không phụ thuộc vào dữ liệu mock hay API thật.
    - **Giai đoạn 2: Phase 1 — FE Foundation & API Core (F-101, F-102, F-103, F-104):**
      - `F-101`: Khởi tạo Supabase client an toàn phía browser, validate biến môi trường fail-fast khi thiếu key/URL; cấm rò rỉ secret key vào frontend.
      - `F-102`: Hiện thực `ApiClient` dùng `fetch` native:
        - Tự động gắn header `Authorization: Bearer <jwt>`.
        - Tự động gắn và theo dõi `X-Request-Id` phục vụ tracing.
        - Bóc tách chuẩn JSON envelopes (`SuccessEnvelope`, `ErrorEnvelope`, `PaginatedEnvelope`).
        - Xử lý an toàn HTTP 204 No Content (không gọi `res.json()`).
        - Ánh xạ mã lỗi nghiệp vụ sang class `AppError` (`code`, `message`, `details`).
        - Timeout mặc định 10 giây với `AbortController`.
      - `F-103`: Phân chia module API client chuyên biệt (`catalog.api.ts`, `buyer.api.ts`, `order.api.ts`, `voucher.api.ts`).
      - `F-104`: Xây dựng Adapters chuẩn hóa dữ liệu (format tiền tệ decimal-safe string, chuẩn hóa null/undefined, kiểm tra enum hợp lệ).
    - **Giai đoạn 3: Phase 1 — Auth & Route Guards (F-105, F-106, F-107):**
      - `F-105`: Triển khai `AuthProvider` và React hook `useAuth()`: quản lý state người dùng, lưu trữ Supabase JWT, tự động refresh token, giải mã vai trò (`BUYER`, `SELLER`, `ADMIN`).
      - `F-106`: Xây dựng Next.js Middleware Route Guards: bảo vệ các tuyến đường `/profile/*`, `/checkout`, `/orders/*`, `/seller/*`, `/admin/*`, điều hướng tự động về `/login` kèm tham số an toàn `returnTo`.
      - `F-107`: Hoàn tất Mock/API Repository Switcher dựa theo config/dependency injection, cho phép các trang chuyển đổi backend thật/mock mà không cần sửa JSX.
    - **Giai đoạn 4: Phase 2/3 & Quality Gates (B-303, B-304, Q-801, Q-806–808):**
      - Kết nối API thật cho màn hình `/login` và `/register` có luồng gating phân quyền theo role.
      - Thiết lập Quality Gates cho FE: `npm run lint`, `npm run typecheck`, `npm run build`, resilience tests khi mạng lỗi/timeout/token hết hạn.
- **Quyết định UI/contract:**
  - Token Supabase và session chỉ được quản lý qua `AuthProvider` tập trung, cấm component đọc trực tiếp từ `localStorage` để tránh desync state.
  - Mọi request API đều trả về typed result dạng `Promise<T>` với data đã unwrap từ `SuccessEnvelope`, tự động ném `AppError` khi nhận `ErrorEnvelope`.
- **Test/kiểm tra:**
  - Chuẩn bị test suite Vitest cho API client parser: test bóc envelope 200, test timeout 10s, test lỗi 401/403/404/422, test 204 No Content.
- **Handoff:**
  - Chuẩn bị bàn giao `ApiClient`, `AppError`, và `Repository Interfaces` cho Người 3 (Catalog), Người 4 (Cart/Checkout) và Người 5 (Orders/Admin) để bắt đầu nối API thật.
- **Blocker:** Không.
- **Còn lại:** Bắt tay viết mã nguồn cho các module thuộc Phase 0 & Phase 1.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| API client + AppError/envelope | Người 3, 4, 5 | Parser 204/timeout/error, request_id, fixture | Đang làm | `src/lib/api/` |
| Auth/route guard | Người 2, 3, 4, 5 | Session/role/returnTo behavior + test | Đang làm | `src/lib/auth/` |
| Mock/API repository switch | Người 2, 3, 4, 5 | Interface, flag, contract test | Đang làm | `src/lib/repositories/` |

## Việc được giao

- [ ] C-001/C-003–005 — phối hợp contract, flag, repository boundary, quyết định FE-BE.
- [ ] F-101–107 — env, API client, adapters, auth, route guards, mock/API switch.
- [ ] B-303/B-304 — login thật, registration UI có gating.
- [ ] Q-801/Q-806–808 — build/lint, resilience, drift, release mocks.
