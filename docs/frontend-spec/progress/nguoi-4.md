# Tiến độ FE — Người 4 (Buyer Cart và Checkout)

## Trạng thái hiện tại

- Phase/ticket: Phase 4 (B-402–407, A-201–202, A-206), Review/Notification services backend (C-201–203, C-301–302)
- Cập nhật lần cuối: 2026-09-30
- Đang làm: Đã hoàn tất toàn bộ Cart, Address, Voucher, Checkout idempotency UI, rollback optimistic update, phân loại lỗi 10-hàng, và hỗ trợ Review/Notification backend services.
- Nhánh/PR: dev
- Bị block bởi: Không
- Việc tiếp theo: Các mục được báo cáo là hoàn tất. Hỗ trợ chạy checkout/review/notification trên môi trường tích hợp; phối hợp Người 5 kiểm chứng checkout → nhận hàng → review.

## Nhật ký theo ngày

### 2026-09-29 — Chuẩn hóa FE Address/Cart/Voucher Adapters và Wire Runtime (Plan v3.2)

- Đã làm:
  - Cập nhật `frontend/src/lib/api/buyer.api.ts`:
    - Chuyển đổi path Address từ `/buyers/addresses` sang `/addresses` (khớp router mount của backend).
    - Chuẩn hóa DTO `WireAddress` sang camelCase (`addressId, recipientName, phone, province, district, ward, detailAddress, isDefault`).
    - Cung cấp `CreateAddressPayload` thuần camelCase theo chuẩn Ponytail.
    - Chuẩn hóa DTO Cart sang snake_case (`WireCartItem`, `WireCart`, `WireCartItemResponse`).
    - Triển khai `addToCart` với whitelist nghiêm ngặt (`variant_id`, `quantity`), không chứa `is_selected` (tránh backend ném 422 Unknown field).
    - Triển khai `updateCartItem` với whitelist `{ quantity?, is_selected? }` kèm client-side async guard `Promise.reject` chặn `quantity < 1` (phòng ngừa lỗi so sánh biến chưa khởi tạo tại backend).
    - Triển khai `removeCartItem` và `removeSelectedCartItems` an toàn với HTTP 204 No Content.
    - Xử lý GAP-07: Profile API fail-fast tường minh với `Promise.reject(new Error("GAP-07..."))`, loại bỏ hoàn toàn live network call 404 tới `/buyers/profile`.
  - Cập nhật `frontend/src/lib/api/voucher.api.ts`:
    - Chuyển đổi path từ `/vouchers` sang `/vouchers/applicable` (nhận query params `scope`, `shop_id`, `now`).
    - Chuẩn hóa DTO `WireVoucher` sang camelCase (`voucherId, code, voucherName, scope, shopId, discountType, discountValue, maxDiscount, minOrderValue, quantity, startAt, endAt, status`).
    - Triển khai `evaluateVoucher` trả về discriminated union `EvaluateVoucherResult` (`{ isValid: true, voucherId, discountAmount } | { isValid: false, errorCode, errorMessage }`).
  - Cập nhật `frontend/src/lib/repositories/types.ts` & `repository-factory.ts`:
    - Đồng bộ `IBuyerRepository`, `IVoucherRepository`, `apiBuyerRepository`, `mockBuyerRepository`, `apiVoucherRepository`, `mockVoucherRepository`.
    - Mock data cho Address/Voucher chuyển sang camelCase và Cart sang snake_case.
  - Cập nhật `frontend/src/features/checkout/`:
    - Cho phép `CreateAddressInput` hỗ trợ linh hoạt, `ApiCheckoutRepository.createAddress` chuẩn hóa payload camelCase gửi tới `/addresses`.
    - Bảo toàn logic disabled/gated cho Address edit/delete/default do runtime trả 501 `NOT_IMPLEMENTED` (GAP-01).
  - Cập nhật `frontend/src/features/cart/cart.repository.ts`:
    - `ApiCartRepository` ủy quyền các thao tác item mutations cho `buyerApi` để tái sử dụng guard và path chuẩn.
  - Tạo mới `frontend/test/buyer-voucher-adapters.spec.ts`:
    - 15 unit test cases kiểm thử độc lập toàn diện: Address camelCase, Voucher union, Cart whitelist 422, relative add, client guard `Promise.reject`, HTTP 204 No Content, và GAP-07 fail-fast.
