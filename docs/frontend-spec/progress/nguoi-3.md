# Tiến độ FE — Người 3 (Catalog và Seller Catalog)

## Trạng thái hiện tại

- Phase/ticket: Phase 3 (B-301 [x], B-302 [x], B-305 [x]), Phase 4 (B-401 [x]), Phase 5 (O-508 [x], O-509 [x], Product Create [x]), Phase 7 (A-700 [x], A-702 [x]), Core (B-102 [x], B-103 [x], B-105 [x], B-201–B-205 [x], C-205 [x], C-403 [x])
- Cập nhật lần cuối: 2026-09-30
- Đang làm: Hoàn tất trọn vẹn toàn bộ nhiệm vụ Người 3 theo chỉ thị của Lead và `docs/frontend-spec/08-implementation-plan.md`:
  - **Backend Seller Products**: Triển khai `GET /seller/products` (strictly scoped theo `context.shop_id`) và `PATCH /seller/products/:id/status` (bật/tắt ACTIVE ↔ INACTIVE kèm kiểm tra quyền sở hữu Shop).
  - **Backend Media Verification API**: `POST /media/uploads/presign`, `POST /media/uploads/:id/finalize` (kiểm tra magic bytes JPEG/PNG/WebP, từ chối file giả mạo với ValidationFailedError), và `DELETE /media/uploads/:id`.
  - **Backend Admin Category CRUD & Status API**: `GET /admin/categories`, `POST /admin/categories`, `PATCH /admin/categories/:id`, `PATCH /admin/categories/:id/status` với RB-KN04 cây danh mục tối đa 2 cấp và chống vòng lặp cha-con.
  - **OpenAPI 3.1.0**: Bổ sung đầy đủ 10 endpoint mới trong `openapi-spec.ts`, pass 100% test contract `[OAS-05]`.
  - **Frontend Repositories & UI**: Triển khai `IMediaRepository`, `mediaApi`, kết nối `apiCatalogRepository.getSellerProducts` và `updateProductStatus`. Nâng cấp `ProductDetailScreen` hiển thị đánh giá và aggregate rating thật từ `reviewRepository` (loại bỏ fallback 5 sao giả), hỗ trợ gallery ảnh và `next/image` alt text. Nâng cấp `SellerProductsScreen` bổ sung cột "Trạng thái" và nút toggle "Ẩn/Hiện" trực tiếp.
- Nhánh/PR: `feat/fe-nguoi-3-catalog`
- Bị block bởi: Không (Các blocker GAP-04, GAP-05, GAP-09 đã được tháo gỡ hoàn toàn).
- Việc tiếp theo: Bàn giao toàn bộ phân hệ Catalog & Seller Products cho Lead kiểm tra và merge.

## Nhật ký theo ngày

### 2026-09-30 — Hoàn tất B-102, B-103, B-105, B-201–B-205, C-205, C-403 & Tháo gỡ toàn bộ Gaps

