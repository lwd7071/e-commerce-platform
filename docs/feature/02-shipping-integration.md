# Báo cáo: Tích hợp đơn vị vận chuyển (GHTK)

## Owner và trạng thái

- Owner: lwd7071
- Người phối hợp: Chưa xác định
- Trạng thái: Hoàn tất trên `dev`
- Cập nhật lần cuối: 2026-10-03
- Nhánh / PR / commit: Nhánh `dev`; CI xác minh commit `a3fbe30`; chưa có PR

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
- Migration đã áp dụng lên Supabase test project `putywqmxtjttfdezlswf` ngày 2026-10-02 qua script Prisma Migrate; kiểm tra lại báo `No pending migrations to apply`. CI sau đó xác nhận deploy toàn bộ migration của `dev` thành công trên cùng project.
- Đối soát database ngày 2026-10-02: ba bảng Flash Sale đã tồn tại với dữ liệu (16 sessions, 16 items, 6 compensation logs), cấu trúc khớp migration `20261002140000_flash_sale_concurrency`; migration được ghi nhận bằng Prisma `migrate resolve` sau khi đối chiếu. Các migration `chat`, `escrow/wallet`, `shop_tiering` và `buyer_loyalty` còn thiếu trên test đã được áp dụng; Prisma báo 19/19 migration hoàn tất, không còn pending.
- Thêm migration `20261003120000_flash_sale_read_only_grants`: chỉ cấp `SELECT` cho `anon`/`authenticated` trên session/item; bảng compensation không cấp quyền trực tiếp. RLS và hai policy public-read được giữ nguyên.

## Thiết kế / quyết định kỹ thuật

