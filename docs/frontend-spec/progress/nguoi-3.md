# Tiến độ FE — Người 3 (Catalog và Seller Catalog)

## Trạng thái hiện tại

- Phase/ticket: Phase 3 (B-301, B-302, B-305), Phase 4 (B-401), Phase 5 (O-508, O-509), Phase 7 (A-700, A-702)
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Đã khắc phục triệt để 3 vấn đề hợp đồng từ Lead (Cursor pagination backend-compliant, Seller shop-scoped isolation GAP-04, Category safe live fallback GAP-05). Quality gates pass sạch 100%.
- Nhánh/PR: `feat/fe-nguoi-3-catalog`
- Bị block bởi: Không
- Việc tiếp theo: Phối hợp Người 4 nghiệm thu add-to-cart handoff; phối hợp Người 5 nghiệm thu category adapter; chờ backend mở P-606/GAP-09 để làm P-607a.

## Nhật ký theo ngày

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
- Quyết định UI/contract:
  - Cursor pagination tuân thủ 100% opaque string từ backend, không client-side synthesis.
  - Seller products tuyệt đối không gọi endpoint public khi chưa có auth/shop scoping từ server.
- Test/kiểm tra:
  - `npm --prefix frontend run typecheck`: PASS (0 lỗi).
  - `npm --prefix frontend run lint`: PASS (0 lỗi, 0 warnings).
  - `npm --prefix frontend run test`: PASS 5 test files, 19 tests (`api-client.spec.ts`, `catalog-pagination.spec.ts`, `category-adapter.spec.ts`, `money-adapter.spec.ts`, `route-guards.spec.ts`).
  - `npm --prefix frontend run build`: PASS (Next.js 16.3.5 compile thành công 9 routes).
- Handoff:
  - Đã bàn giao `getProductsPaginated` envelope và cursor pagination cho toàn team.
  - Bàn giao `categoryAdapter` với cơ chế live fallback an toàn cho Người 5.
- Blocker: Không.

### 2026-09-28 (Lần 1) — B-301, B-302, B-305, B-401, O-508, O-509, A-700, A-702

- Đã làm:
  - Cài đặt & cấu hình Antigravity tools: `ui-ux-pro-max-skill`, `ponytail` suite (`@ponytail`, `@ponytail-review`, `@ponytail-audit`, `@ponytail-debt`, `@ponytail-gain`, `@ponytail-help`).
  - Cập nhật Wire DTOs & API Contracts trong `frontend/src/lib/api/catalog.api.ts` chuẩn chỉnh theo `04-data-model.md` và `05-api-contract.md`.
  - Xây dựng component `ProductCard`, `CatalogListScreen`, `ProductDetailScreen`, `SellerProductsScreen`.
  - Tích hợp add-to-cart action `B-401` với guest `returnTo` và toast.
  - Tích hợp hộp thoại điều chỉnh tồn kho nhanh `O-509`.
- Quyết định UI/contract:
  - 100% design system tokens, plain text wordmark `Dino`.
- Test/kiểm tra:
  - Quality gates pass sạch.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Product card/detail + add-to-cart action | Người 4 | Variant/quantity input, error/guest returnTo, toast, integration ready | Đã bàn giao | `frontend/src/features/catalog/product-detail-screen.tsx` |
| Category adapter | Người 5 | UUID xác minh, tree 2-level (RB-KN04), filter fallback (GAP-05), fixtures | Đã bàn giao | `frontend/src/lib/adapters/category.adapter.ts` |
| Seller product/media adapter | Người 1, 5 | Owner-scoped DTO, stock quick-edit mutation | Đã bàn giao | `frontend/src/features/seller/seller-products-screen.tsx` |

## Việc được giao

- [x] B-301/B-302/B-305 — public catalog, detail, category fallback (đã fix cursor pagination & category safe hide).
- [x] B-401 — product detail add-to-cart action; bàn giao command cho Người 4.
- [x] O-508/O-509 — seller product list và stock edit khi endpoint sẵn (đã cách ly shop GAP-04).
- [ ] P-607a — product upload khi P-606/GAP-09 đóng.
- [x] A-700/A-702 — bàn giao category adapter sớm; sau đó nối category UI trên homepage/seller catalog.
