# Nhật ký tiến độ — Người 3 (Catalog và Seller domain)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-16
- Đang làm: Đã hoàn thành toàn bộ 4 đầu việc làm ngay của mốc T1; sẵn sàng bàn giao Catalog port cho Người 5
- Bị block bởi: Không

## Nhật ký theo ngày

### 2026-09-16

- Đã làm:
  - Thiết kế đầy đủ Domain Types và chuẩn hóa Domain Errors (`ValidationError`, `StockInvalidError`, `ForbiddenError`, `SkuConflictError`, `InventoryInsufficientError`, `ResourceDeleteNotAllowedError`) tại `backend/src/modules/catalog/domain/`.
  - Triển khai Domain Entity `ProductVariantEntity` và `ProductEntity` kèm các quy tắc nghiệp vụ `QD05` (Giá > 0), `QD06` (Tồn kho >= 0), `RB-LTT09` (SalePrice <= Price) và `QD16` (Soft deactivation khi có giao dịch).
  - Triển khai `CategoryEntity` và `ShopEntity` với kiểm tra phân cấp danh mục tối đa 2 cấp (`RB-KN04`), quyền sở hữu gian hàng của Seller (`QD04`) và tính duy nhất của mã SKU trong từng Shop (`RB-LB11`).
  - Thiết kế và cài đặt `CatalogPortService` hiện thực hóa interface `ICatalogPort` (`lockVariant`, `getVariantPriceAndStock`, `checkShopActive`) phục vụ kết nối trực tiếp với Transaction Checkout của Người 5.
  - Soạn đầy đủ Endpoint DTO Contracts cho Public Catalog (`public-catalog.dto.ts`) và Seller Catalog (`seller-catalog.dto.ts`).
- Quyết định kỹ thuật:
  - Bảng Product tuyệt đối không lưu giá và số lượng tồn kho (Single Source of Truth đặt tại ProductVariant đạt chuẩn 3NF).
  - Giá trị tiền tệ sử dụng chuỗi số thập phân (DecimalString) để tránh sai số dấu phẩy động JavaScript theo đúng `api-conventions.md`.
  - Giữ ranh giới kiểm thử tại các Seams công khai theo hướng dẫn của skill `tdd` (Matt Pocock).
- Contract/port thay đổi:
  - `ICatalogPort` — Công bố interface `getVariantPriceAndStock`, `lockVariant`, `checkShopActive` — Trạng thái: Đã khóa (Ready for consumption) — Ảnh hưởng: Người 5 (Transaction Core).
  - Public Catalog DTOs & Seller Catalog DTOs — Hoàn thành định nghĩa — Trạng thái: Đề xuất — Ảnh hưởng: Người 1 (Routing integration).
- Blocker phát sinh:
  - Không.
- Test đã viết:
  - `[QD05]` Giá bán > 0 (chấp nhận decimal string, từ chối <= 0) — Unit test — Kết quả: pass.
  - `[QD06]` Tồn kho >= 0 (chấp nhận 0 và dương, từ chối âm) — Unit test — Kết quả: pass.
  - `[RB-LTT09]` Giá khuyến mãi SalePrice <= Price — Unit test — Kết quả: pass.
  - `[QD16]` Soft deactivation chuyển HIDDEN/INACTIVE, chặn xóa cứng — Unit test — Kết quả: pass.
  - `[RB-KN04]` Cây danh mục tối đa 2 cấp — Unit test — Kết quả: pass.
  - `[QD04]` Seller chỉ thao tác trên Shop sở hữu — Unit test — Kết quả: pass.
  - `[RB-LB11]` SKU duy nhất trong phạm vi Shop — Unit test — Kết quả: pass.
  - `[QD07]` Khóa biến thể, trừ kho nguyên tử, chặn oversell — Port contract test — Kết quả: pass.
  - Tổng số: 19/19 test cases pass 100% (thời gian chạy: 551ms).

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| `ICatalogPort` (lockVariant, getVariantPriceAndStock, checkShopActive) | Đã khóa | v1 / 2026-09-16 | Người 5 |
| Public & Seller Catalog DTOs | Đề xuất | v1 / 2026-09-16 | Người 1 |

## Việc còn lại trong mốc hiện tại

- [x] Thiết kế domain model, DTO, validation và repository interface cho Shop, Category, Product, ProductVariant và ProductImage.
- [x] Soạn endpoint contract cho public catalog và Seller catalog.
- [x] Định nghĩa, công bố Catalog port cho Người 5: khóa variant, đọc giá, tồn và status.
- [x] Viết unit test thuần cho price, stock, SKU và Seller ownership.
- [ ] Sau khi Người 1 hoàn thành scaffold và cấu trúc module: đặt Catalog module vào backend.
- [ ] Sau khi Người 1 mở shared contract structure: đưa Catalog port vào `src/contracts` qua owner.
- [ ] Sau khi Người 2 hoàn thành migration Shop/Product/Variant/Image và database client: chạy repository integration test.
- [ ] Sau khi Người 1 hoàn thành `RequestContext` và auth middleware contract: wiring authenticated endpoint.
