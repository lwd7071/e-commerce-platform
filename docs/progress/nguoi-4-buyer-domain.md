# Nhật ký tiến độ — Người 4 (Buyer supporting domain)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-17
- Đang làm: Đã hoàn tất 100% phần việc "Làm được ngay, không cần chờ ai" và hoàn tất chu kỳ sửa lỗi TDD v3 (đạt 69/69 unit & port tests pass, sạch 100% typecheck)
- Bị block bởi: Đang chờ Người 1 scaffold/shared contracts và Người 2 database connection để tích hợp tiếp

## Nhật ký theo ngày

### 2026-09-17 (Sửa lỗi sau chẩn đoán Diagnose chuyên sâu theo TDD & bổ sung test suite)

- **Đã làm:**
  - **Khắc phục lỗi kiểm tra định dạng số tiền giảm giá rác:** Bổ sung kiểm tra định dạng số thập phân nghiêm ngặt `DECIMAL_REGEX = /^\d+(\.\d+)?$/` tại `validateDiscountRange` (`backend/src/modules/buyer/domain/voucher.ts`). Chặn đứng hoàn toàn việc chấp nhận các chuỗi số chứa ký tự rác (như `'10garbage'`, `'20garbage'`, `'abc'`) vốn lọt qua do cơ chế `parseFloat` trước đây (`RB-MG09`, `RB-LTT04`).
  - **Khắc phục lỗi kiểm tra thời điểm voucher không hợp lệ:** Bổ sung kiểm tra `isNaN(now)` tại `validateVoucherTime`. Từ chối dứt khoát các giá trị thời điểm rác như `'not-a-date'` hoặc chuỗi ISO hỏng với mã lỗi `VALIDATION_FAILED` (`RB-LTT03`, `QD09`).
  - **Khắc phục lỗi kiểm tra `orderSubtotal` và chặn discount giả mạo:** Bổ sung validate nghiêm ngặt `DECIMAL_REGEX` và giá trị không âm cho `subtotalStr` trong `calculateDiscountAmount` và `orderSubtotal` trong `evaluateVoucher`. Chặn đứng nguy cơ tạo ra discount amount giả khi đầu vào là chuỗi không hợp lệ (`RB-MG09`, `QD09`).
  - **Triển khai cơ chế Compensating Transaction Rollback cho `consumeVoucher`:**
    - Bổ sung phương thức `incrementQuantity?(voucherId: UUID): Promise<boolean>` vào `IVoucherRepository` (`domain/repositories.ts`).
    - Cài đặt `incrementQuantity` cho `InMemoryVoucherRepository` (`in-memory-repos.ts`).
    - Cập nhật `VoucherPortService.consumeVoucher`: bọc khối `recordUsage` trong `try/catch`. Khi `recordUsage` thất bại (ví dụ: DB error, conflict Order), tự động gọi `incrementQuantity` để phục hồi số lượt của voucher về nguyên vẹn, đảm bảo tính nguyên tử theo `order-workflow-transactions.md` §6 và `RB-LQH03`.
  - **Chuẩn hóa Module Imports:** Loại bỏ phần mở rộng `.ts` ở toàn bộ 13 file nguồn trong `backend/src/modules/buyer/` và các file test. Chuyển sang sử dụng `crypto.randomUUID()` Web Crypto API chuẩn. Kết quả: Vượt qua cổng kiểm tra `tsc --noEmit` đạt **Exit code 0, sạch 100% lỗi `TS5097`**.
  - **Bổ sung các test cases biên & idempotent theo bảng plan:**
    - `[RB-LB05] ADDR-03`: Gọi lại trên địa chỉ vốn đã là default -> giữ nguyên `isDefault=true` (idempotent) — Pass.
    - `[RB-LB05] ADDR-04`: `targetAddressId` không tồn tại trong danh sách -> reject `VALIDATION_FAILED` — Pass.
    - `[RB-MG05] CART-03`: `quantity = 1.5` (số thập phân) -> reject `VALIDATION_FAILED` — Pass.
    - `[RB-LB04] CART-08`: Thêm variant khác vào cart -> tách thành 2 dòng riêng biệt — Pass.
  - **Đồng bộ hóa cấu trúc thư mục kiểm thử:** Thiết lập thư mục `backend/tests/modules/buyer/*.test.ts` chuẩn dự án (đồng bộ với Người 2 Database và Người 3 Catalog) đồng thời duy trì tương thích hoàn hảo cho `backend/test/modules/buyer/*.spec.ts`.