- Chọn GHTK làm provider lấy báo phí; `SHIPPING_PROVIDER=mock` là mặc định và chỉ bật GHTK khi cấu hình `SHIPPING_PROVIDER=ghtk` cùng `GHTK_API_TOKEN` — Lý do: môi trường đồ án có thể chạy mà không phụ thuộc credentials hoặc dịch vụ bên ngoài.
- Chỉ gọi API tính phí GHTK. Không gọi API tạo đơn, trạng thái đơn hoặc webhook.
- Địa chỉ mới dùng `province_code` và `ward_code`, không yêu cầu quận/huyện. Mã được lưu dạng chuỗi để giữ số 0 ở đầu.
- Thay đổi contract/schema: CR `CR-SHIPPING-01` đã được duyệt; migration bổ sung trọng lượng, mã hành chính và địa chỉ lấy hàng. Trọng lượng cũ nhận mặc định 200g; district có thể null cho địa chỉ hành chính mới.
- Tương thích dữ liệu cũ / rollback: Migration không xóa địa chỉ/snapshot lịch sử. Cột trọng lượng có default để sản phẩm cũ tiếp tục tính báo phí. Chưa có migration rollback tự động; khi cần rollback phải triển khai migration mới theo quy tắc repo.

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| Backend unit | `npm run test:node` trong `backend` | PASS | 754/754 test, 206 suite |
| Shipping, địa chỉ, checkout, shop và sản phẩm trên PostgreSQL test | `npx vitest run --reporter=verbose tests/db/address-runtime.integration.test.ts tests/db/pg-checkout.integration.test.ts tests/db/checkout-e2e-runtime.integration.test.ts tests/db/admin-voucher.integration.test.ts tests/db/seller-product-images-update.integration.test.ts tests/db/seller-shop-runtime.integration.test.ts tests/db/t3-checkout-concurrency.integration.test.ts`; sau sửa chạy lại `npx vitest run --reporter=verbose tests/db/t3-checkout-concurrency.integration.test.ts` | PASS sau sửa | Lượt đầu 47/48; cập nhật payload checkout còn thiếu phí xác nhận rồi chạy lại test đó riêng: 1/1 PASS. Tổng cộng 48 ca liên quan đều có kết quả PASS; isolated schema fixtures áp dụng migration mới |
| Backend lint / typecheck | `npm run lint`, `npm run typecheck` trong `backend` | PASS | Chạy sau khi cập nhật integration fixtures |
| Backend build | `npm run build` trong `backend` | PASS | Build thành công; không có thay đổi backend runtime sau lượt build |
| Frontend test / lint / typecheck / production build | `npm test -- --maxWorkers=2 --minWorkers=2 --testTimeout=15000`, `npx eslint src test --max-warnings=0`, `npm run typecheck`, `npm run build` trong `frontend` | PASS | 323/323 test; production build thành công |
| API type consistency | `npm run api:types:check` trong `frontend` | PASS | Generated API types match backend OpenAPI contract |
| Schema acceptance, schema smoke và migration ledger trên Supabase test | `npx vitest run tests/db/schema-acceptance.test.ts tests/db/schema-smoke.test.ts tests/db/t3-migration-rebuild.test.ts` | PASS | 19/19 test; xác nhận danh sách bảng đã duyệt, RLS, grant/policy Flash Sale và migration ledger |
| Backend lint / typecheck sau cập nhật schema test và Flash Sale | `npm run lint`, `npm run typecheck` trong `backend` | PASS | Không còn warning lint; TypeScript kiểm tra thành công |
| Toàn bộ backend remote Vitest | `npx vitest run tests/db --testTimeout=30000 --hookTimeout=45000 --reporter=verbose --reporter=json` trên GitHub Actions | PASS | CI run [37037903108](https://github.com/lwd7071/e-commerce-platform/actions/runs/37037903108), commit `a3fbe3083c008622d90d6de576b1c43841ac6455`: 52/52 file, 266/266 test, 0 skipped; thời lượng 623.68 giây. Redis service thật chạy trong job. |
| Backend quality CI | GitHub Actions, job `Backend quality` | PASS | Cùng CI run `37037903108`: Prisma validate, deploy migration trên PostgreSQL sạch, lint, typecheck, build, native tests và Vitest đều thành công. |
| Remote Supabase smoke CI | GitHub Actions, các job Supabase remote | PASS | Cùng CI run `37037903108`: remote DB deploy/test, auth smoke và storage policy smoke thành công. |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: Token GHTK chỉ ở cấu hình backend; không trả token cho frontend và không ghi secret vào tài liệu. Báo phí chỉ đọc địa chỉ giao/nhận và trọng lượng cần thiết.
- Retry, request trùng, race condition: Checkout dùng idempotency hiện có; báo phí được gọi ngoài transaction checkout. Checkout khóa/kiểm tra tồn trong transaction để không oversell.
- Hủy, hoàn tiền, timeout, rollback: Lỗi ghi đơn rollback trong transaction. Không có yêu cầu hoàn tiền hoặc hủy vận đơn hãng vì chưa tạo vận đơn thật.
- Rủi ro còn lại: Báo phí thật phụ thuộc token/quyền GHTK và dữ liệu pickup hợp lệ. Giao hàng mô phỏng không xác minh sự kiện thực tế từ shipper.

## Việc còn lại và blocker

- [x] Chạy full backend remote Vitest trên trạng thái `dev`, xác nhận 0 lỗi/0 skipped — Owner: lwd7071.
- [x] Đối chiếu và áp dụng đủ migration trên Supabase test; Prisma ghi nhận 19/19 migration, không còn pending — Owner: lwd7071.

## Nhật ký cập nhật

### 2026-10-03

- Đã làm: Hoàn thiện báo phí GHTK/mock, danh mục địa chỉ 2026, trọng lượng sản phẩm và luồng bàn giao/Buyer xác nhận nhận hàng mô phỏng; cập nhật test fixture theo migration mới.
- Kiểm tra bổ sung: Đã khớp và ghi nhận migration Flash Sale có sẵn; áp dụng đủ migration `dev` còn thiếu cùng migration giới hạn quyền Flash Sale. Prisma xác nhận 19/19 migration đã áp dụng và không còn pending. Schema/migration remote tests đạt 19/19; backend lint và typecheck pass.
- Kết quả cuối: CI run `37037903108` trên `a3fbe30` thành công; remote DB Vitest 52 file/266 test, không lỗi và không skipped. Backend quality và các smoke job Supabase cũng pass.
