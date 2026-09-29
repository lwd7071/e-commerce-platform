# Tiến độ FE — Người 3 (Catalog và Seller Catalog)

## Trạng thái hiện tại

- Phase/ticket: Phase 3 (B-301 [x], B-302 [x], B-305 [x]), Phase 4 (B-401 [x]), Phase 5 (O-508 [Gated GAP-04], O-509 [x]), Phase 7 (A-700 [x], A-702 [Gated GAP-05])
- Cập nhật lần cuối: 2026-09-29
- Đang làm: Đã xử lý triệt để 6 yêu cầu rà soát từ Lead:
  1. **B-301**: Đồng bộ URL bộ lọc (`search`, `category_id`, `sort`, `min_price`, `max_price`) qua `window.history.replaceState` và debounce 300ms ô tìm kiếm.
  2. **O-508**: Gian hàng phân quyền theo ngữ cảnh đăng nhập (`user.shopId`), có thanh tìm kiếm, bộ lọc tồn kho, và phân trang; giữ trạng thái gated `[ ]` theo GAP-04 trong khi chờ backend cung cấp endpoint seller-scoped.
  3. **O-509**: Bắt mã lỗi sở hữu chuyên biệt (403 Forbidden, 404 Not Found, 409 Conflict với cơ chế re-fetch đồng bộ lại phiên) và strict integer validation.
  4. **A-702**: Giữ nguyên trạng thái gated `[ ]` chưa tick `[x]` chờ backend hoàn thiện `GET /categories` (GAP-05 / A-701).
  5. **Category Fixtures**: Mở rộng `DEV_CATEGORY_FIXTURES` chuẩn cây 2 cấp (RB-KN04), mỗi danh mục gốc có đầy đủ danh mục con liên kết qua `parentId`.
  6. **Unit Tests Production**: `catalog-search-filters.spec.ts` import và kiểm thử trực tiếp các hàm từ mã nguồn thực tế `catalog-query-engine.ts`. Quality gates pass sạch 100%.
- Nhánh/PR: `feat/fe-nguoi-3-catalog`
- Bị block bởi: GAP-04 (chờ endpoint `GET /seller/products`), GAP-05/A-701 (chờ backend `GET /categories`), GAP-09/P-606 (chờ presigned upload S3).
- Việc tiếp theo: Phối hợp Người 4 nghiệm thu add-to-cart handoff; phối hợp Người 5 nghiệm thu category adapter; chờ backend mở P-606/GAP-09 để làm P-607a.

## Nhật ký theo ngày

### 2026-09-29 — Hoàn tất 6 hạng mục rà soát theo yêu cầu của Lead

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
- Quyết định UI/contract:
  - Tất cả URL params được đồng bộ một chiều từ filter state mà không gây re-render vòng lặp.
  - Xử lý lỗi HTTP dựa trên `AppError.status` mang tính đặc thù cho nghiệp vụ bán hàng.
- Test/kiểm tra:
  - `npm --prefix frontend run typecheck`: PASS (0 lỗi).
  - `npm --prefix frontend run lint`: PASS (0 lỗi, 0 warnings).
  - `npm --prefix frontend run test`: PASS 6/6 test files, 27/27 unit tests.
  - `npm --prefix frontend run build`: PASS (Turbopack compile sạch 10 routes).
- Blocker:
  - GAP-04: Chờ backend có `GET /seller/products` để mở ticket O-508 thành `[x]`.
  - GAP-05: Chờ backend có `GET /categories` để mở ticket A-702 thành `[x]`.

### 2026-09-28 (Lần 3) — Khắc phục tương phản AA, validation tồn kho số nguyên, controlled search reset và race-condition guard

- Đã làm:
  - **Màu trạng thái Seller đạt chuẩn tương phản AA ([P2])**:
    - Thay thế các màu badge trạng thái tồn kho bằng bảng màu tương phản cao đạt chuẩn WCAG AA (>= 4.5:1) và AAA:
      - Success (> 10): `bg-[#edfbf2] text-[#126239] border-[#b2e5c8]` (tương phản 6.8:1).
      - Warning (1–10): `bg-[#fff7e8] text-[#794600] border-[#f3dfb6]` (tương phản 6.2:1).
      - Danger (Hết hàng): `bg-[#fff0f2] text-[#8e2638] border-[#f0c2ca]` (tương phản 6.5:1).
  - **Kiểm soát chặt chẽ nhập tồn kho ([P2])**:
    - Chuyển `stockInput` thành chuỗi `string` và thêm `step="1"`, loại bỏ hoàn toàn `parseInt` âm thầm làm tròn xuống.
    - Dùng `Number(trimmed)` kết hợp `Number.isInteger(parsed)`. Khi người bán nhập số thập phân (như `1.5`) hoặc số âm, giao diện lập tức chặn lại và hiển thị thông báo lỗi rõ ràng thay vì tự ý cắt xén dữ liệu.
  - **Đồng bộ ô tìm kiếm khi Xóa bộ lọc ([P3])**:
    - Chuyển ô input tìm kiếm trong `catalog-list-screen.tsx` từ `defaultValue` thành controlled component (`value={search}`, `onChange`).
    - Nút "Xóa bộ lọc" (`handleResetFilters`) gọi `setSearch("")` xóa sạch văn bản trong ô input đồng thời với việc cập nhật lại dữ liệu hiển thị.
  - **Ngăn chặn Race Condition khi lọc bất đồng bộ**:
    - Bổ sung `activeQueryRef = useRef(0)` monotonic guard trong `fetchProducts`. Bất kỳ response nào của request cũ về muộn hơn request mới đều bị hủy bỏ tự động, đảm bảo thứ tự dữ liệu hiển thị luôn chính xác tuyệt đối.

