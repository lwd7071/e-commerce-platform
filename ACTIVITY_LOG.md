# Project Activity Log

## 2026-10-19 — Voucher, thanh toán, đánh giá và địa chỉ

### Đã hoàn thành và commit

- **Nhắc hoàn thiện hồ sơ Seller** — commit `038d246`: thêm nhắc người bán bổ sung số điện thoại và địa chỉ lấy hàng trong hồ sơ shop.
- **Phí giao hàng mô phỏng** — commit `a6c8e85`: dùng phí từ GHTK trong checkout mô phỏng; kèm cập nhật kiểm tra shipping và order route.
- **Voucher toàn sàn và voucher shop** — commit `04fbcfc`: voucher shop dẫn tới storefront; thêm API voucher công khai cho ticker trang chủ và test API/UI.
- **Ticker voucher chạy liên tục** — commit `a9f1284`: đổi ticker từ chuyển từng mục sang băng chuyền liên tục.
- **Xác nhận thanh toán online cho Seller** — commit `caa0c82`: bổ sung thông tin trạng thái thanh toán vào đơn hàng người bán, OpenAPI và test liên quan.
- **Nội dung đánh giá sản phẩm** — commit `18d4c19`: sửa ánh xạ nội dung review trong repository frontend và thêm test API review.
- **Điểm đánh giá một chữ số thập phân** — commit `61c6447`: làm tròn điểm KPI và thống kê hạng shop để hiển thị một chữ số; sửa thẻ KPI tránh tràn; thêm test cho dashboard, repository, review API và ngưỡng xét hạng. Ngưỡng shop vẫn dùng điểm trung bình gốc.

### Trao đổi và việc đang dang dở

- **Luồng OTP email:** rà soát các bước hoàn thiện luồng và trao đổi về cấu hình Gmail App Password. Trong các thay đổi/commit hôm nay không có phần triển khai cấu hình bí mật gửi thư; cần cấu hình ở môi trường chạy ứng dụng và kiểm thử gửi/nhập OTP thực tế.
- **Trường địa chỉ người mua:** đang có thay đổi chưa commit ở backend validation/checkout và giao diện quản lý địa chỉ/checkout. Nội dung hiện có gồm gộp địa chỉ chi tiết với khu vực cũ, cập nhật nhãn/placeholder và test địa chỉ. Chưa xác nhận hoàn tất yêu cầu bố trí ô “Thôn/ấp/tổ dân phố” ngang hàng với “Địa chỉ chi tiết”.
- **Kiểm thử điểm đánh giá:** Vitest dashboard 5/5, test backend KPI và shop tier 9/9, review API 7/7; frontend typecheck và `git diff --check` đạt. Backend typecheck còn lỗi khai báo kiểu `ws` tại WebSocket. Playwright chưa xác minh được giao diện vì môi trường test báo access token hết hạn.
- Tại thời điểm ghi log, nhánh `dev` đang có 4 commit chưa nằm trên `origin/dev`: `a9f1284`, `caa0c82`, `18d4c19`, `61c6447`. Các file đang sửa dở khác trong working tree không được đưa vào những commit trên.

## 2026-10-17 — Đồng bộ migrations lên Supabase

- Phát hiện `public.shop_chat_presence` và `public.shop_mall_requests` chưa tồn tại trên Supabase qua truy vấn của người dùng trong SQL Editor.
- Hai migration tương ứng đã có trong repo nhưng chưa được áp dụng; kiểm tra `prisma migrate status` phát hiện tổng cộng **4 migrations đang chờ**.
- Kết nối ban đầu từ môi trường bị giới hạn không phân giải được DNS của database. Sau khi cho phép kết nối trực tiếp, Prisma kết nối thành công tới Supabase được cấu hình trong `.env`.
- Đã chạy `npx prisma migrate deploy`; cả 4 migration áp dụng thành công:
  - `20261003120000_secure_loyalty_ledger`
  - `20261003130000_shop_chat_presence`
  - `20261011100000_shop_mall_requests`
  - `20261011200000_loyalty_redemption_refunds`
- Xác minh read-only: `shop_chat_presence` và `shop_mall_requests` hiện có trong schema `public`; `prisma migrate status` báo database schema đã đồng bộ, không còn migration chờ.
- Không chạy test ứng dụng trong hoạt động này; phạm vi là áp dụng và xác minh migrations trên database.
