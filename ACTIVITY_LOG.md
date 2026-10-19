# Project Activity Log

## 2026-10-19 — Công việc trong ngày

### Các commit đã tạo

- `038d246` — Thêm nhắc người bán hoàn thiện hồ sơ shop khi thiếu số điện thoại hoặc địa chỉ lấy hàng; bổ sung test UI.
- `a6c8e85` — Dùng phí giao hàng GHTK cho checkout mô phỏng; cập nhật API và test phí vận chuyển/đơn hàng.
- `04fbcfc` — Thêm API voucher toàn sàn, liên kết voucher shop tới storefront và hiển thị ưu đãi trên trang chủ.
- `a9f1284` — Chuyển ticker voucher trang chủ sang băng chuyền liên tục, có kiểm thử giao diện.
- `caa0c82` — Hiển thị trạng thái xác nhận thanh toán online trong màn đơn hàng Seller; cập nhật OpenAPI và test.
- `18d4c19` — Sửa ánh xạ nội dung đánh giá từ API/repository frontend; thêm test review API.
- `61c6447` — Làm tròn điểm KPI và thống kê hạng shop khi hiển thị, sửa tràn thẻ KPI; thêm test liên quan.
- `5a2adba` — Chuẩn hóa địa chỉ giao hàng và lưu báo cáo dự án cùng tài liệu, sơ đồ và ảnh kiểm tra.
- `0604a78` — Tối ưu thanh điều hướng quản trị và tách tab shop/danh mục.
- `72d248e` — Đồng bộ cấu hình deployment với dự án Supabase mới.
- `f012c28` — Thêm hộp thư chat nổi cho buyer, mở lịch sử hội thoại từ hộp thư và cập nhật các luồng chat/UI liên quan.
- `765c50f` — Bổ sung validation ở UI/API cho các luồng địa chỉ và hồ sơ buyer, checkout, hồ sơ shop/Dino Mall, sản phẩm, ví, voucher, đánh giá, chat, một số form quản trị và tìm kiếm sản phẩm; cập nhật OpenAPI và test.

### Công việc và kiểm thử

- Các thay đổi địa chỉ buyer gồm chuẩn hóa trường địa chỉ chi tiết/khu vực, kiểm tra tên người nhận 2–100 ký tự, điện thoại nội địa 10 số và địa chỉ chi tiết tối đa 255 ký tự.
- Bổ sung giới hạn cho mô tả sản phẩm, biến thể, shop, tin nhắn, đánh giá, thông tin ngân hàng, voucher và một số lý do/ghi chú quản trị; cập nhật giới hạn email, mật khẩu và tên hồ sơ trên các form xác thực.
- Thêm lỗi tại trường và trạng thái hỗ trợ screen reader cho các form đã cập nhật; thêm bộ đếm cho nội dung dài ở những màn hình liên quan.
- Frontend typecheck đạt. Các test UI mục tiêu đạt; bộ test backend DTO/buyer/wallet đạt 66/66 và test catalog đạt 4/4.
- Toàn bộ frontend test đạt 447/449. Test địa chỉ quá thời gian chờ khi chạy đồng thời cả bộ nhưng đạt khi chạy riêng; test `next-root-env` bị môi trường chặn tạo symlink (`EPERM`).
- Backend typecheck còn lỗi khai báo kiểu `ws` trong WebSocket (thiếu `@types/ws`). Một số test HTTP Supertest không chạy được do môi trường chặn kết nối loopback (`EACCES`).
- Validation chưa bao phủ hết mọi trường nhập của toàn bộ màn quản trị và bộ lọc theo kế hoạch; cần tiếp tục các lát còn lại trước khi coi phạm vi này hoàn tất.

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


