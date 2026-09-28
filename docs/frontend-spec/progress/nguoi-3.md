# Tiến độ FE — Người 3 (Catalog và Seller Catalog)

## Trạng thái hiện tại

- Phase/ticket: Phase 3 (B-301, B-302, B-305), Phase 4 (B-401), Phase 5 (O-508, O-509), Phase 7 (A-700, A-702)
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Đã hoàn thiện Public Catalog, Product Detail (Add-to-cart), Category Adapter, Seller Product Management và Stock Quick Edit; sẵn sàng bàn giao Người 4 & Người 5.
- Nhánh/PR: `feat/fe-nguoi-3-catalog`
- Bị block bởi: Không
- Việc tiếp theo: Bàn giao contract/fixture Add-to-cart cho Người 4 và Category Adapter cho Người 5; chuẩn bị P-607a khi P-606/GAP-09 mở.

## Nhật ký theo ngày

### 2026-09-28 — B-301, B-302, B-305, B-401, O-508, O-509, A-700, A-702

- Đã làm:
  - Cài đặt & cấu hình Antigravity tools: `ui-ux-pro-max-skill`, `ponytail` suite (`@ponytail`, `@ponytail-review`, `@ponytail-audit`, `@ponytail-debt`, `@ponytail-gain`, `@ponytail-help`).
  - Cập nhật Wire DTOs & API Contracts trong `frontend/src/lib/api/catalog.api.ts` chuẩn chỉnh theo `04-data-model.md` và `05-api-contract.md` (`WireCatalogProductItem`, `WireCatalogProductDetail`, `WireProductVariant`, `GetProductsParams`, `CreateProductInput`).
  - Xây dựng `category.adapter.ts` (A-700 / B-305) tuân thủ RB-KN04 (cây danh mục tối đa 2 cấp) và GAP-05 (xác thực UUID thực tế từ seed/DB, fallback an toàn ẩn filter khi ID không tồn tại, không sinh UUID giả).
  - Viết bộ unit test `category-adapter.spec.ts` kiểm thử phân cấp 2 tầng và xác minh ID hợp lệ.
  - Xây dựng component `ProductCard` và màn hình `CatalogListScreen` (`frontend/src/features/catalog/`): tìm kiếm theo tên, bộ lọc giá min/max, danh mục động từ adapter, sắp xếp (`created_at_desc`, `price_asc`, `price_desc`), cursor pagination, và đầy đủ data states (`Skeleton`, `EmptyState`, `ErrorState`).
  - Dựng trang `/products` và tối ưu trang chủ `/` tích hợp chuẩn `AppShell`, `SiteNavigation` và nhận diện thương hiệu `Dino`.
  - Xây dựng màn hình chi tiết sản phẩm `ProductDetailScreen` và route `/products/[id]` (B-302): hiển thị thông tin, hình ảnh fallback (GAP-04), bộ chọn phân loại biến thể động (variant chips) cập nhật giá và tồn kho tức thời.
  - Tích hợp hành động thêm vào giỏ hàng `B-401`: kiểm tra phiên đăng nhập (F-102 Guest ReturnTo contract), điều hướng `/login?returnTo=...` đối với khách vãng lai, gọi `repositories.buyer().addToCart(variantId, quantity)` và kích hoạt Toast thông báo phản hồi.
  - Xây dựng màn hình người bán `SellerProductsScreen` (`O-508`) và route `/seller/products` được bảo vệ bằng `ProtectedPage` (`SELLER`, `ADMIN`).
  - Tích hợp hộp thoại điều chỉnh tồn kho nhanh `O-509` (`Dialog`) gọi `PATCH /product-variants/:id/stock` thông qua `repositories.catalog().updateStock(variantId, quantity)`.
- Quyết định UI/contract:
  - Không hardcode mã màu hex, tuân thủ 100% design system tokens (`--primary-active`, `--card`, `--border`, `--subtext`, `--foreground`).
  - Wordmark hiển thị chuỗi ký tự "Dino" đúng quy định F-105.
  - Xử lý GAP-04 (catalog detail chưa trả media) bằng fallback image có độ phân giải tối ưu và `loading="lazy"`.
- Test/kiểm tra:
  - `npm --prefix frontend run typecheck`: PASS (0 lỗi).
  - `npm --prefix frontend run lint`: PASS (0 lỗi, 0 warnings).
  - `npm --prefix frontend run test`: PASS 4 test files, 15 tests (`category-adapter.spec.ts`, `money-adapter.spec.ts`, `api-client.spec.ts`, `route-guards.spec.ts`).
  - `npm --prefix frontend run build`: PASS (Next.js 16.3.5 compile sạch tất cả 9 routes bao gồm `/`, `/products`, `/products/[id]`, `/seller/products`).
- Handoff:
  - Bàn giao Add-to-cart command (`repositories.buyer().addToCart(variantId, quantity)` + guest `returnTo`) cho Người 4.
  - Bàn giao `categoryAdapter` (`ICategoryAdapter`, `VERIFIED_CATEGORY_FIXTURES`, tree 2 cấp) cho Người 5 để phát triển Admin Categories (A-709).
- Blocker: Không.
- Còn lại:
  - P-607a (Product upload UI với media preview): chờ backend đóng P-606 / GAP-09.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Product card/detail + add-to-cart action | Người 4 | Variant/quantity input, error/guest returnTo, toast, integration ready | Đã bàn giao | `frontend/src/features/catalog/product-detail-screen.tsx` |
| Category adapter | Người 5 | UUID xác minh, tree 2-level (RB-KN04), filter fallback (GAP-05), fixtures | Đã bàn giao | `frontend/src/lib/adapters/category.adapter.ts` |
| Seller product/media adapter | Người 1, 5 | Owner-scoped DTO, stock quick-edit mutation | Đã bàn giao | `frontend/src/features/seller/seller-products-screen.tsx` |

## Việc được giao

- [x] B-301/B-302/B-305 — public catalog, detail, category fallback.
- [x] B-401 — product detail add-to-cart action; bàn giao command cho Người 4.
- [x] O-508/O-509 — seller product list và stock edit khi endpoint sẵn.
- [ ] P-607a — product upload khi P-606/GAP-09 đóng.
- [x] A-700/A-702 — bàn giao category adapter sớm; sau đó nối category UI trên homepage/seller catalog.
