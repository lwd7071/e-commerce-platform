# Tiến độ FE — Người 4 (Buyer Cart và Checkout)

## Trạng thái hiện tại

- Phase/ticket: Phase 4 — B-402, B-403, B-404, B-405, B-406, B-407
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Hoàn tất Cart UI, Quantity/Selection/Delete với optimistic rollback, Address list/create, Voucher preview/evaluate, Idempotent Checkout submit (0₫ shipping fee invariant, UUID key snapshot & retry resilience).
- Nhánh/PR: feat/fe-nguoi-4-cart/checkout
- Bị block bởi: Không
- Việc tiếp theo: B-408 (E2E integration test backend DB) và Q-804 phối hợp với Người 5.

### 2026-09-29 — Thực thi Plan v2.7.0 (Hardening Idempotency, Zero-Silent-Fallback, 10-Row Error Matrix, Quality Gates)

- **Các lỗi và finding đã khắc phục triệt để:**
  1. **Finding P1 (Đồng bộ cờ Mock):** Khắc phục lỗi hardcode `cartMock: () => envConfig.useMock || true` tại `features.ts`. Đồng bộ cả `cartMock` và `checkoutMock` về `Boolean(envConfig.useMock)`. Thêm bộ test `test/features-sync.spec.ts` kiểm thử factory chọn đúng `Api*Repository` khi `useMock=false` và `Mock*Repository` khi `useMock=true`.
  2. **Finding P1 (Bỏ 100% Silent Mock Fallback):** Xóa hoàn toàn `mockFallback` và các khối `catch` nuốt lỗi trong `ApiCartRepository` và `ApiCheckoutRepository`. Lỗi mạng, 409, 422, 500 nay reject trung thực với `AppError` kèm `requestId`, kích hoạt đúng rollback số lượng trong Cart UI và hiển thị đúng thông báo lỗi cho người dùng.
  3. **Finding P2 (Khắc phục Lint Effect):** Sửa vòng đời component trong `CartScreen` và `CheckoutScreen`. Sử dụng `mountedRef` để bảo vệ các hàm retry (`loadCart` / `handleRetryCheckoutData`) ngoài effect, tách biệt mount và retry, đạt 0 warning `react-hooks/set-state-in-effect`.
  4. **Idempotency Lifecycle & Deterministic Fingerprinting:** Chuẩn hóa mảng `vouchers` (sắp xếp theo `shop_id` và `code`, hỗ trợ an toàn undefined/rỗng), kiểm thử cơ chế fallback an toàn sang in-memory storage khi `sessionStorage` ném lỗi (`test/idempotency-lifecycle.spec.ts`).
  5. **Pure Error Classifier (`classifyCheckoutError`):** Tách hàm phân loại lỗi thuần túy tại `checkout-error-classifier.ts`, phân loại chính xác 5 nhóm (`GROUP_A`, `GROUP_B`, `AUTH`, `USER_LOCKED`, `IN_PROGRESS`) với 14 test cases (`test/classify-checkout-error.spec.ts`).
  6. **Toàn diện 10 Hàng Ma Trận Lỗi & Double-Click Guard:** 
     - Thêm `submittingRef = useRef(false)` bảo vệ đồng bộ chống double-click.
     - Tách biệt try/catch của submit khỏi phần xử lý sau thành công (`clearIdempotencySnapshot`, fire-and-forget `removeSelected`, điều hướng `/orders?created=...`).
     - Kiểm tra tường minh mảng `orders` trước khi push router; xử lý nhóm lỗi 401 giữ snapshot; 403 USER_LOCKED xóa snapshot và signOut; 409 IN_PROGRESS disable 3s kèm cleanup timer; 409 INVENTORY_INSUFFICIENT xóa snapshot và refresh giỏ hàng.
     - Kiểm thử 15 test cases màn hình tại `test/checkout-ui-states.spec.ts`.

- **Bằng chứng Quality Gates (100% Pass):**
  1. `npm run lint --prefix frontend`: **0 errors, 0 warnings**.
  2. `npm test --prefix frontend`: **18/18 test files passed, 103/103 tests passed (100%)**.
  3. `npm run typecheck --prefix frontend`: `tsc --noEmit` **0 errors**.
  4. `npm run build --prefix frontend`: Production build thành công với Next.js Turbopack, các route `/cart` và `/checkout` render tĩnh thành công.

### 2026-09-28 — B-402, B-403, B-404, B-405, B-406, B-407

