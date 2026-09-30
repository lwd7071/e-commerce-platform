# Kế hoạch kiểm thử và sửa lỗi MVP

## Mục tiêu

Tìm và xử lý lỗi bằng cách đi xuyên suốt các luồng người dùng theo role, thay vì chỉ kiểm tra từng màn hình. Tiêu chí nghiệp vụ căn cứ [role-business-rules.md](../architecture/role-business-rules.md). State machine đơn hàng, giao dịch và các rule gốc phải được đọc theo liên kết tại tài liệu này.

## Nguyên tắc

- Kiểm thử cả đường đi thành công, dữ liệu biên, lỗi có thể dự đoán và quyền sở hữu; xác minh ở UI lẫn dữ liệu/API khi phù hợp.
- FE chỉ hiển thị hành động hợp lệ; backend vẫn phải từ chối sai role, sai owner và sai trạng thái.
- Không sửa quy tắc nghiệp vụ chỉ để làm ca test qua. Ghi đề xuất Change Request nếu tài liệu và hành vi mong muốn chưa thống nhất.
- Mỗi lỗi có bước tái hiện và bằng chứng trước khi sửa; sau sửa chạy lại ca lỗi và hồi quy các luồng liên quan.
- Không dùng tài khoản hoặc dữ liệu production. Che thông tin nhạy cảm trong log/ảnh.

## Phân công 5 người

Thay `Người 1…5` bằng tên thành viên khi bắt đầu. Mỗi người chịu trách nhiệm kiểm thử, ghi lỗi, phối hợp sửa phần liên quan và cập nhật file tiến độ của mình. Nếu sửa chạm vùng của người khác, phối hợp review trước khi gộp.

| Người | Phạm vi chính | Luồng cần đi hết | Báo cáo |
|---|---|---|---|
| Người 1 | Guest và xác thực | Catalog công khai → đăng ký/đăng nhập → quay lại luồng dự định; guest gọi private API; đăng xuất; tài khoản LOCKED thử protected request | [person-1.md](person-1.md) |
| Người 2 | Buyer: hồ sơ và địa chỉ | Đăng nhập → sửa hồ sơ → tạo/sửa/xóa/đặt mặc định địa chỉ → kiểm tra quyền sở hữu và trạng thái mặc định | [person-2.md](person-2.md) |
| Người 3 | Buyer: mua hàng | Catalog → sản phẩm/giỏ → checkout (tồn, giá, voucher, idempotency, nhiều Shop) → theo dõi/hủy đúng điều kiện → nhận hàng → đánh giá OrderItem đủ điều kiện | [person-3.md](person-3.md) |
| Người 4 | Seller: Shop và đơn bán/giao hàng | Onboarding Shop PENDING → hồ sơ/địa chỉ lấy hàng theo luồng hiện có → sản phẩm/tồn/voucher → xác nhận đơn → chuẩn bị → giao vận chuyển → hoàn tất/hủy theo state machine; thử truy cập chéo Shop và Shop không ACTIVE | [person-4.md](person-4.md) |
| Người 5 | Admin và hồi quy quyền/dữ liệu | Duyệt/khóa/mở Shop, khóa/mở User, category/kiểm duyệt, thao tác Order qua command; xác minh lý do/audit/role/owner và chạy hồi quy nhanh các luồng blocker | [person-5.md](person-5.md) |

## Trình tự thực hiện

1. **Chuẩn bị:** xác nhận FE/BE đang chạy, môi trường và phiên bản; lập bộ tài khoản test Guest, Buyer, Seller (Shop ACTIVE/PENDING nếu có), Admin; chuẩn bị sản phẩm, tồn kho, voucher, địa chỉ và đơn có thể dùng lại. Không chia sẻ mật khẩu trong docs.
2. **Baseline:** từng người chạy luồng được giao theo trạng thái hiện tại và ghi mọi sai lệch, kể cả lỗi UI, API, quyền, dữ liệu và trạng thái.
3. **Phân loại:** nhóm trùng lặp; ưu tiên Blocker/Cao, lỗi dữ liệu và authorization trước. Gán người sửa, ghi nguyên nhân khi xác định.
4. **Sửa:** sửa nhỏ theo từng lỗi, giữ rule hiện hành, thêm/điều chỉnh kiểm thử tự động phù hợp với lớp lỗi và cập nhật issue/PR/commit. Trường hợp cần đổi rule phải có quyết định nghiệp vụ trước.
5. **Xác minh:** người sửa chạy ca tái hiện; người kiểm thử hoặc người khác kiểm tra độc lập lỗi Blocker/Cao. Hồi quy luồng liền kề và role/owner liên quan.
6. **Kết thúc vòng:** cập nhật trạng thái, bằng chứng, lỗi còn mở và quyết định cần thiết. Không đánh dấu hoàn tất nếu chưa có kết quả kiểm tra lại.

## Ma trận bao phủ tối thiểu

| Lớp kiểm tra | Ví dụ cần xác minh |
|---|---|
| Luồng đúng | Thực hiện trọn hành trình và xác nhận trạng thái chuyển đúng từng bước |
| Role/owner | Guest, role sai, user khác, Shop khác, tài nguyên không tồn tại |
| Trạng thái | Chuyển hợp lệ, chuyển ngược/sai bước, yêu cầu lặp, thao tác đồng thời nếu có thể |
| Dữ liệu | Thiếu/sai định dạng, số lượng/giá/tồn biên, snapshot checkout, idempotency |
| Lỗi tích hợp | API lỗi/mất kết nối, thông báo dễ hiểu, không giả lập thành công |
| Lưu vết | Order history, audit/admin log và notification theo quy tắc tương ứng |

Đây là danh sách bao phủ để chọn ca phù hợp, không mặc định mọi ví dụ đã được triển khai. Đối chiếu API/runtime thực tế và ghi rõ phần chưa có.

## Theo dõi tổng thể

| Người | Trạng thái | Luồng đã chạy | Lỗi mở (Blocker/Cao/Vừa/Thấp) | Cập nhật gần nhất |
|---|---|---|---|---|
| Người 1 | Đã xác minh | 6 luồng Guest, Đăng ký/nhập, returnTo, Logout, Chặn Private API & LOCKED | 0 (B:0, C:0, V:0, T:0) | 2026-10-01 |
| Người 2 | Chưa bắt đầu | — | — | — |
| Người 3 | Đã xác minh | 8 luồng Giỏ hàng, Checkout Đa Shop, Idempotency, Quản lý đơn & Đánh giá | 0 (B:0, C:0, V:0, T:0) | 2026-10-01 |
| Người 4 | Chưa bắt đầu | — | — | — |
| Người 5 | Đã xác minh | 7 luồng Admin, Moderation, RBAC, Audit & Dashboard UI | 1 Thấp (Góp ý nhãn KPI) | 2026-10-01 |

## Tiêu chí hoàn thành

- Cả năm phạm vi đã đi hết luồng chính và kiểm tra role/owner, các bước trạng thái liên quan.
- Mọi lỗi đã ghi có kết quả mong đợi/thực tế và bằng chứng đủ để tái hiện; lỗi đã sửa có kết quả kiểm tra lại.
- Không còn lỗi Blocker/Cao chưa có quyết định xử lý rõ ràng; lỗi còn lại và giới hạn môi trường được liệt kê.
- Không có thay đổi trái rule đã chốt; mọi đề xuất đổi rule được ghi theo quy trình Change Request.