- **Test bổ sung (TDD Red → Green):**
  - `[RB-MG09]` type=FIXED, value="10garbage" có ký tự rác -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` type=FIXED, value="abc" không phải số -> reject VALIDATION_FAILED — Pass.
  - `[RB-LTT04]` type=PERCENT, value="20garbage" có ký tự rác -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` type=FIXED, value="0.00" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` calculateDiscountAmount với subtotal="not-a-number" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` evaluateVoucher với orderSubtotal="abc" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` evaluateVoucher với orderSubtotal="100000garbage" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` evaluateVoucher với orderSubtotal="-50000" -> reject VALIDATION_FAILED — Pass.
  - `[RB-LTT03, QD09]` now = "not-a-date" không hợp lệ -> reject VALIDATION_FAILED — Pass.
  - `[RB-LTT03, QD09]` now = "invalid-iso-string" -> reject VALIDATION_FAILED — Pass.
  - `[QD09, RB-LTT03]` evaluateVoucher với now="not-a-date" -> reject VALIDATION_FAILED — Pass.
  - `[RB-LQH03, Concurrency]` consumeVoucher: khi recordUsage thất bại -> kích hoạt rollback incrementQuantity và bảo toàn quantity — Pass.
- **Tổng số test cases nâng lên:** **69/69 tests PASS 100%** trên cả hai bộ runner (`backend/tests/modules/buyer/*.test.ts` và `backend/test/modules/buyer/*.spec.ts`).

### 2026-09-16
- Áp dụng triệt để phương pháp TDD (`/tdd` skill), thực hiện đầy đủ các vertical slices (Red → Green), không bỏ qua test nào.
- **Phase 1 (Khóa hợp đồng & Types):**
  - Tạo `src/modules/buyer/domain/types.ts`: Định nghĩa types cho 6 thực thể theo Schema Freeze v1 (`UserProfile`, `Address`, `Cart`, `CartItem`, `Voucher`, `VoucherUsage`, `Review`, `ReviewImage`, `Notification`).
  - Tạo `src/modules/buyer/domain/errors.ts`: Định nghĩa error codes chuẩn (`VALIDATION_FAILED`, `VOUCHER_NOT_APPLICABLE`, `CART_CONFLICT`, `CART_ITEM_CONFLICT`, `DEFAULT_ADDRESS_CONFLICT`, `REVIEW_NOT_ELIGIBLE`, `REVIEW_ALREADY_EXISTS`, v.v.).
  - Tạo `src/modules/buyer/ports/cart.port.ts`: Đóng băng hợp đồng `ICartPort` (`getSelectedItems`, `clearCheckedOutItems`).
  - Tạo `src/modules/buyer/ports/voucher.port.ts`: Đóng băng hợp đồng `IVoucherPort` (`evaluateVoucher`, `consumeVoucher`), làm rõ `discountAmount` là input cho QD10/RB-LQH03 ở Order của Người 5.
  - Tạo `test/modules/buyer/fixtures.ts`: Mock data dùng chung cho unit tests.
- **Phase 2 (TDD Voucher & Cart Rules):**
  - Viết `test/modules/buyer/voucher.spec.ts` và triển khai `src/modules/buyer/domain/voucher.ts`:
    - Slice 1 (Thời gian, RB-LTT03, QD09): StartAt < EndAt, chặn hết hạn hoặc chưa tới hạn.
    - Slice 2 (Loại giảm giá & miền giá trị, RB-LTT04, RB-MG09): PERCENT trong (0, 100], FIXED > 0.
    - Slice 3 (Tính tiền giảm & Cap, RB-MG09): Tính discountAmount chính xác, cap theo MaxDiscount và Subtotal.
    - Slice 4 (Scope, lượt dùng, min order, QD09, RB-LTT05): PLATFORM shopId null, SHOP shopId not null, trùng shopId, quantity > 0, subtotal >= minOrderValue.
  - Viết `test/modules/buyer/cart.spec.ts` và triển khai `src/modules/buyer/domain/cart.ts`:
    - Slice 1 (RB-MG05): Cart quantity >= 1.
    - Slice 2 (RB-LB04): UNIQUE(cartId, variantId), cộng dồn quantity khi thêm trùng variant thay vì tạo dòng mới.
    - Slice 3 (RB-LB03): 1 cart / buyer (chặn `CART_CONFLICT` khi đã có giỏ).
