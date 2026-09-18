# Nhật ký tiến độ — Người 3 (Catalog và Seller domain)

## Trạng thái hiện tại

- Mốc: T2
- Cập nhật lần cuối: 2026-09-18
- Đang làm: Đã hoàn thiện Repositories thật với PostgreSQL, CatalogPortService hỗ trợ row-level lock (SELECT ... FOR UPDATE) và withTransaction, hoàn thiện Query/Filter/Sort/Visibility và viết Integration Test với PostgreSQL
- Bị block bởi: Không (Đã tích hợp xong với DB client và Transaction helper của Người 2)

## Nhật ký theo ngày

### 2026-09-18 (Diagnose sau merge vào dev — sửa contract Catalog và xác nhận quality gate)

- Đã làm:
  - Điều tra lỗi `tsc --noEmit` phát hiện sau khi merge Catalog T2 vào `dev`.
  - Sửa `InMemoryProductRepository` nhận `IProductVariantRepository` thay vì phụ thuộc trực tiếp vào `InMemoryProductVariantRepository`; repository test không còn bị khóa vào một implementation cụ thể.
  - Đồng bộ `variantValue` thành `string | null` trong `ProductVariant`, `ProductVariantEntity`, `VariantPriceAndStockDTO` và `CreateProductInputDTO`, đúng với cột `product_variants.variant_value` nullable trong Schema Freeze v1.
  - Giữ nguyên hành vi runtime và không thay đổi migration/schema; đây là sửa lệch type contract giữa domain code, test fixture và database schema.
- Quyết định kỹ thuật:
  - Schema Freeze v1 là nguồn chuẩn cho tính nullable của `variant_value`; không ép fixture/test phải dùng chuỗi giả để qua typecheck.
  - Repository phụ thuộc interface domain để bảo đảm có thể thay implementation in-memory bằng PostgreSQL mà không đổi consumer.
- Contract/port thay đổi:
  - `ProductVariant.variantValue`, `VariantPriceAndStockDTO.variantValue`, `CreateProductInputDTO.variants[].variantValue` — đổi thành `string | null` — Trạng thái: Đã khóa điều chỉnh — Ảnh hưởng: Người 1 (routing/catalog DTO), Người 5 (CatalogPort).
  - `InMemoryProductRepository` — constructor nhận `IProductVariantRepository` — Trạng thái: Đã khóa điều chỉnh — Ảnh hưởng: test/repository Catalog.
- Blocker phát sinh:
  - Không.
- Test đã viết/chạy:
  - `npm run typecheck` — pass, 0 lỗi.
  - `npx vitest run tests/modules/catalog` — pass, 5 suites / 35 tests; gồm 5 live PostgreSQL integration tests cho row lock và rollback.
  - `npx vitest run tests/db` — pass, 9 suites / 43 tests; gồm migration, RLS, transaction và concurrency integration.
  - Transaction state machine Node tests — pass, 15/15 tests cho Order, Payment, Shipment và Checkout.
  - `npm test` — pass, Node 203/203 và Vitest 14 suites / 78 tests.
  - `npm run build` — pass.
  - `npm run lint` — pass, 0 errors; còn 168 warnings hiện hữu.
  - `git diff --check` — pass; không có debug instrumentation cần dọn.

### 2026-09-17 (Mốc T2 — Triển khai PostgreSQL Repositories, Query/Filter/Sort & Transaction Lock)

