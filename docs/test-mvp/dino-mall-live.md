# Kiểm chứng Dino Mall nối hệ thống thật

## Trạng thái ngày 10/10/2026

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