- **Phase 3 (TDD Address, Review & Notification Rules):**
  - Viết `test/modules/buyer/address.spec.ts` và triển khai `src/modules/buyer/domain/address.ts`:
    - Slice 1 (RB-LB05): Duy nhất 1 địa chỉ mặc định, tự động chuyển các địa chỉ cũ thành `isDefault = false`.
  - Viết `test/modules/buyer/review.spec.ts` và triển khai `src/modules/buyer/domain/review.ts`:
    - Slice 1 (QD15, RB-MG08): Rating integer từ 1 đến 5.
    - Slice 2 (QD14, RB-LB09): Review eligibility (đúng buyer sở hữu, đơn COMPLETED, chặn duplicate review `REVIEW_ALREADY_EXISTS`).
  - Viết `test/modules/buyer/notification.spec.ts` và triển khai `src/modules/buyer/domain/notification.ts`:
    - Slice 1 (RB-LTT07): Đánh dấu đã đọc tự động set `readAt = now()`, xử lý idempotent khi gọi lặp.
- **Phase 4 & Phase 5 (DTOs, Repository Interfaces, Services & Endpoint Contracts):**
  - Triển khai `src/modules/buyer/contracts/buyer.dto.ts` kèm hàm validate reject unknown fields với `422 VALIDATION_FAILED` theo `api-conventions.md` §2.
  - Triển khai `src/modules/buyer/domain/repositories.ts`: Interface độc lập cho 6 repositories.
  - Triển khai `src/modules/buyer/services/cart-port.service.ts` và `src/modules/buyer/services/voucher-port.service.ts`.
  - Viết `test/modules/buyer/ports.spec.ts`: Xác nhận 100% các case của `ICartPort` và `IVoucherPort` pass xanh.
  - Viết `test/modules/buyer/dto-validation.spec.ts`: Xác nhận validation DTOs pass xanh.
  - Soạn tài liệu bàn giao `src/modules/buyer/contracts/endpoint-contracts.md` đầy đủ format `/api/v1` và Envelope chuẩn, ghi rõ PATCH notification resource-based theo đúng `api-conventions.md` §1.
- **Kết quả kiểm thử toàn diện:**
  - Chạy `node --test backend/test/modules/buyer/*.spec.ts`: Đạt **53/53 tests PASS (100% xanh)**, không có test nào bị skip hay lỗi.

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| `ICartPort` | Sẵn sàng bàn giao (đã có implementation + tests) | v1 / 2026-09-16 | Người 5 (Transaction Core), Người 1 |
| `IVoucherPort` | Sẵn sàng bàn giao (đã có implementation + compensating rollback + tests) | v2 / 2026-09-17 | Người 5 (Transaction Core), Người 1 |
| Buyer Supporting REST Contracts | Đã công bố tại `endpoint-contracts.md` | v1 / 2026-09-16 | Người 1 (Platform Lead) |

## Việc còn lại trong mốc hiện tại

- [x] Thiết kế model, DTO, validation và repository interface cho Profile, Address, Cart, Voucher, Review và Notification.
- [x] Định nghĩa, công bố Cart port và Voucher port cho Người 5.
- [x] Soạn endpoint contract cho Buyer supporting domain và mock fixture theo Schema Freeze.
- [x] Viết unit test thuần cho cart quantity, voucher rule, rating và default address.
- [x] Sửa triệt để các lỗi chẩn đoán (decimal rác, date không hợp lệ, subtotal rác, rollback cho voucher consumption, chuẩn hóa imports sạch không có đuôi `.ts`).
- [ ] Sau khi Người 1 hoàn thành scaffold và cấu trúc module: đặt Buyer modules vào backend.
- [ ] Sau khi Người 1 mở shared contract structure: đưa Cart/Voucher port vào `src/contracts` qua owner.
- [ ] Sau khi Người 2 hoàn thành migration các bảng liên quan và database client: chạy repository integration test.
- [ ] Sau khi Người 1 khóa `RequestContext`: wiring endpoint cần kiểm tra ownership.
- [ ] Sau khi Người 5 khóa Order query/state contract: tích hợp Review với Order thật.
