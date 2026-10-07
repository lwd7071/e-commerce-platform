# Báo cáo: Tối ưu bộ nhớ đệm Client & Điều hướng mượt mà (TanStack Query Cache & Navigation Optimization)

## Owner và trạng thái

- Owner: lwd7071
- Người phối hợp: Không
- Trạng thái: Hoàn thành
- Cập nhật lần cuối: 2026-10-07
- Nhánh / PR / commit: dev

## Mục tiêu và phạm vi

- Mục tiêu: Khắc phục triệt để tình trạng giật lag, hiện lại loading/skeleton khi chuyển đổi qua lại giữa các trang/tab trên website; tối ưu hóa tốc độ tải trang bằng cơ chế Client Cache (In-Memory RAM) kết hợp Prefetching khi rê chuột và Parallel Fetching để loại bỏ Network Waterfall.
- Trong phạm vi:
  - Tích hợp `@tanstack/react-query` v5 với cấu hình quản lý bộ nhớ đệm tập trung (`QueryClient`, `QueryProvider`, `queryKeys.ts`).
  - Dọn dẹp an toàn bộ nhớ cache (`queryClient.clear()`) khi người dùng đăng xuất khỏi hệ thống nhằm bảo mật dữ liệu.
  - Tối ưu trang Hồ sơ người dùng (`ProfilePageContent`, `ProfileScreen`, `AddressManager`): nạp song song thông tin hồ sơ, điểm thưởng loyalty, lịch sử loyalty và danh sách địa chỉ; áp dụng Skeleton cố định chiều cao chống Layout Shift (CLS).
  - Tối ưu trang Sản phẩm (`ProductCard`, `ProductDetailScreen`): Prefetching chi tiết sản phẩm khi hover/focus vào thẻ; cache chi tiết sản phẩm và danh sách đánh giá.
  - Tối ưu trang Đơn hàng (`OrdersScreen`): Cache danh sách theo từng tab trạng thái; tự động invalidate cache khi hủy đơn hoặc xác nhận nhận hàng.
  - Tối ưu trang Giỏ hàng (`CartScreen`): Tự động invalidate cache khi thêm sản phẩm từ trang chi tiết hoặc chỉnh sửa số lượng trong giỏ hàng.
  - Đảm bảo tính độc lập (Resilience) để toàn bộ 84 test suites unit/integration chạy cô lập mà không bị phụ thuộc.
- Ngoài phạm vi: Server-side cache (Redis đã có sẵn ở backend cho Flash Sale), Service Worker offline cache.

## Đã thực hiện

- Thiết lập QueryClient singleton, cấu hình staleTime (2 phút), gcTime (10 phút), tắt refetchOnWindowFocus — Bằng chứng: `frontend/src/lib/query/query-client.ts`.
- Tạo QueryProvider và bọc ứng dụng tại root layout — Bằng chứng: `frontend/src/lib/query/query-provider.tsx`, `frontend/src/app/layout.tsx`.
- Xây dựng từ điển Query Keys phân cấp tập trung theo domain model — Bằng chứng: `frontend/src/lib/query/query-keys.ts`.
- Phân vùng query keys của dữ liệu riêng tư theo `userId`; catalog/reviews vẫn dùng keys công khai — Bằng chứng: `frontend/src/lib/query/query-keys.ts`.
- Tích hợp dọn dẹp cache khi sign-out, đổi tài khoản, logout và đổi mật khẩu dẫn tới sign-out — Bằng chứng: `frontend/src/lib/auth/auth-context.tsx`.
- Viết Deep Hook `useProfileDashboard` xử lý parallel fetch và mutations — Bằng chứng: `frontend/src/features/profile/use-profile-queries.ts`.
- Refactor trang Profile và AddressManager dùng query cache và auto invalidation — Bằng chứng: `frontend/src/features/profile/profile-screen.tsx`, `frontend/src/features/profile/address-manager.tsx`.
- Tích hợp Prefetching trên hover/focus ở thẻ sản phẩm — Bằng chứng: `frontend/src/features/catalog/product-card.tsx`.
- Chuyển trang chi tiết sản phẩm sang `useQuery` và invalidate giỏ hàng — Bằng chứng: `frontend/src/features/catalog/product-detail-screen.tsx`.
- Chuyển trang đơn hàng sang `useQuery` theo từng tab trạng thái — Bằng chứng: `frontend/src/features/orders/orders-screen.tsx`.
- Chuyển `CartScreen` sang `useQuery`; giữ optimistic updates/rollback và invalidate sau thao tác thành công hoặc thao tác nhiều mục lỗi một phần — Bằng chứng: `frontend/src/features/cart/cart-screen.tsx`.
- Viết các test suite TDD kiểm chứng vòng đời cache và không fetch lại khi chuyển tab — Bằng chứng: `frontend/test/query-provider-setup.spec.tsx`, `frontend/test/profile-query-cache.spec.tsx`.