- Đã làm:
  - Tạo `frontend/src/features/cart/`:
    - `cart.types.ts`: Domain models `CartItem`, `CartGroup`, `CartSummary`.
    - `cart.repository.ts`: Repository mock & API switch (`MockCartRepository`, `ApiCartRepository`) xử lý lấy giỏ hàng, cập nhật số lượng, cập nhật lựa chọn `is_selected`, xóa đơn lẻ, xóa sản phẩm đã chọn, và enrichment fallback cho GAP-03.
    - `cart-screen.tsx`: Giao diện Cart chuẩn UX UI pro-max, chia nhóm theo Shop, checkbox chọn từng món / chọn cả shop / chọn tất cả, stepper số lượng (min 1, max stock), xóa có xác nhận qua `Dialog`, cập nhật optimistic UI và tự động rollback khi API lỗi, thanh tổng thanh toán cố định không che dock.
  - Tạo `frontend/src/app/cart/page.tsx`: Route App Router `/cart` bọc trong `ProtectedPage` dành riêng cho role `BUYER`.
  - Tạo `frontend/src/features/checkout/`:
    - `checkout.types.ts`: Types cho `CheckoutAddress`, `CreateAddressInput`, `CheckoutVoucher`, `VoucherEvaluationResult`, `CheckoutPayload`, `CheckoutResult`.
    - `idempotency.ts`: Quản lý vòng đời `Idempotency-Key` (UUID v4) gắn với snapshot payload (`address_id`, `payment_method`, `vouchers`). Tái sử dụng key khi retry cùng payload sau lỗi mạng/timeout; tự động sinh key mới khi thay đổi payload; xóa snapshot khi đặt hàng thành công; có in-memory fallback cho môi trường Node/SSR.
    - `checkout.repository.ts`: Repository quản lý danh sách địa chỉ (`GET /addresses`), tạo địa chỉ mới (`POST /addresses`), lấy voucher áp dụng (`GET /vouchers/applicable`), kiểm tra voucher theo shop (`POST /vouchers/evaluate`), và submit thanh toán (`POST /checkout` kèm header `Idempotency-Key`).
    - `checkout-screen.tsx`: Giao diện Checkout hoàn chỉnh theo stepper 4 bước: (1) Địa chỉ nhận hàng có popup chọn/thêm mới với validate số điện thoại Việt Nam, (2) Xem danh sách sản phẩm theo shop, (3) Vận chuyển chuẩn 0₫ + áp dụng voucher theo shop có preview số tiền giảm, (4) Phương thức thanh toán `COD` hoặc `ONLINE`, (5) Bảng tổng quan chi tiết và đặt hàng an toàn chống trùng lặp, kèm popup chúc mừng thành công và điều hướng sang `/orders`.
  - Tạo `frontend/src/app/checkout/page.tsx`: Route App Router `/checkout` bọc trong `ProtectedPage`.
  - Tạo `frontend/test/cart-checkout.spec.ts`: 11 test cases kiểm thử tính toán tiền không lỗi số thực dấu phẩy động, vòng đời Idempotency Key, đánh giá voucher hợp lệ/không hợp lệ, và quản lý sổ địa chỉ.
- Quyết định UI/contract:
  - Tên thương hiệu hiển thị toàn bộ là chữ **Dino** text-only, không emoji/logo.
  - Màu sắc chuẩn token `globals.css`: nút chính dùng `--button-primary-bg: #BF3A6F` đảm bảo WCAG AA contrast (5.19:1).
  - Phí vận chuyển hiển thị **0 ₫ (Miễn phí)** theo đúng contract backend (hardcoded `shipping_fee = 0.00`), client không gửi phí ship trong body.
  - Idempotency-Key bắt buộc theo RFC UUID, giữ nguyên khi retry snapshot cũ để tránh tạo đơn trùng lặp.
  - Tính năng sửa/xóa địa chỉ (B-405) tạm ghi chú và khóa vì backend runtime 501 (GAP-01).
- Test/kiểm tra:
  - `npm test --prefix frontend`: 4 test files, 23/23 tests pass 100%.
  - `npm run typecheck --prefix frontend`: `tsc --noEmit` pass sạch, 0 lỗi type.
  - `npm run build --prefix frontend`: Next.js Turbopack build thành công production, render tĩnh các route `/cart` và `/checkout`.
- Handoff:
  - Cart command / repository đã sẵn sàng kết nối với Product Detail (`B-401` của Người 3).
  - Checkout snapshot và idempotency contract sẵn sàng phối hợp với Order center (`O-502` của Người 5).
- Blocker: Không.
- Còn lại: B-408 (E2E với DB thật) và Q-804 khi môi trường backend test DB được khởi chạy.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Cart command/repository | Người 3 | Add/quantity/selection/delete input/error, fixture | Đã hoàn thành | `src/features/cart/` |
| Checkout view-model/idempotency | Người 1, 5 | Decimal/ship/key snapshot, retry/409 cases | Đã hoàn thành | `src/features/checkout/` |

## Việc được giao

- [x] B-402/B-403 — cart UI, quantity/selection/delete và rollback.
- [x] B-404/B-405 — address list/create, edit/default/delete gating.
- [x] B-406–407 — voucher preview, checkout và xử lý idempotency.
- [ ] B-408 — Checkout E2E với backend/test DB thật.
- [ ] Q-804 — Buyer/Seller critical E2E gate, phối hợp evidence với Người 5.