- Đã làm:
  - **B-102 & B-103: Media Presign/Finalize/Delete API & IMediaRepository**:
    - Xây dựng router `backend/src/platform/http/routes/media-routes.ts` hỗ trợ presign, finalize và delete media.
    - Tại `finalize`, cài đặt kiểm tra magic byte cho 3 định dạng JPEG (`ffd8ff`), PNG (`89504e47`), WebP (`52494646`...`57454250`), ném `ValidationFailedError` khi magic bytes không hợp lệ.
    - Bổ sung `IMediaRepository` vào `frontend/src/lib/repositories/types.ts` và tích hợp `apiMediaRepository` / `mockMediaRepository` qua `repositories.media()`.
    - Cập nhật `uploadMedia` từ chối fallback URL giả mạo khi chạy trong môi trường production (`features.isProduction()`).
  - **B-105: Next/Image Product Assets & Gallery**:
    - Trong `backend/src/modules/catalog/services/pg-catalog-http.service.ts`: `getProduct` truy vấn trực tiếp bảng `product_images`, trả về danh sách ảnh kèm `sort_order`.
    - Trong `product-detail-screen.tsx`: Tích hợp gallery ảnh nhiều góc chụp, thumbnail chọn ảnh chính, `next/image` với `alt` text chuẩn SEO và fallback linh hoạt.
  - **B-201–B-205: Luồng Quản lý Sản phẩm Người bán Live (Tháo gỡ GAP-04)**:
    - Triển khai `listSellerProducts` trong `PgCatalogHttpService` lọc nghiêm ngặt theo `context.shop_id` từ JWT token.
    - Triển khai `updateProductStatus` cho phép chuyển đổi trạng thái `ACTIVE` / `INACTIVE` với kiểm tra quyền sở hữu Shop.
    - Mount routes `GET /seller/products` và `PATCH /seller/products/:id/status` tại `backend/src/platform/http/routes/t1-routes.ts`.
    - Kết nối `apiCatalogRepository.getSellerProducts` và `updateProductStatus` trên frontend; bổ sung cột "Trạng thái" và nút toggle "Ẩn/Hiện" với loading indicator trên bảng quản lý sản phẩm.
  - **C-205: Product Detail Rating & Reviews Thật**:
    - Tích hợp `repositories.review().getReviewsByProduct(productId)` trong `ProductDetailScreen`.
    - Hiển thị điểm trung bình và số lượng đánh giá thực tế; nếu chưa có đánh giá hiển thị empty state chuẩn "Chưa có đánh giá nào cho sản phẩm này", triệt để loại bỏ fake 5-star fallback.
  - **C-403: Admin Category CRUD & Status Backend (Tháo gỡ GAP-05/A-701)**:
    - Triển khai `listAllCategories`, `createCategory`, `updateCategory`, `updateCategoryStatus` trong `PgCatalogHttpService`.
    - Kiểm soát nghiêm ngặt quy tắc RB-KN04 (cây danh mục tối đa 2 cấp) và phòng chống chu trình cha-con (cycle prevention).
    - Mount 4 routes tại `backend/src/platform/http/routes/admin-routes.ts`.
  - **OpenAPI 3.1.0 Compliance (`[OAS-05]` & Contract Testing)**:
    - Khai báo toàn bộ 10 endpoint mới trong `backend/src/platform/openapi/openapi-spec.ts`.
  - **Quality Gates Verification**:
    - Backend: `typecheck` PASS (0 lỗi), `lint` PASS (0 lỗi, 0 warnings), `build` PASS (`dist/app.js` 260.7kb), `test:node` PASS 609/609 tests (172/172 suites).
    - Frontend: `typecheck` PASS (0 lỗi), `lint` PASS (0 lỗi, 0 warnings), `test` PASS 34/34 files (190/190 tests), `build` PASS (22/22 routes prerendered sạch).

### 2026-09-29 (Lần 2) — Hoàn thiện FE Tạo sản phẩm (POST /products), Semantic Tokens màu tồn kho và Vùng chạm 44px