## Thiết kế / quyết định kỹ thuật

- Sử dụng Client-side In-memory Cache (TanStack Query) thay vì Redis — Lý do: Vấn đề chuyển tab/trang mượt mà thuộc về độ trễ hiển thị ở trình duyệt người dùng; đọc từ RAM client mất 0ms mà không tốn network roundtrip lên server/Redis.
- Chiến lược Stale-While-Revalidate: Dữ liệu trong 2 phút được coi là mới; người dùng điều hướng quay lại được xem ngay dữ liệu cũ từ RAM mà không bị skeleton/trắng trang.
- Deep Module Pattern (theo skill improve-codebase-architecture): Gom toàn bộ logic fetching, state tính toán và mutations vào hook riêng (`useProfileDashboard`), caller chỉ nhận interface tối giản.
- Khử Layout Shift (theo skill ui-ux-pro-max): Thay thế spinner đơn lẻ bằng fixed-height skeleton (`min-h-[110px]`, `min-h-[220px]`), giúp bố cục trang không bị nhảy vị trí khi dữ liệu được nạp xong.
- QueryProvider Resilience: Bọc fallback QueryProvider tại từng màn hình cấp cao để đảm bảo các bài test cũ/mới chạy đơn lẻ mà không cần mock lại toàn bộ context cây React.

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| Unit Test Cache Provider & Keys | `npm test -- test/query-provider-setup.spec.tsx` | PASS | 3/3 tests pass (1.22s) |
| Integration Test Profile Cache & 0ms Navigation | `npm test -- test/profile-query-cache.spec.tsx` | PASS | 2/2 tests pass - xác minh unmount/remount không gọi lại API và dữ liệu tài khoản mới không nhận cache tài khoản cũ |
| Cache isolation, cart mutations, auth and loading accessibility | `npm test -- test/auth-session-hydration.spec.tsx test/cart-query-cache.spec.tsx test/address-manager-query.spec.tsx test/e2e-tiering-loyalty-lifecycle.spec.tsx` | PASS | Bao gồm sign-out/đổi tài khoản, cart cache/rollback/partial failure, product detail invalidation và skeleton accessibility |
| Full Test Suite Frontend Regression | `npm test` | PASS | 86/86 test files, 380/380 tests pass (37.59s) |
| TypeScript Typecheck | `npm run typecheck` | PASS | `tsc --noEmit` hoàn thành với 0 lỗi |
| Production Build Next.js | `npm run build` | PASS | Biên dịch thành công 34/34 static & dynamic routes trong 7.3s |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: private query keys tách theo user ID; cache trong RAM được xóa khi auth sign-out hoặc chuyển tài khoản, tránh hiển thị dữ liệu cá nhân của phiên khác.
- Retry, request trùng, race condition: TanStack Query tự động gom các request trùng key (deduplication) và cấu hình retry 1 lần khi có sự cố mạng chập chờn.
- Hủy, hoàn tiền, timeout, rollback: Khi thực hiện mutations (thêm giỏ hàng, cập nhật địa chỉ, hủy đơn), hệ thống tự động gọi `invalidateQueries` để đồng bộ lại dữ liệu chuẩn từ backend.
- Rủi ro còn lại: Không có rủi ro đã biết sau test suite, typecheck và production build.

## Việc còn lại và blocker

- [x] Cài đặt và cấu hình nền tảng TanStack Query — Owner: lwd7071 — Hoàn thành: 2026-10-07
- [x] Thử nghiệm và hoàn thiện trang Profile & Địa chỉ — Owner: lwd7071 — Hoàn thành: 2026-10-07
- [x] Mở rộng Prefetching và Caching trên Sản phẩm, Đơn hàng, Giỏ hàng — Owner: lwd7071 — Hoàn thành: 2026-10-07
- Blocker: Không.

## Nhật ký cập nhật

### 2026-10-07

- Đã làm: Triển khai TanStack Query v5 cho Profile, Catalog, Product Detail, Orders và Cart; phân vùng private cache theo user; dọn cache khi auth đổi phiên; thêm test TDD cho cache, mutations và loading accessibility.
- Kiểm tra: `npm test` đạt 380/380 tests trên 86 files; `npm run typecheck` pass; `npm run build` pass và sinh 34 routes.
- Tiếp theo / blocker: Không có blocker; sẵn sàng bàn giao.
