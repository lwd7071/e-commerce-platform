# Tiến độ FE — Người 4 (Buyer Cart và Checkout)

## Trạng thái hiện tại

- Phase/ticket: Phase 4 — B-402, B-403, B-404, B-405, B-406, B-407
- Cập nhật lần cuối: 2026-09-29
- Đang làm: Hoàn tất Cart UI, Quantity/Selection/Delete với optimistic rollback, Address list/create, Voucher preview/evaluate, Idempotent Checkout submit (0₫ shipping fee invariant, UUID key snapshot & retry resilience).
- Nhánh/PR: Đã tích hợp vào `dev` (merge commit `4760e19`; nhánh `feat/fe-nguoi-4-cart/checkout`)
- Bị block bởi: B-408 cần backend/test DB thật; Q-804 cần môi trường và phối hợp chạy Buyer/Seller critical E2E.
- Việc tiếp theo: B-408 (E2E integration test backend DB) và Q-804 phối hợp với Người 5.

## Nhật ký theo ngày

### 2026-09-29 — Đối soát trạng thái tích hợp

- Đã làm: Xác nhận nhánh cart/checkout đã được tích hợp vào `dev` qua merge `4760e19`.
- Test/kiểm tra: Không chạy lại test/E2E trong lần đối soát tài liệu này; giữ nguyên evidence tại nhật ký 2026-09-28.
- Đối chiếu UI rules: nút tăng/giảm số lượng giỏ hàng có vùng chạm 44×44px.
- Còn lại: B-408 cần backend/test DB thật; Q-804 cần phối hợp chạy critical E2E.

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