- Đã làm:
  - **Tạo Repository Interfaces chuẩn domain:** Thiết kế `IShopRepository`, `ICategoryRepository`, `IProductRepository`, `IProductVariantRepository` tại `src/modules/catalog/domain/repositories.ts`.
  - **Xây dựng In-memory Repository:** Phục vụ unit test độc lập với 9 unit tests chuyên biệt cho CRUD, query filter, sort và visibility rules.
  - **Triển khai PostgreSQL Repositories:** Cài đặt `PgShopRepository`, `PgCategoryRepository`, `PgProductRepository`, `PgProductVariantRepository` tại `src/modules/catalog/repositories/pg-catalog.repository.ts`, tương thích 100% với PostgreSQL schema freeze v1 (`migration.sql`).
  - **Hoàn thiện tính năng Query / Filter / Sort / Visibility:**
    - Lọc sản phẩm theo danh mục (`categoryId`), từ khóa tìm kiếm (`search`), khoảng giá (`minPrice`, `maxPrice`).
    - Sắp xếp (`sortBy`: `price_asc`, `price_desc`, `created_at_desc`) và phân trang (`limit`, `offset`).
    - Quy tắc hiển thị (Visibility Rules): Chỉ hiển thị cho khách/người mua các sản phẩm có trạng thái `ACTIVE` thuộc Shop `ACTIVE` và Danh mục `ACTIVE`.
  - **Nâng cấp CatalogPortService với Real DB Transaction Lock:** Hỗ trợ kết nối `Pool` và sử dụng `withTransaction` của Người 2; hàm `lockVariant` thực hiện `SELECT ... FOR UPDATE` khóa dòng ở cấp độ database, trừ kho an toàn chống race condition và tự động rollback khi outer transaction thất bại.
  - **Viết bộ kiểm thử tích hợp (Integration Tests):** Tạo `backend/tests/modules/catalog/catalog-db.integration.test.ts` kiểm thử trực tiếp trên PostgreSQL với đầy đủ các kịch bản: tạo shop/danh mục, tạo sản phẩm, query public, lock variant thành công, reject khi thiếu kho, và rollback khi outer transaction fail.
  - **An toàn bảo mật:** Cấu hình bỏ qua file `.env` ở cả root và backend `.gitignore`, đảm bảo không bao giờ commit secret lên git.
- Test đã chạy:
  - `vitest run tests/modules/catalog/`: 5 suites PASS, 35/35 tests PASS (gồm 30 unit tests + 5 live PostgreSQL integration tests).
  - `node --test test/modules/catalog/*.spec.ts`: 21/21 tests PASS.
  - `tsc --noEmit`: 0 lỗi typecheck.

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
| `ICatalogPort` (lockVariant, getVariantPriceAndStock, checkShopActive) | Đã khóa Contract, đã điều chỉnh nullable `variantValue` | v1.1 / 2026-09-18 | Người 5 | Đồng bộ Schema Freeze; T2 dùng DB transaction thật |
| Public & Seller Catalog DTOs | Đề xuất, đã điều chỉnh nullable `variantValue` | v1.1 / 2026-09-18 | Người 1 | Phục vụ routing; không thay đổi HTTP shape ngoài nullable contract |
| Catalog repository interfaces | Đã khóa Contract | v1 / 2026-09-18 | Catalog tests và PostgreSQL adapters | In-memory consumer phụ thuộc interface, không phụ thuộc implementation |

## Việc còn lại trong mốc hiện tại

### 2026-09-18 — T1 checkout snapshot và cursor contract

- Đã bổ sung metadata Catalog snapshot `productName`, `shopId`, `shopOwnerId` cho query
  variant join `product_variants → products → shops`; dùng được cho ownership và Order snapshot.
- Đã thêm `formatVariantSnapshot`: null value dùng `variantName`, có value dùng
  `variantName: variantValue`, trim và giới hạn 255 ký tự.
- Public query nhận `cursor` opaque, sort có `product_id` tie-breaker; HTTP seam đã khóa
  `category_id`, `search`, `min_price`, `max_price`, `sort`, `limit`, `cursor` và từ chối `page/offset`.
- Typecheck/build và Catalog regression suite pass.

- [x] Thiết kế domain model, DTO, validation và repository interface cho Shop, Category, Product, ProductVariant và ProductImage.
- [x] Soạn endpoint contract cho public catalog và Seller catalog.
- [x] Định nghĩa, công bố Catalog port cho Người 5: khóa variant, đọc giá, tồn và status.
- [x] Viết unit test thuần cho price, stock, SKU và Seller ownership.
- [x] Đảm bảo 100% test pass trên cả Node native runner (`node --test`) và Vitest (`vitest run`).
- [x] Mốc T2: Tích hợp database repository thật khi Người 2 bàn giao database connection.
- [x] Mốc T2: Triển khai Query / Filter / Sort / Visibility và Integration tests trên PostgreSQL.
- [x] Mốc T2: Tích hợp DB transaction lock (SELECT ... FOR UPDATE) cho lockVariant.