- Quyết định UI/contract:
  - Bám sát `05-api-contract.md` và `06-fe-be-mapping.md` §1.1.
  - Giữ vững nguyên tắc Ponytail: tối giản diff, tái sử dụng `buyerApi`, không abstraction thừa, mỗi logic mới đều có test tự chạy kiểm chứng.
  - Tuân thủ `09-ui-ux-rules.md`: touch targets >= 44×44px, nút chính `--button-primary-bg: #BF3A6F` contrast 5.19:1, nhãn text-only **Dino**.
- Test/kiểm tra:
  - `npm test --prefix frontend`: **23/23 test files passed, 139/139 tests passed (100%)**.
  - `npm run typecheck --prefix frontend`: `tsc --noEmit` **0 errors**.
  - `npm run lint --prefix frontend`: `eslint` **0 errors, 0 warnings**.
  - `npm run build --prefix frontend`: Next.js Turbopack production build thành công (13 static/dynamic routes).
- Handoff:
  - Cart command / repository đã sẵn sàng kết nối với Product Detail (`B-401` của Người 3).
  - Checkout snapshot và idempotency contract sẵn sàng phối hợp với Order center (`O-502` của Người 5).
- Blocker: Không.
- Còn lại: B-408 (E2E với DB thật) và Q-804 khi môi trường backend test DB được khởi chạy.

### 2026-09-29 — B-403: Nâng vùng chạm nút tăng/giảm số lượng giỏ hàng lên 44×44px

- Đã làm:
  - Cập nhật `frontend/src/features/cart/cart-screen.tsx`:
    - Thay thế kích thước nút tăng (`+`) và giảm (`−`) từ 32×32px (`w-8 h-8`) lên 44×44px (`w-11 h-11 min-w-[44px] min-h-[44px]`).
    - Nâng cỡ chữ dấu `+` và `−` lên `text-base font-semibold` để hiển thị rõ ràng, dễ nhìn và dễ thao tác trên màn hình cảm ứng/mobile.
    - Cập nhật nút xóa đơn lẻ của item trong giỏ hàng lên `w-11 h-11 min-w-[44px] min-h-[44px]` để toàn bộ touch targets trong hàng sản phẩm đạt chuẩn tối thiểu 44×44px.
  - Cập nhật `frontend/test/cart-checkout.spec.ts`:
    - Bổ sung test suite `Cart UI Stepper Touch Target Specification (09-ui-ux-rules.md)` kiểm tra và bảo vệ invariant touch target >= 44×44px, không cho phép hồi quy về 32×32px.
    - Dọn dẹp unused import `checkoutRepository` để giữ 0 lint warnings.
- Quyết định UI/contract:
  - Tuân thủ quy định tại `docs/frontend-spec/09-ui-ux-rules.md` (Mục 4: "Touch target tối thiểu 44×44px") và ticket phân công Người 4 trong `docs/frontend-spec/08-implementation-plan.md`.
  - Giữ nguyên các class token CSS (`--border`, `--card`, `--card-muted`, `--foreground`), giữ nguyên logic optimistic update và rollback khi cập nhật số lượng thất bại.
- Test/kiểm tra:
  - `npm test --prefix frontend`: **18/18 test files passed, 104/104 tests passed (100%)**.
  - `npm run typecheck --prefix frontend`: `tsc --noEmit` **0 errors**.
  - `npm run lint --prefix frontend`: `eslint` **0 errors, 0 warnings**.
  - `npm run build --prefix frontend`: Next.js Turbopack production build thành công, render tĩnh các route `/cart` và `/checkout`.
- Handoff: Không thay đổi contract API/view-model; giao diện giỏ hàng đã cập nhật vùng chạm chuẩn WCAG 2.2 AA sẵn sàng cho Người 2 nghiệm thu accessibility QA.
- Blocker: Không.
- Còn lại: Sửa FE address/cart/voucher adapters khớp path và DTO runtime; B-408 và Q-804 khi môi trường test DB backend được khởi chạy.

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

### 2026-09-29 — Đối soát trạng thái tích hợp

- Đã làm: Đồng bộ cập nhật từ nhánh `dev`, đối soát trạng thái tích hợp với backend runtime audit.
- Test/kiểm tra: Giữ nguyên evidence tại nhật ký 2026-09-29.
- Đối chiếu UI rules: nút tăng/giảm số lượng giỏ hàng có vùng chạm 44×44px.
- Còn lại: Sửa FE address/cart/voucher adapters khớp path và DTO runtime; B-408 cần backend/test DB thật; Q-804 cần phối hợp chạy critical E2E.

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