- Đã làm:
  - **Màn hình Tạo sản phẩm mới (`/seller/products/new`)**:
    - Xây dựng component `SellerProductCreateScreen` tại `frontend/src/features/seller/seller-product-create-screen.tsx`.
    - Tạo route page được bảo vệ tại `frontend/src/app/seller/products/new/page.tsx` với role yêu cầu `["SELLER", "ADMIN"]`.
    - Triển khai đầy đủ payload contract của `POST /products`:
      - `product_name`: Nhập tên sản phẩm bắt buộc.
      - `category_id`: Lựa chọn danh mục ngành hàng đã xác minh (Verified Categories) tích hợp `categoryAdapter.getCategories()` và `DEV_CATEGORY_FIXTURES`.
      - `description`: Mô tả chi tiết sản phẩm.
      - `images`: Nhập URL hình ảnh HTTPS kèm bộ ảnh mẫu đã xác minh (Verified Presets) và xem trước trực quan (thumbnail preview, thứ tự hiển thị, xóa ảnh).
      - `variants`: Quản lý danh sách biến thể (tối thiểu 1 biến thể), cấu hình thuộc tính, giá trị, mã SKU duy nhất trong payload (RB-LB11), giá bán > 0₫ (QD05) và tồn kho số nguyên không âm (QD06) với `validateStockQuantityInput`.
    - Bắt lỗi chuyên biệt: hiển thị lỗi SKU trùng lặp (409 Conflict), lỗi phân quyền (403 Forbidden), và lỗi xác thực (400 Bad Request).
    - Thành công hiển thị toast thông báo và điều hướng về trang quản lý `/seller/products`.
  - **Chuẩn hóa Màu tồn kho bằng Semantic Tokens**:
    - Bổ sung `--success-border: #a7f3d0;` vào `frontend/src/app/globals.css`.
    - Thay thế toàn bộ màu hex hardcode (`#edfbf2`, `#126239`, v.v.) trong `seller-products-screen.tsx` bằng CSS variables ngữ nghĩa:
      - Tồn kho > 10: `bg-[var(--success-surface)] text-[var(--success)] border-[var(--success-border)]`
      - Tồn kho 1–10: `bg-[var(--warning-surface)] text-[var(--warning)] border-[var(--warning-border)]`
      - Hết hàng: `bg-[var(--danger-surface)] text-[var(--danger)] border-[var(--danger-border)]`
  - **Vùng chạm tối thiểu 44px cho Bộ lọc Danh mục & Controls**:
    - Cập nhật `catalog-list-screen.tsx`: thêm `min-h-[44px] min-w-[44px] inline-flex items-center justify-center` cho các nút danh mục ("Tất cả", từng danh mục con/gốc).
    - Cập nhật ô nhập khoảng giá (`min_price`, `max_price`) và dropdown sắp xếp đạt chiều cao chuẩn `min-h-[44px] h-11` đáp ứng khuyến nghị WCAG 2.1 Target Size.
  - **Nâng cấp Stateful Mock Catalog Repository**:
    - Trong `frontend/src/lib/repositories/repository-factory.ts`, triển khai store in-memory động (`dynamicMockProducts`, `dynamicMockDetails`).
    - `createProduct` tự động đẩy sản phẩm mới vào danh sách và cập nhật chi tiết; `updateStock` cập nhật đúng biến thể và tính lại `total_stock` của sản phẩm cha.
    - Cho phép kiểm thử trọn vẹn luồng tạo sản phẩm -> xem danh sách gian hàng -> chỉnh sửa tồn kho nhanh ngay trong môi trường dev/mock.
  - **Bổ sung Unit Tests**:
    - Tạo mới `frontend/test/catalog-product-create.spec.ts` (5 tests): kiểm thử xác thực tồn kho biến thể (QD06), tạo sản phẩm và cập nhật tồn kho trong mock repository, và kiểm thử hợp đồng gửi `POST /products` & `PATCH /product-variants/:variant_id/stock` qua `catalogApi`.
- Quyết định UI/contract:
  - 100% tuân thủ design tokens hệ thống và kích thước chạm khả dụng.
  - Sử dụng verified category UUIDs và HTTPS image URLs cho toàn bộ luồng tạo sản phẩm.
- Test/kiểm tra:
  - `npm --prefix frontend run typecheck`: PASS (0 lỗi).
  - `npm --prefix frontend run lint`: PASS (0 lỗi, 0 warnings).
  - `npm --prefix frontend run test`: PASS 7/7 test files, 32/32 unit tests.
  - `npm --prefix frontend run build`: PASS (Turbopack compile sạch 11 routes).
- Blocker:
  - GAP-04: Chờ backend có `GET /seller/products` để mở ticket O-508 thành `[x]`.
  - GAP-05: Chờ backend có `GET /categories` để mở ticket A-702 thành `[x]`.

### 2026-09-29 (Lần 1) — Hoàn tất 6 hạng mục rà soát theo yêu cầu của Lead

