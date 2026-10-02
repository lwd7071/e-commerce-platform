# Báo cáo: Tích hợp đơn vị vận chuyển (GHTK)

## Owner và trạng thái

- Owner: Chưa xác định
- Người phối hợp: Chưa xác định
- Trạng thái: Đang review
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit: Nhánh `dev`, commit triển khai `f5a5384`; chưa có PR

## Mục tiêu và phạm vi

- Mục tiêu: Chuẩn hóa địa chỉ giao/nhận, báo phí theo shop và trọng lượng sản phẩm, đồng thời mô phỏng trạng thái giao hàng trong đồ án.
- Trong phạm vi: Danh mục tỉnh/thành và phường/xã theo mã hành chính 2026; lưu trọng lượng sản phẩm; lấy báo phí từ GHTK hoặc mock; tính lại báo phí khi checkout; Shop bàn giao cho đơn vị vận chuyển; Buyer xác nhận đã nhận để hoàn tất đơn.
- Ngoài phạm vi: Tạo vận đơn GHTK thật, lưu mã vận đơn, webhook, theo dõi trạng thái từ hãng vận chuyển và yêu cầu shipper thật đến lấy hàng.

## Đã thực hiện

- Thêm module danh mục địa chỉ gồm 34 tỉnh/thành và 3.321 phường/xã, truy vấn qua `GET /api/v1/locations/provinces` và `GET /api/v1/locations/provinces/:provinceCode/wards` — Bằng chứng: [locations.ts](../../backend/src/modules/shipping/locations.ts), [vn-admin-catalog.json](../../backend/src/modules/shipping/data/vn-admin-catalog.json), [location-routes.ts](../../backend/src/platform/http/routes/location-routes.ts).
- Thêm provider báo phí mock và adapter gọi riêng API tính phí GHTK; mock là mặc định — Bằng chứng: [providers.ts](../../backend/src/modules/shipping/providers.ts), cấu hình trong [.env.example](../../.env.example).
- Thêm `POST /api/v1/shipping/quote`; checkout tính lại phí theo từng shop, lưu phí vào đơn và yêu cầu buyer gửi lại xác nhận nếu báo phí đã đổi — Bằng chứng: [pg-checkout.service.ts](../../backend/src/modules/checkout/services/pg-checkout.service.ts), [order-routes.ts](../../backend/src/platform/http/routes/order-routes.ts).
- Thêm `weight_grams` với mặc định 200g cho sản phẩm hiện có; form shop cho phép cập nhật trọng lượng chính xác — Bằng chứng: [migration.sql](../../backend/prisma/migrations/20261002120000_shipping_quotes_and_weight/migration.sql), [seller-product-create-screen.tsx](../../frontend/src/features/seller/seller-product-create-screen.tsx), [seller-product-edit-screen.tsx](../../frontend/src/features/seller/seller-product-edit-screen.tsx).
- Cập nhật form địa chỉ buyer và điểm lấy hàng của shop dùng tỉnh/phường có mã; dữ liệu đơn hàng/địa chỉ lịch sử được giữ nguyên — Bằng chứng: [administrative-address-fields.tsx](../../frontend/src/components/forms/administrative-address-fields.tsx), [address-manager.tsx](../../frontend/src/features/profile/address-manager.tsx), [seller-shop-screen.tsx](../../frontend/src/features/seller/seller-shop-screen.tsx).
- Cập nhật checkout hiển thị phí theo shop. Luồng giao mô phỏng: Shop đánh dấu đã bàn giao (`SHIPPING`), Buyer xác nhận đã nhận (`COMPLETED`); không có thao tác Shop tự đánh dấu giao thành công — Bằng chứng: [checkout-screen.tsx](../../frontend/src/features/checkout/checkout-screen.tsx), [business-rules.md](../architecture/rules/business-rules.md).
- Migration đã áp dụng lên Supabase test project `putywqmxtjttfdezlswf` ngày 2026-10-02 qua script Prisma Migrate; kiểm tra lại báo `No pending migrations to apply`.

## Thiết kế / quyết định kỹ thuật

