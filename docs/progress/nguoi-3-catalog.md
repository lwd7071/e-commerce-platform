# Nhật ký tiến độ — Người 3 (Catalog và Seller domain)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-17
- Đang làm: Đã giải quyết triệt để 5 điểm review của Lead; Khóa Catalog port contract kèm In-memory Mock cho testing; Sẵn sàng bước vào mốc T2 để tích hợp DB transaction thật
- Bị block bởi: Chờ Người 2 bàn giao DB client/connection để viết repository thật ở T2

## Nhật ký theo ngày

### 2026-09-17 (Khắc phục phản hồi của Lead & Đồng bộ nhánh dev)

- Đã làm:
  - **Khắc phục lỗi ERR_MODULE_NOT_FOUND trên Node.js:** Chuẩn hóa toàn bộ import trong `backend/src/modules/catalog/` và `backend/test/modules/catalog/` sang đuôi `.ts` rõ ràng theo đúng chuẩn ESM Node v24 (đồng bộ với module buyer, checkout, order). Lệnh `node --test test/modules/catalog/*.spec.ts` chạy trơn tru không còn lỗi module resolution.
  - **Khắc phục lỗi Vitest test suites:** Chuyển đổi bộ test tại `backend/tests/modules/catalog/*.test.ts` sang API bản địa của Vitest (`import { describe, it, expect, beforeEach } from 'vitest'`). Vitest nhận diện và chạy pass 100% cả 3 test suites (21/21 tests).
  - **Loại bỏ salePrice tuân thủ Schema Freeze v1:** Hoàn nguyên `ProductVariantEntity`, `types.ts`, `catalog.port.ts` và `seller-catalog.dto.ts` về đúng bảng `product_variants` trong `migration.sql` (chỉ có trường `price`, không tự ý thêm `sale_price` khi chưa có Change Request Approved).
  - **Làm rõ trạng thái Catalog Port:** Xác định rõ ở mốc T1, `CatalogPortService` là **In-memory Mock/Stub** phục vụ kiểm thử hợp đồng độc lập; cơ chế DB transaction locking/rollback thật sự sẽ được triển khai ở mốc T2 sau khi Người 2 bàn giao database client.
  - **Typecheck:** Kiểm tra kiểu dữ liệu TypeScript cho toàn bộ các file Catalog đạt 0 lỗi.
- Test đã chạy:
  - `node --test test/modules/catalog/*.spec.ts`: 21/21 tests PASS, 0 fail (thời gian ~500ms).
  - `vitest run tests/modules/catalog/`: 3 suites PASS, 21/21 tests PASS (thời gian ~1.1s).

### 2026-09-16 (Bổ sung sửa lỗi sau review ban đầu)

- Đã làm:
  - Khắc phục lỗi kiểm tra số lượng tại `lockVariant`: Bổ sung kiểm tra bắt buộc `quantity` phải là số nguyên dương (`Number.isInteger(quantity) && quantity > 0`). Chặn hoàn toàn trường hợp số âm làm tăng tồn kho (như `quantity = -2`) hoặc số lượng lẻ làm tồn kho bị thập phân (như `quantity = 0.5`).
  - Khắc phục lỗi định dạng giá tại `ProductVariantEntity`: Thay thế cơ chế `parseFloat` lỏng lẻo bằng regex số thập phân chặt chẽ `/^\d+(\.\d+)?$/`. Chặn đứng việc chấp nhận các chuỗi giá chứa ký tự rác (như `"10garbage"` hoặc `"abc"`).
  - Tạo cấu trúc thư mục `backend/tests/modules/catalog/` để chuẩn bị cho Vitest.

### 2026-09-16 (Khởi tạo T1 ban đầu)

- Đã làm:
  - Thiết kế đầy đủ Domain Types và chuẩn hóa Domain Errors (`ValidationError`, `StockInvalidError`, `ForbiddenError`, `SkuConflictError`, `InventoryInsufficientError`, `ResourceDeleteNotAllowedError`) tại `backend/src/modules/catalog/domain/`.
  - Triển khai Domain Entity `ProductVariantEntity` và `ProductEntity` kèm các quy tắc nghiệp vụ `QD05` (Giá > 0), `QD06` (Tồn kho >= 0) và `QD16` (Soft deactivation khi có giao dịch).
  - Triển khai `CategoryEntity` và `ShopEntity` với kiểm tra phân cấp danh mục tối đa 2 cấp (`RB-KN04`), quyền sở hữu gian hàng của Seller (`QD04`) và tính duy nhất của mã SKU trong từng Shop (`RB-LB11`).
  - Thiết kế và cài đặt `CatalogPortService` hiện thực hóa interface `ICatalogPort` (`lockVariant`, `getVariantPriceAndStock`, `checkShopActive`).
  - Soạn đầy đủ Endpoint DTO Contracts cho Public Catalog (`public-catalog.dto.ts`) và Seller Catalog (`seller-catalog.dto.ts`).

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ | Ghi chú |
|---|---|---|---|---|
| `ICatalogPort` (lockVariant, getVariantPriceAndStock, checkShopActive) | Đã khóa Contract (In-memory Mock cho T1) | v1 / 2026-09-17 | Người 5 | T2 sẽ gắn DB transaction thật khi có DB client |
| Public & Seller Catalog DTOs | Đề xuất | v1 / 2026-09-17 | Người 1 | Phục vụ routing |

## Việc còn lại trong mốc hiện tại

- [x] Thiết kế domain model, DTO, validation và repository interface cho Shop, Category, Product, ProductVariant và ProductImage.
- [x] Soạn endpoint contract cho public catalog và Seller catalog.
- [x] Định nghĩa, công bố Catalog port cho Người 5: khóa variant, đọc giá, tồn và status.
- [x] Viết unit test thuần cho price, stock, SKU và Seller ownership.
- [x] Đảm bảo 100% test pass trên cả Node native runner (`node --test`) và Vitest (`vitest run`).
- [ ] Mốc T2: Tích hợp database repository thật khi Người 2 bàn giao database connection.
