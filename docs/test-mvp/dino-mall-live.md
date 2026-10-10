# Kiểm chứng Dino Mall nối hệ thống thật

## Trạng thái hiện tại ngày 11/10/2026

Project Supabase test riêng `tejmnwemsnosolidkvqb` đã xác minh và áp dụng đủ 22 migrations. Schema smoke, Seller Mall và Tiering & Loyalty chạy trên database này: **32/32 PASS**. Đăng nhập Supabase thật và API `/auth/me` trả 200, đúng vai trò SELLER. Secrets lưu ngoài Git. Live browser **3/3 PASS, 0 skipped** trên Chrome, frontend/backend local kết nối Supabase test thật, không mock Auth/API hoặc tier trong storage.

| Hành trình live | Kết quả |
| --- | --- |
| Seller nộp → Admin duyệt → Seller thấy MALL → Buyer thấy badge đúng sản phẩm | PASS, 31.7 giây |
| Seller nhận lý do từ chối → nộp hồ sơ mới với request ID khác | PASS, 20.9 giây |
| Seller hủy PENDING qua xác nhận trình duyệt | PASS, 13.3 giây |

Lệnh chạy từ frontend: `PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/seller-mall-request-connected-live.spec.ts` với môi trường test riêng đã nạp (PowerShell đặt biến qua `$env:PLAYWRIGHT_CHANNEL='chrome'`). Tổng 1.2 phút, exit code 0. Đã sửa selector ba ô hồ sơ theo accessible name của textbox; exact label trước đó bị dấu bắt buộc gây timeout. ESLint file E2E PASS. Các lần timeout trước là FAIL, không được tính vào lần PASS này. Fixture đã thay đổi trạng thái thật; cần tạo bộ fixture mới cho lần chạy sau.

Phạm vi bằng chứng: ba hành trình Dino Mall và 32 ca database liên quan. Runtime local còn báo lỗi worker Flash Sale vì thiếu Redis; không suy ra Flash Sale local đã hoạt động. Các tính năng ngoài phạm vi như đổi/thu hồi điểm vẫn chưa triển khai. Giữ nghiệm thu từng phần của báo cáo tổng và chờ review PR; kết quả live Dino Mall đã được kiểm chứng.