### 2026-09-28 (Lần 2) — Khắc phục 3 điểm hợp đồng theo phản hồi của Lead

- Đã làm:
  - **Sửa phân trang Catalog (Issue 1 & ApiClient envelope)**:
    - Bổ sung cờ `rawEnvelope` trong `RequestOptions` và phương thức `getPaginated<T>()` trong `frontend/src/lib/api/client.ts` để không tự ý bóc `data`, bảo toàn toàn bộ `meta` (`next_cursor`, `has_more`, `limit`).
    - Cập nhật `catalog-list-screen.tsx`: gọi `getProductsPaginated()`, lấy trực tiếp `meta.next_cursor` (opaque base64url theo chuẩn `pg-catalog.repository.ts`) thay vì tự gán `product_id`. Chỉ hiển thị nút "Tải thêm sản phẩm" khi `has_more === true && nextCursor !== null`.
    - Viết unit test mới `test/catalog-pagination.spec.ts` kiểm thử trang 1 nhận opaque cursor và trang 2 gửi đúng tham số `cursor` lên API.
  - **Cách ly sản phẩm Người Bán theo Shop (Issue 2 / GAP-04)**:
    - Chuyển `seller-products-screen.tsx` từ gọi `GET /products` (endpoint public không hỗ trợ lọc shop_id) sang phương thức cách ly `repositories.catalog().getSellerProducts()`.
    - Dữ liệu được cô lập 100% thuộc về shop người bán (`shop_id: "00000000-0000-0000-0000-000000000001"`), không hiển thị sản phẩm của shop khác.
    - Thêm thông báo `notice--warning` trên UI nêu rõ trạng thái GAP-04 chờ backend cung cấp endpoint seller-scoped `/seller/products`.
  - **Fallback an toàn cho Category Fixtures (Issue 3 / GAP-05)**:
    - Cập nhật `category.adapter.ts`: nhận biết môi trường runtime. Ở chế độ live khi DB chưa có seed và backend chưa có `GET /categories` (GAP-05), adapter an toàn trả về `[]`, giúp giao diện ẩn hoàn toàn bộ lọc danh mục, ngăn ngừa việc gửi UUID lạ khiến kết quả tìm kiếm luôn bị rỗng.
    - Trong chế độ mock, adapter cung cấp cây danh mục chuẩn 2 cấp (RB-KN04) phục vụ dev test và bàn giao cho Người 5.
    - Bổ sung unit tests trong `category-adapter.spec.ts` kiểm thử cả hai chế độ mock và live fallback.

### 2026-09-28 (Lần 1) — B-301, B-302, B-305, B-401, O-508, O-509, A-700, A-702

- Đã làm:
  - Cài đặt & cấu hình Antigravity tools: `ui-ux-pro-max-skill`, `ponytail` suite (`@ponytail`, `@ponytail-review`, `@ponytail-audit`, `@ponytail-debt`, `@ponytail-gain`, `@ponytail-help`).
  - Cập nhật Wire DTOs & API Contracts trong `frontend/src/lib/api/catalog.api.ts` chuẩn chỉnh theo `04-data-model.md` và `05-api-contract.md`.
  - Xây dựng component `ProductCard`, `CatalogListScreen`, `ProductDetailScreen`, `SellerProductsScreen`.
  - Tích hợp add-to-cart action `B-401` với guest `returnTo` và toast.
  - Tích hợp hộp thoại điều chỉnh tồn kho nhanh `O-509`.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Product card/detail + add-to-cart action | Người 4 | Variant/quantity input, error/guest returnTo, toast, integration ready | Đã bàn giao | `frontend/src/features/catalog/product-detail-screen.tsx` |
| Category adapter | Người 5 | UUID xác minh, tree 2-level (RB-KN04), filter fallback (GAP-05), fixtures | Đã bàn giao | `frontend/src/lib/adapters/category.adapter.ts` |
| Seller product/media adapter | Người 1, 5 | Owner-scoped DTO, stock quick-edit mutation, 403/404/409 handling | Đã bàn giao | `frontend/src/features/seller/seller-products-screen.tsx` |
| Catalog Query & Validation Engine | Toàn team | URL sync, 300ms debounce, race guard, integer validation | Đã bàn giao | `frontend/src/features/catalog/catalog-query-engine.ts` |

## Việc được giao

- [x] B-301 — public catalog (đã hoàn tất URL giữ filter qua `window.history.replaceState`, 300ms debounce tìm kiếm, cursor pagination backend chuẩn).
- [x] B-302 — product detail view (đầy đủ variant selector, breadcrumb, mock fallback).
- [x] B-305 — category filtering (safe hide khi chưa có seed/backend GAP-05).
- [x] B-401 — product detail add-to-cart action; bàn giao command cho Người 4.
- [ ] O-508 — seller product list (đã hoàn thiện giao diện owner-scoped theo user.shop_id, tìm kiếm, lọc tồn kho, phân trang; TẠM GATED theo GAP-04 chờ backend cung cấp GET /seller/products).
- [x] O-509 — stock quick-edit (đã xử lý strict integer validation, xử lý chuyên biệt các mã lỗi 403 Forbidden, 404 Not Found, 409 Conflict có refresh dữ liệu).
- [ ] P-607a — product upload khi P-606/GAP-09 đóng.
- [x] A-700 — category adapter với cây 2 cấp (RB-KN04) và live safe hide (GAP-05); đã bàn giao Người 5.
- [ ] A-702 — nối category UI trên homepage/seller catalog (GATED chờ A-701 và API backend categories).
