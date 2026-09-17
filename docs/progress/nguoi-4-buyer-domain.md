# Nhật ký tiến độ — Người 4 (Buyer supporting domain)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-16
- Đang làm: Đã hoàn tất 100% phần việc "Làm được ngay, không cần chờ ai" theo kế hoạch TDD v2
- Bị block bởi: Đang chờ Người 1 scaffold/shared contracts và Người 2 database connection để tích hợp tiếp

## Nhật ký theo ngày

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
| `IVoucherPort` | Sẵn sàng bàn giao (đã có implementation + tests) | v1 / 2026-09-16 | Người 5 (Transaction Core), Người 1 |
| Buyer Supporting REST Contracts | Đã công bố tại `endpoint-contracts.md` | v1 / 2026-09-16 | Người 1 (Platform Lead) |

## Việc còn lại trong mốc hiện tại

- [x] Thiết kế model, DTO, validation và repository interface cho Profile, Address, Cart, Voucher, Review và Notification.
- [x] Định nghĩa, công bố Cart port và Voucher port cho Người 5.
- [x] Soạn endpoint contract cho Buyer supporting domain và mock fixture theo Schema Freeze.
- [x] Viết unit test thuần cho cart quantity, voucher rule, rating và default address.
- [ ] Sau khi Người 1 hoàn thành scaffold và cấu trúc module: đặt Buyer modules vào backend.
- [ ] Sau khi Người 1 mở shared contract structure: đưa Cart/Voucher port vào `src/contracts` qua owner.
- [ ] Sau khi Người 2 hoàn thành migration các bảng liên quan và database client: chạy repository integration test.
- [ ] Sau khi Người 1 khóa `RequestContext`: wiring endpoint cần kiểm tra ownership.
- [ ] Sau khi Người 5 khóa Order query/state contract: tích hợp Review với Order thật.
