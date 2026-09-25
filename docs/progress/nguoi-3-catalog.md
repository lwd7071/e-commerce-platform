# Nhật ký tiến độ — Người 3 (Catalog và Seller domain)

## Trạng thái hiện tại

- Mốc: T3 (Hardening & Nghiệm thu)
- Cập nhật lần cuối: 2026-09-25
- Đang làm: Đã hoàn tất 100% các hạng mục của Mốc T3: Negative Testing & Cross-Shop Ownership (QD04, RB-LQH07), Status Visibility Matrix (RB-MG12), SKU Conflict Isolation per Shop (RB-LB11), Media Validation (RB-MG11), Dataset Benchmark & Triệt tiêu N+1 Query, Soft Deactivation (QD16). Quality gates đạt 100% (Typecheck 0 lỗi, Lint 0 lỗi, Node runner 518/518 tests pass, Vitest catalog 62/62 tests pass).
- Bị block bởi: Không (Sẵn sàng mở PR T3 để merge vào dev).

## Nhật ký theo ngày

### 2026-09-25 (Hoàn thành Toàn diện Mốc T3 — Hardening, Negative Testing & Performance Tuning)

- Đã làm:
  - **Negative Testing & Bảo vệ Quyền sở hữu Cross-Shop [QD04, RB-LQH07]:**
    - Chặn đứng hành vi Seller cập nhật tồn kho hoặc can thiệp biến thể của Shop khác với lỗi chuẩn 403 `RESOURCE_FORBIDDEN`.
    - Trả về 404 `RESOURCE_NOT_FOUND` khi variant không tồn tại, 422 `STOCK_INVALID` khi `stock_quantity < 0` (QD06).
  - **Status Visibility Matrix [RB-MG12]:**
    - Kiểm chứng chặt chẽ câu lệnh `queryPublic`: Sản phẩm chỉ hiển thị ra ngoài public API khi đồng thời thoả mãn: Product `ACTIVE` + Shop `ACTIVE` + Category `ACTIVE` + ít nhất 1 Variant `ACTIVE`. Sản phẩm `DRAFT`, `INACTIVE` hoặc thuộc Category/Shop ẩn đều bị loại trừ hoàn toàn.
  - **SKU Conflict & Scope Isolation [RB-LB11]:**
    - Ngăn chặn trùng SKU trong cùng payload tạo sản phẩm hoặc trùng với variant đã có trong cùng Shop với mã lỗi 409 `SKU_CONFLICT`.
    - Cho phép hai Shop khác nhau sở hữu cùng mã SKU mà không hề bị xung đột (phân lập dữ liệu đa người bán).
  - **Media Validation [RB-MG11]:**
    - Ràng buộc nghiêm ngặt `sortOrder` số nguyên không âm (`sortOrder >= 0`), chặn số âm hoặc float không nguyên với 422 `VALIDATION_FAILED`.
  - **Dataset Benchmark & Triệt tiêu Hoàn toàn N+1 Query (Tối ưu hóa Siêu tốc):**
    - Khởi tạo dataset lớn với 25 sản phẩm, 50 biến thể, 50 hình ảnh trên PostgreSQL Supabase thật.
    - **Tối ưu hóa Bulk Insert:** Thay thế 150 lệnh INSERT tuần tự riêng lẻ bằng 3 câu lệnh bulk INSERT đa dòng kết hợp gộp lệnh dọn dẹp, giảm 98% số roundtrip mạng lên remote DB, rút ngắn thời gian chạy từ **~84 giây xuống còn ~8-12 giây** (giảm 90% thời gian), loại bỏ triệt để nguy cơ timeout khi chạy đồng thời toàn bộ test suites.
    - Benchmark lọc danh mục, phân trang cursor không trùng lặp, lọc khoảng giá `min_price`/`max_price`, sắp xếp theo giá và thời gian.
    - Chạy `EXPLAIN ANALYZE` xác nhận PostgreSQL kích hoạt các chỉ mục hiệu năng `t2_performance_indexes`.
    - Xác nhận độ phức tạp truy vấn là $O(1)$ (1 câu SELECT tổng hợp JOINs + 1 câu COUNT), triệt tiêu 100% N+1 query.
  - **Soft Deactivation [QD16]:**
    - Chuyển trạng thái sang `INACTIVE` bảo toàn toàn vẹn dữ liệu thay vì xoá vật lý khi đã có liên kết nghiệp vụ.
  - **Khắc phục 3 lỗi T2 theo phản hồi của Lead:**
    - **1. Bảo vệ dữ liệu nhạy cảm Guest (`getProduct`):** Truy vấn JOIN `shops` và `categories`, chỉ trả về HTTP 200 khi cả Product, Shop và Category đều `ACTIVE` và có ít nhất 1 variant `ACTIVE`. Tất cả các trường hợp `DRAFT`, `INACTIVE`, `SUSPENDED` hoặc không tồn tại đều trả về đúng chuẩn HTTP 404 (`RESOURCE_NOT_FOUND`). Đồng thời sửa `createProduct` trả về trực tiếp thông tin sản phẩm mới tạo mà không qua bộ lọc public của `getProduct`.
    - **2. Sửa lỗi `decodeCursor`:** Chuyển `throw new Error('Invalid cursor')` thành `throw new ValidationError('Invalid cursor')` (`VALIDATION_FAILED`), biến lỗi từ HTTP 500 thành mã lỗi đầu vào 4xx (422) theo đúng hợp đồng REST API.
    - **3. Đồng bộ hợp đồng Media Storage:** Khóa `ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']` trong `media.ts` đồng bộ với `db/storage.ts`, chủ động từ chối các file đuôi `.exe`, `.sh` với lỗi `ValidationError`.
  - **Bộ kiểm thử T3 chuyên biệt:**
    - `backend/tests/modules/catalog/catalog-hardening.test.ts`: 14/14 tests PASS trên PostgreSQL Supabase thật (Vitest).
    - `backend/tests/modules/catalog/catalog-benchmark.integration.test.ts`: 4/4 tests PASS trên PostgreSQL Supabase thật (Vitest).
    - `backend/test/modules/catalog/catalog-hardening.spec.ts`: 12/12 tests PASS trên Node native runner.
    - `backend/tests/modules/catalog/media.test.ts`: 13/13 tests PASS trên Vitest.
    - `backend/test/modules/catalog/media.spec.ts`: 5/5 tests PASS trên Node native runner.