- Chọn GHTK làm provider lấy báo phí; `SHIPPING_PROVIDER=mock` là mặc định và chỉ bật GHTK khi cấu hình `SHIPPING_PROVIDER=ghtk` cùng `GHTK_API_TOKEN` — Lý do: môi trường đồ án có thể chạy mà không phụ thuộc credentials hoặc dịch vụ bên ngoài.
- Chỉ gọi API tính phí GHTK. Không gọi API tạo đơn, trạng thái đơn hoặc webhook.
- Địa chỉ mới dùng `province_code` và `ward_code`, không yêu cầu quận/huyện. Mã được lưu dạng chuỗi để giữ số 0 ở đầu.
- Thay đổi contract/schema: CR `CR-SHIPPING-01` đã được duyệt; migration bổ sung trọng lượng, mã hành chính và địa chỉ lấy hàng. Trọng lượng cũ nhận mặc định 200g; district có thể null cho địa chỉ hành chính mới.
- Tương thích dữ liệu cũ / rollback: Migration không xóa địa chỉ/snapshot lịch sử. Cột trọng lượng có default để sản phẩm cũ tiếp tục tính báo phí. Chưa có migration rollback tự động; khi cần rollback phải triển khai migration mới theo quy tắc repo.

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| Backend unit | `npm run test:node` trong `backend` | PASS | 698/698 test |
| Shipping, địa chỉ, checkout, shop và sản phẩm trên PostgreSQL test | `npx vitest run --reporter=verbose tests/db/address-runtime.integration.test.ts tests/db/pg-checkout.integration.test.ts tests/db/checkout-e2e-runtime.integration.test.ts tests/db/admin-voucher.integration.test.ts tests/db/seller-product-images-update.integration.test.ts tests/db/seller-shop-runtime.integration.test.ts tests/db/t3-checkout-concurrency.integration.test.ts`; sau sửa chạy lại `npx vitest run --reporter=verbose tests/db/t3-checkout-concurrency.integration.test.ts` | PASS sau sửa | Lượt đầu 47/48; cập nhật payload checkout còn thiếu phí xác nhận rồi chạy lại test đó riêng: 1/1 PASS. Tổng cộng 48 ca liên quan đều có kết quả PASS; isolated schema fixtures áp dụng migration mới |
| Backend lint / typecheck | `npm run lint`, `npm run typecheck` trong `backend` | PASS | Chạy sau khi cập nhật integration fixtures |
| Backend build | `npm run build` trong `backend` | PASS | Build thành công; không có thay đổi backend runtime sau lượt build |
| Frontend test / lint / typecheck / production build | `npm test -- --maxWorkers=2 --minWorkers=2 --testTimeout=15000`, `npx eslint src test --max-warnings=0`, `npm run typecheck`, `npm run build` trong `frontend` | PASS | 323/323 test; production build thành công |
| API type consistency | `npm run api:types:check` trong `frontend` | PASS | Generated API types match backend OpenAPI contract |
| Toàn bộ backend remote Vitest | `npm run test:vitest` trong `backend` | FAIL ở lượt đầy đủ gần nhất; chưa chạy lại sau khi sửa fixtures | Lượt trước có 302/336 test pass và 34 fail: 31 lỗi từ integration fixtures/payload checkout cũ (các suite liên quan đã được chạy lại riêng và pass); 3 schema assertions thấy bảng Flash Sale ngoài danh sách migration của workspace |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: Token GHTK chỉ ở cấu hình backend; không trả token cho frontend và không ghi secret vào tài liệu. Báo phí chỉ đọc địa chỉ giao/nhận và trọng lượng cần thiết.
- Retry, request trùng, race condition: Checkout dùng idempotency hiện có; báo phí được gọi ngoài transaction checkout. Checkout khóa/kiểm tra tồn trong transaction để không oversell.
- Hủy, hoàn tiền, timeout, rollback: Lỗi ghi đơn rollback trong transaction. Không có yêu cầu hoàn tiền hoặc hủy vận đơn hãng vì chưa tạo vận đơn thật.
- Rủi ro còn lại: Báo phí thật phụ thuộc token/quyền GHTK và dữ liệu pickup hợp lệ. Giao hàng mô phỏng không xác minh sự kiện thực tế từ shipper.

## Việc còn lại và blocker

- [ ] Chạy lại full backend remote Vitest sau khi đã cập nhật các test fixture liên quan — Owner: Chưa xác định — Dự kiến: Chưa xác định.
- [ ] Xử lý riêng schema drift trên Supabase test: đang có `flash_sale_sessions`, `flash_sale_items`, `flash_sale_compensation_logs` nhưng workspace hiện không có migration tạo các bảng này. Không xóa hoặc đưa vào migration shipping khi chưa xác định owner và nguồn schema — Owner: Chưa xác định — Dự kiến: Chưa xác định.
- Blocker: Ba bảng Flash Sale làm các kiểm tra schema “đúng chính xác danh sách bảng” thất bại; đây là các bảng ngoài phạm vi shipping và chưa có migration trong workspace.

## Nhật ký cập nhật

### 2026-10-02

- Đã làm: Hoàn thiện báo phí GHTK/mock, danh mục địa chỉ 2026, trọng lượng sản phẩm và luồng bàn giao/Buyer xác nhận nhận hàng mô phỏng; cập nhật test fixture theo migration mới.
- Kiểm tra: Migration áp dụng thành công trên Supabase test; frontend 323/323; backend unit 698/698; 48 ca integration liên quan đều pass sau khi sửa fixtures/payload. Backend lint/typecheck/build và frontend lint/typecheck/build/API types pass. Full backend remote suite lần gần nhất có 34 lỗi; 31 lỗi đã xử lý và kiểm tra riêng, còn 3 schema assertions về các bảng Flash Sale; full suite chưa chạy lại sau các sửa đổi.
- Tiếp theo / blocker: Chạy lại full backend remote Vitest và xác định owner/migration cho ba bảng Flash Sale ngoài workspace.