- Đã làm:
  - **B-301: Đồng bộ URL bộ lọc & Debounce tìm kiếm**:
    - Xây dựng `frontend/src/features/catalog/catalog-query-engine.ts` chứa `buildCatalogUrlSearchParams()`, trích xuất sạch sẽ các tham số lọc vào query string của trình duyệt mà không làm reload trang.
    - Áp dụng `window.history.replaceState` trong `catalog-list-screen.tsx`: khi người dùng lọc theo danh mục, giá bán, hoặc sắp xếp, URL tự động lưu lại (`?category_id=...&sort=...&min_price=...`).
    - Thêm cơ chế debounce 300ms cho ô tìm kiếm sản phẩm: chỉ kích hoạt query và đồng bộ URL sau khi người dùng ngừng gõ 300ms, giảm tải request thừa và mượt mà trải nghiệm.
    - Cải tiến deduplication khi nối trang qua `Set(seenIds)`, bảo đảm không bao giờ trùng lặp item khi mạng lag.
  - **O-508: Phân quyền gian hàng, tìm kiếm, lọc tồn kho và phân trang (Gated GAP-04)**:
    - Tích hợp `useAuth()` vào `seller-products-screen.tsx` để nhận biết thông tin `user.shopId` của người bán hiện tại.
    - Lọc sản phẩm hiển thị chặt chẽ theo shop của người bán.
    - Bổ sung thanh tìm kiếm theo tên hoặc ID sản phẩm, bộ lọc trạng thái tồn kho (Tất cả, Còn hàng, Hết hàng) và thanh phân trang (10 sản phẩm/trang).
    - Cập nhật banner thông báo GAP-04 nêu rõ lý do phân quyền client-side tạm thời và giữ ticket ở trạng thái `[ ]` (chưa tick `[x]`) cho đến khi backend cung cấp `GET /seller/products`.
  - **O-509: Xử lý chuyên biệt mã lỗi sở hữu & Concurrency Conflict**:
    - Trong `handleSaveStock`, kiểm tra kiểu lỗi `AppError`:
      - `403 Forbidden`: Thông báo "Bạn không có quyền cập nhật tồn kho cho sản phẩm này".
      - `404 Not Found`: Thông báo "Không tìm thấy sản phẩm hoặc biến thể trên hệ thống".
      - `409 Conflict`: Thông báo "Dữ liệu tồn kho vừa thay đổi ở phiên khác (409 Conflict). Đang đồng bộ lại...", đồng thời tự động kích hoạt tải lại chi tiết biến thể và danh sách để UI đồng bộ với trạng thái mới nhất từ server.
    - Tách hàm `validateStockQuantityInput` vào `catalog-query-engine.ts` để tái sử dụng và kiểm thử nghiêm ngặt, chặn số thập phân (không ép kiểu `1.5` thành `1`) và số âm.
  - **A-702: Duy trì trạng thái Gated**:
    - Không đánh dấu `[x]` cho A-702 trong bảng tiến độ theo đúng yêu cầu kiểm định, ghi rõ phụ thuộc vào backend A-701.
  - **Category Fixtures: Chuẩn hóa cây 2 cấp RB-KN04**:
    - Bổ sung 3 danh mục cấp 2 (`00000000-0000-0000-0000-000000000110`, `...111`, `...112`) trong `DEV_CATEGORY_FIXTURES` liên kết trực tiếp vào 3 danh mục gốc qua `parentId`.
    - Bàn giao dữ liệu mock chuẩn cho Người 5, bảo đảm cây danh mục luôn có con hợp lệ.
  - **Unit Tests: Kiểm thử trực tiếp mã nguồn Production**:
    - Cập nhật `test/catalog-search-filters.spec.ts` nhập trực tiếp `validateStockQuantityInput`, `buildCatalogUrlSearchParams`, `createCatalogQueryCoordinator` từ `@/features/catalog/catalog-query-engine`.
    - Cập nhật `test/category-adapter.spec.ts` kiểm thử sự tồn tại của các danh mục con cấp 2.

### 2026-09-28 (Lần 3) — Khắc phục tương phản AA, validation tồn kho số nguyên, controlled search reset và race-condition guard