CI [38072400039](https://github.com/lwd7071/e-commerce-platform/actions/runs/38072400039) tại commit `490a3ed`: backend và frontend quality **PASS**; các job remote Supabase bị SKIPPED theo điều kiện workflow, không coi là PASS. PR #14 vẫn draft, chưa merge.

## Lịch sử trạng thái ngày 10/10/2026

Nghiệm thu từng phần. Chưa có project/database test riêng được chủ dự án xác nhận; chưa tạo tài khoản, chạy migration hoặc ghi dữ liệu vào database dùng chung. Máy hiện không tìm thấy Docker/PostgreSQL local qua công cụ và thư mục cài đặt đã kiểm tra. Live E2E vẫn **3 skipped**, không phải PASS.

## Sửa lỗi trong lần tiếp quản

- Các truy vấn tìm request/PENDING bên trong transaction dùng cùng client, tránh chờ kết nối khác khi pool đã đầy. Test hồi quy mô phỏng pool không còn kết nối rảnh bao phủ submit/cancel/reject/approve; đây không phải bằng chứng PostgreSQL thật.
- Mỗi vai trò đăng nhập bằng browser context riêng; từng hành trình có đăng nhập và Shop test riêng. Selector đối chiếu UI hiện tại; hủy xử lý native confirm; nộp lại thực sự tạo request mới; kiểm tra badge trên đúng product ID.
- Preflight kiểm tra URL Auth của frontend/backend, project trong DATABASE_URL/DIRECT_URL, host và allowlist theo e2e-seed-safety hiện có. Một cờ RUN_REAL_E2E_TEST hoặc DATABASE_ENVIRONMENT không đủ bật test.
- Preflight chỉ xác minh cấu hình mà runner đọc, không tự chứng minh database của một server đang chạy. Phải khởi động backend từ chính cấu hình test đã xác minh và đối chiếu tiến trình/đích database trước khi bật test.
- Playwright dùng Chromium mặc định; có thể đặt PLAYWRIGHT_CHANNEL=chrome trên máy có Chrome. Không ép Chrome cho mọi môi trường CI.

## Chuẩn bị môi trường trước khi bật test

1. Chủ dự án xác nhận project Supabase riêng dành cho test và host database. Không lấy project dùng chung rồi thêm cờ test/allowlist để vượt kiểm tra. Cần cấu hình Auth, database, Storage phù hợp với runtime; PostgreSQL riêng đơn thuần chưa cung cấp Supabase Auth.
2. Đặt secrets trong môi trường tiến trình hoặc file env riêng ngoài Git. DATABASE_URL và DIRECT_URL phải cùng project test với SUPABASE_URL và NEXT_PUBLIC_SUPABASE_URL. Đặt NEXT_PUBLIC_USE_MOCK=false.
3. Chạy migration theo scripts hiện hành từ backend workspace trên đích test đã xác minh. Không chạy migration production. Chuẩn bị Admin, Buyer và **ba Seller riêng**, mỗi Seller có Shop ACTIVE, chưa MALL và không có yêu cầu PENDING. Shop dành cho hành trình approve phải có sản phẩm ACTIVE hiển thị trong catalog.
4. Khởi chạy backend/frontend bằng cùng cấu hình test. Không tái sử dụng server trỏ đích khác. Backend URL cho suite này phải là localhost hoặc 127.0.0.1.
5. Cấu hình các biến dưới đây rồi chạy từ thư mục frontend: `npx playwright test e2e/seller-mall-request-connected-live.spec.ts`. Nếu chưa bật RUN_MALL_LIVE_E2E=true, suite báo skipped. Khi bật nhưng cấu hình không hợp lệ, preflight thất bại thay vì coi là thành công.

### Biến môi trường

- DATABASE_ENVIRONMENT=test, EXPECTED_SUPABASE_PROJECT_REF, E2E_ALLOWED_SUPABASE_PROJECT_REFS, EXPECTED_DATABASE_HOST, E2E_ALLOWED_DATABASE_HOSTS, ALLOW_E2E_SEED=true: theo guard của dự án. Allowlist phải lấy từ môi trường đã được xác nhận.
- SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, DATABASE_URL, DIRECT_URL, các Auth key tương ứng và NEXT_PUBLIC_API_URL: cấu hình runtime test, không công bố secrets.
- E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD; E2E_BUYER_EMAIL, E2E_BUYER_PASSWORD.
- E2E_MALL_APPROVE_SELLER_EMAIL, E2E_MALL_REJECT_SELLER_EMAIL, E2E_MALL_CANCEL_SELLER_EMAIL: ba tài khoản khác nhau; E2E_MALL_SELLER_PASSWORD là mật khẩu dành riêng cho các tài khoản thử nghiệm này.
- E2E_MALL_PRODUCT_ID, E2E_MALL_PRODUCT_NAME: sản phẩm của Shop dành cho hành trình approve, tên đủ đặc trưng để tìm thấy sản phẩm trong trang đầu catalog.
- RUN_MALL_LIVE_E2E=true chỉ bật suite, không thay thế xác minh môi trường.

Suite ghi dữ liệu thật vào đích test và không tự xóa lịch sử. Sau hành trình approve, Shop đã MALL; sau reject/nộp lại có request PENDING. Chuẩn bị lại fixture/tài khoản test riêng trước lần chạy tiếp theo; không tự hạ hạng hoặc xóa dữ liệu dùng chung để làm test xanh.

## Kết quả tự chạy trong lần tiếp quản

| Kiểm tra | Kết quả |
| --- | --- |
| Backend seller-mall-request.spec.ts | 15/15 PASS, mock/service/HTTP guard |
| Frontend mall-environment + seller-shop-screen | 10/10 PASS |
| Backend/frontend lint, typecheck, build | PASS |
| Prisma validate trong backend | PASS |
| Frontend api:types:check | PASS |
| Live connected Playwright | 3 SKIPPED, thiếu môi trường đã xác minh |
| PostgreSQL integration và full suites | Chưa chạy lại trong lần tiếp quản |
| GitHub Actions | Theo run của draft PR; không suy ra PASS từ cấu hình workflow |

Kết quả PostgreSQL 11/11 và UI mock 3/3 ghi trong báo cáo trước là kết quả lịch sử của người triển khai trước, không phải lần chạy lại của lần tiếp quản này. ChatGPT Web chưa tham gia review độc lập vì workspace chưa có Project/chat được ghép.

## Cập nhật ngày 11/10/2026 sau đồng bộ dev

- Full frontend: 94 file, **413/413 PASS**; lint, typecheck, build và API types check PASS.
- Backend native: **799/799 PASS**. Test runtime đóng worker trong cleanup, tránh giữ tiến trình và cố gọi Redis sau khi kết thúc test.
- Backend Vitest khi `RUN_REMOTE_DB_TESTS=false`: **185 PASS, 232 SKIPPED**; các ca PostgreSQL chưa được kiểm chứng. Ba suite database trước đó thiếu opt-in đã dùng cùng parser của dự án, để cờ false thực sự ngăn kết nối/ghi dữ liệu.
- Backend lint, typecheck, build và Prisma validate PASS. Bổ sung endpoint evaluate-tiers có sẵn vào OpenAPI và generated frontend types. Test Groq chọn model rõ ràng; test Seller hoàn tất đơn dùng mã lỗi hiện hành. Cờ mock false của frontend được giữ đúng cả khi chưa có URL Auth.
- Draft PR #14 vào dev đã mở và giải quyết xung đột. Run CI đầu tiên thất bại tại lint hai phía; các sửa lỗi được đẩy để chạy lại, chưa suy ra CI PASS từ kết quả local.
- Đã tạo tổ chức Free `Dino E2E Test` và chuẩn bị form project `dino-mall-e2e-test`. Đang chờ chủ tài khoản tự nhập credential database mới và tạo project; chưa có đích database test để chạy migration/seed/live E2E. Trạng thái vẫn nghiệm thu từng phần.

### Kết quả CI và project test mới

Run [38071586895](https://github.com/lwd7071/e-commerce-platform/actions/runs/38071586895) cho commit e733a18: frontend quality PASS. Backend migration, lint, typecheck, build và native tests đã qua; Vitest chạy trên PostgreSQL/Redis riêng của GitHub Actions có **414 PASS, 3 FAIL**. Seller Mall database suite **11/11 PASS**, Tiering & Loyalty **17/17 PASS**. Ba lỗi còn lại là danh sách bảng mong đợi trong schema acceptance/smoke/rebuild chưa có `shop_mall_requests` và `shop_chat_presence`; cập nhật danh sách feature tables theo migrations có sẵn, giữ nguyên Schema Freeze và migrations.

Chủ tài khoản đã tạo project riêng `tejmnwemsnosolidkvqb`, tên hiển thị `NVCuong3112's Project`, trong tổ chức `Dino E2E Test`, khu vực Sydney. Dashboard Healthy, chưa có migrations. Cấu hình test nằm ngoài Git; cần mật khẩu database và Secret key của chính project này trước khi kết nối. Bằng chứng CI database không thay thế ba hành trình browser live.