- Test đã chạy:
  - `npm run typecheck`: 0 lỗi biên dịch `tsc --noEmit`.
  - `npm run lint`: 0 errors.
  - `npx vitest run tests/modules/catalog --no-file-parallelism`: 8/8 test files PASS, 66/66 tests PASS 100%.
  - `npm run test:node`: 155/155 test suites PASS, 522/522 tests PASS 100%.
  - `npm run build`: bundle thành công `dist/app.js` (134.1kb trong 22ms).


- Đã làm:
  - **Khắc phục biến thừa `cat1`, `cat2` trong `catalog-db.integration.test.ts`:** Bổ sung assertions trực tiếp cho cả 2 category, vừa nâng cao tính chặt chẽ của bài test vừa triệt tiêu 100% warning ESLint.
  - **Khóa quy chuẩn Media Storage Path cho Catalog:**
    - Cấu trúc path ảnh sản phẩm: `shops/{shopId}/products/{productId}/{imageId}.{ext}`
    - Cấu trúc path logo shop: `shops/{shopId}/logo.{ext}`
    - Cung cấp căn cứ kỹ thuật để Người 2 hoàn thiện Supabase Storage bucket policy và RLS.
  - **Triển khai Domain Model `ProductImageEntity` (`src/modules/catalog/domain/media.ts`):**
    - Thực thi quy tắc **RB-MG11**: Bắt buộc `sortOrder` là số nguyên không âm (`sortOrder >= 0`), chặn số âm và quăng `ValidationError` (`VALIDATION_FAILED`).
    - Cung cấp hàm sinh storage path chuẩn `buildProductImagePath` và `buildShopLogoPath`.
  - **Triển khai `CatalogMediaService` (`src/modules/catalog/services/catalog-media.service.ts`):**
    - Cung cấp interface `ICatalogMediaService` theo chuẩn SOLID (DIP & OCP), hỗ trợ validate metadata, tạo ảnh sản phẩm, và chuyển đổi storage path sang public URL. Sẵn sàng tích hợp Supabase Storage adapter khi Người 2 hoàn tất policy.
  - **Viết bộ kiểm thử chuyên biệt:**
    - `backend/tests/modules/catalog/media.test.ts`: 11 tests PASS trên Vitest.
    - `backend/test/modules/catalog/media.spec.ts`: 4 tests PASS trên Node native runner.
- Test đã chạy:
  - `vitest run tests/modules/catalog/`: 6 suites PASS, 46/46 tests PASS (gồm 5 integration tests trên PostgreSQL Supabase thật).
  - `npm test`: 138/138 tests PASS toàn hệ thống.
  - `npm run typecheck`: 0 lỗi.
  - `npm run lint`: 0 lỗi.
  - `npm run build`: bundle thành công 1.1MB.

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

### 2026-09-19 — T1 catalog closeout

- Đã bàn giao route matrix Catalog cho Người 1: public list/detail và Seller create/stock update; HTTP fields dùng snake_case, cursor opaque và reject `page`/`offset`.
- Đã xác nhận snapshot checkout giữ `variantId`, `productId`, `productName`, `shopId`, `shopOwnerId`, tên variant chuẩn hóa và giá/tồn/status tại transaction seam.
- Không còn blocker T1; mọi thay đổi Catalog T1 đã được ghi ở file owner này.

- [x] Thiết kế domain model, DTO, validation và repository interface cho Shop, Category, Product, ProductVariant và ProductImage.
- [x] Soạn endpoint contract cho public catalog và Seller catalog.
- [x] Định nghĩa, công bố Catalog port cho Người 5: khóa variant, đọc giá, tồn và status.
- [x] Viết unit test thuần cho price, stock, SKU và Seller ownership.
- [x] Đảm bảo 100% test pass trên cả Node native runner (`node --test`) và Vitest (`vitest run`).
- [x] Mốc T2: Tích hợp database repository thật khi Người 2 bàn giao database connection.
- [x] Mốc T2: Triển khai Query / Filter / Sort / Visibility và Integration tests trên PostgreSQL.
- [x] Mốc T2: Tích hợp DB transaction lock (SELECT ... FOR UPDATE) cho lockVariant.