- Đã làm:
  - Màu trạng thái Seller đạt chuẩn tương phản AA.
  - Kiểm soát chặt chẽ nhập tồn kho số nguyên (không cắt 1.5).
  - Đồng bộ ô tìm kiếm khi Xóa bộ lọc.
  - Ngăn chặn Race Condition khi lọc bất đồng bộ.

### 2026-09-28 (Lần 2) — Khắc phục 3 điểm hợp đồng theo phản hồi của Lead

- Đã làm:
  - Sửa phân trang Catalog lấy trực tiếp opaque cursor từ backend.
  - Cách ly sản phẩm Người Bán theo Shop (GAP-04).
  - Fallback an toàn cho Category Fixtures (GAP-05).

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Product card/detail + add-to-cart action | Người 4 | Variant/quantity input, error/guest returnTo, toast, integration ready | Đã bàn giao | `frontend/src/features/catalog/product-detail-screen.tsx` |
| Category adapter | Người 5 | UUID xác minh, tree 2-level (RB-KN04), filter fallback (GAP-05), fixtures | Đã bàn giao | `frontend/src/lib/adapters/category.adapter.ts` |
| Seller product/media adapter | Người 1, 5 | Owner-scoped DTO, stock quick-edit mutation, 403/404/409 handling | Đã bàn giao | `frontend/src/features/seller/seller-products-screen.tsx` |
| Seller product creation | Toàn team | POST /products form, verified categories/images, SKU validation | Đã bàn giao | `frontend/src/features/seller/seller-product-create-screen.tsx` |
| Catalog Query & Validation Engine | Toàn team | URL sync, 300ms debounce, race guard, integer validation | Đã bàn giao | `frontend/src/features/catalog/catalog-query-engine.ts` |

## Việc được giao

- [x] B-301 — public catalog (đã hoàn tất URL giữ filter qua `window.history.replaceState`, 300ms debounce tìm kiếm, min-h-[44px] filter buttons, cursor pagination backend chuẩn).
- [x] B-302 — product detail view (đầy đủ variant selector, breadcrumb, mock fallback).
- [x] B-305 — category filtering (safe hide khi chưa có seed/backend GAP-05, min-h-[44px] touch target).
- [x] B-401 — product detail add-to-cart action; bàn giao command cho Người 4.
- [x] O-508 — seller product list (đã kết nối live `GET /seller/products` lọc strictly theo shop của seller từ token JWT, tìm kiếm, lọc tồn kho với semantic tokens, phân trang; tháo gỡ triệt để GAP-04).
- [x] O-509 — stock quick-edit (đã xử lý strict integer validation, xử lý chuyên biệt các mã lỗi 403 Forbidden, 404 Not Found, 409 Conflict có refresh dữ liệu).
- [x] Seller Product Create — tạo sản phẩm mới theo `POST /products` tại `/seller/products/new`, dùng category ID và image URL xác minh, kiểm soát SKU không trùng lặp.
- [x] P-607a / B-102 / B-103 — media verification upload API (presign, finalize magic bytes check, delete media, IMediaRepository; tháo gỡ GAP-09).
- [x] B-105 — `next/image` product assets và image gallery trong Product Detail.
- [x] B-201–B-205 — seller product flow: `GET /seller/products`, `PATCH /seller/products/:id/status` toggle UI "Ẩn/Hiện", `PATCH /products/:id/stock`.
- [x] C-205 — product detail real rating & review list từ reviewRepository (loại bỏ fake 5-star fallback).
- [x] C-403 — admin category CRUD/status backend (`GET /admin/categories`, `POST`, `PATCH`, `PATCH status`) tuân thủ RB-KN04 cây 2 cấp và chống chu trình.
- [x] A-700 — category adapter với cây 2 cấp (RB-KN04) và live safe hide (GAP-05); đã bàn giao Người 5.
- [x] A-702 — nối category UI trên homepage/seller catalog (đã triển khai backend categories live, tháo gỡ GAP-05).
