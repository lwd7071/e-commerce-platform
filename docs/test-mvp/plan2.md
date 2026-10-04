# Kế hoạch kiểm thử MVP — Đợt 2

## Mục tiêu

Kiểm tra lại hệ thống sau khi các nhánh tính năng đã được gộp vào `dev`, tập trung vào **luồng xuyên vai trò trên frontend, backend và database thật của môi trường test**. Đợt 1 trong [plan.md](plan.md) là mốc tham chiếu; kết quả và bằng chứng cũ không tự động được tính là đã qua đợt 2.

Tiêu chí nghiệp vụ theo [quy tắc theo vai trò](../architecture/role-business-rules.md), [testing quality gates](../architecture/rules/testing-quality-gates.md) và các state machine được liên kết từ đó. Nếu tài liệu và hành vi thực tế khác nhau, ghi rõ sai lệch để quyết định, không tự đổi rule cho khớp code.

## Chuẩn bị chung

1. Ghi commit SHA của `dev`, phiên bản frontend/backend, ngày chạy và URL môi trường test vào báo cáo. Dùng môi trường và dữ liệu test riêng; không dùng production.
2. Chạy migration trên database test, chuẩn bị Redis/storage/cấu hình thanh toán test khi luồng cần đến. Xác nhận frontend gọi đúng backend và không bật chế độ mock cho các ca được đánh dấu **live**.
3. Chuẩn bị tài khoản Guest, hai Buyer, hai Seller thuộc hai Shop khác nhau (`ACTIVE` và `PENDING`), một Admin; sản phẩm có variant/tồn kho, voucher, địa chỉ và dữ liệu đơn hàng. Không ghi mật khẩu, token hay secret vào tài liệu.
4. Chạy baseline lint, typecheck, build và các bộ test tự động hiện có của frontend/backend. Ghi lệnh, số ca pass/fail và lỗi môi trường; test mô phỏng hoặc mock API phải được ghi đúng là test mô phỏng.
5. Dùng mã ca mới dạng `T2-P1-01`…`T2-P5-01`. Chia sẻ ID dữ liệu test và Order giữa các người để theo dõi trọn hành trình; tránh cùng sửa một fixture khi chạy song song.

## Luồng chung phải đi hết

| Mã | Hành trình | Bằng chứng tối thiểu |
|---|---|---|
| `T2-E2E-01` | Guest xem sản phẩm → Buyer đăng nhập → thêm variant vào giỏ → chọn địa chỉ/voucher → checkout → xem đơn → Seller xác nhận, chuẩn bị, bàn giao vận chuyển → Buyer xác nhận nhận hàng khi đủ điều kiện → tạo review | Ảnh/trace từng mốc, request ID, Order ID, trạng thái và history, tồn kho, số tiền, notification, review |
| `T2-E2E-02` | Buyer tạo đơn rồi hủy khi còn được phép; thử hủy lặp và hủy sai trạng thái | History, tồn kho được hoàn đúng một lần, response khi gọi lặp/sai trạng thái |
| `T2-E2E-03` | Seller mở Shop `PENDING` → hoàn thiện hồ sơ/địa chỉ lấy hàng → Admin duyệt → Seller tạo và bán sản phẩm | Trạng thái Shop, quyền ghi trước/sau duyệt, product/variant lưu thật |
| `T2-E2E-04` | Admin khóa User/Shop hoặc ẩn Product có reason; thử truy cập bằng phiên cũ và kiểm tra audit | API bị chặn, trạng thái tài nguyên, reason và AdminLog |

Chạy các hành trình này trên backend và database test thật. Nếu cổng thanh toán hoặc đơn vị vận chuyển chỉ có sandbox, ghi rõ phần nào dùng sandbox và điểm bàn giao nào được mô phỏng. Không gọi một Playwright test có `page.route(...).fulfill(...)` là bằng chứng tích hợp live.

## Phân công 5 người

| Người | Phạm vi đợt 2 | Ca ưu tiên và điều kiện đạt | Ghi chép bắt buộc |
|---|---|---|---|
| **Người 1** | Guest, đăng ký/đăng nhập, phiên và điều hướng | Catalog công khai chỉ hiện hàng/Shop hợp lệ; `returnTo` sau đăng nhập; đăng xuất; token sai/hết hạn; Guest gọi API riêng tư; User `LOCKED` bị chặn dù phiên cũ còn hạn. Cung cấp phiên Buyer/Seller/Admin cho các luồng chung. | Ghi tiếp vào [person-1.md](person-1.md), mục **Đợt 2**. |
| **Người 2** | Buyer: hồ sơ, địa chỉ, giỏ hàng, checkout, voucher, đơn mua, review và notification | Hai Buyer không xem/sửa dữ liệu nhau; địa chỉ mặc định và snapshot đơn; checkout một/nhiều Shop, tính tiền/voucher/tồn kho; gửi lại cùng idempotency key; hủy đơn và hoàn tồn một lần; chỉ review OrderItem đã hoàn tất, rating 1–5. Chủ trì đầu Buyer của `T2-E2E-01/02`. | Ghi tiếp vào [person-2.md](person-2.md), mục **Đợt 2**. |
| **Người 3** | Catalog, Seller Product, media và Chat AI/Live Chat | Guest/Buyer xem đúng catalog, lọc/phân trang/chi tiết; Seller tạo/sửa variant, SKU, giá, tồn và ảnh thật; Shop khác không sửa được; ẩn/hiện sản phẩm; kiểm tra lại thêm/xóa variant từng gặp timeout; review media upload/attach nếu đã hỗ trợ; chat/presence và fallback khi API lỗi. Cung cấp sản phẩm cho `T2-E2E-01/03`. | Ghi tiếp vào [person-3.md](person-3.md), mục **Đợt 2**. |
| **Người 4** | Seller Shop, voucher, xử lý đơn, vận chuyển và báo cáo | Shop `PENDING` sửa hồ sơ Shop nhưng không được bán; Shop `ACTIVE` xử lý đúng Order thuộc mình; xác nhận → chuẩn bị → bàn giao → hoàn tất theo rule, không tự hoàn tất trái quyền; voucher Shop dùng trong checkout; thử Shop khác, trạng thái sai và thao tác lặp; đối chiếu doanh thu chỉ từ Order hợp lệ `COMPLETED`. Chủ trì đầu Seller của `T2-E2E-01/03`. | Ghi tiếp vào [person-4.md](person-4.md), mục **Đợt 2**. |
| **Người 5** | Admin, RBAC, audit, thanh toán/ví/escrow và điều phối hồi quy | Duyệt/khóa/mở Shop/User, moderation Product/Review, Order command có reason và audit; kiểm tra quyền/owner; đối chiếu payment callback lặp, escrow/refund/reconcile trên môi trường test nếu được cấu hình; chạy lại các lỗi Blocker/Cao đã sửa và xác nhận không còn ảnh hưởng luồng khác. Chủ trì `T2-E2E-04` và tổng hợp kết quả. | Ghi tiếp vào [person-5.md](person-5.md), mục **Đợt 2**. |

Người 2 và 4 cùng xác nhận Order ID của `T2-E2E-01/02`; Người 3 xác nhận sản phẩm/ảnh; Người 1 xác nhận phiên/quyền; Người 5 kiểm tra audit và báo cáo chéo. Mỗi người vẫn chịu trách nhiệm ghi kết quả phần mình vào **file `person-*.md` hiện có**. Không tạo file tiến độ cá nhân mới và không ghi đè nhật ký đợt 1.

## Cách chạy và ghi kết quả

1. **Baseline:** ghi kết quả test tự động và môi trường. Lỗi test do thiếu dịch vụ/fixture vẫn là `Bị chặn`, kèm nguyên nhân và cách tái chạy; không ghi `Đã xác minh`.
2. **Luồng thành công:** thao tác qua UI như người dùng thật; kiểm tra request/response, dữ liệu lưu, trạng thái, notification/history/audit tại từng điểm quan trọng.
3. **Luồng bị từ chối:** kiểm tra sai role, sai owner, sai trạng thái, dữ liệu biên, gửi lại request và lỗi dịch vụ. Backend phải từ chối đúng; UI phải thông báo rõ và giữ dữ liệu nhập khi phù hợp.
4. **Lỗi:** ghi bước tái hiện, mong đợi/thực tế, mức độ, bằng chứng, người xử lý và liên kết commit/PR. Sau sửa, chạy lại đúng ca lỗi và ca liền kề; lỗi Blocker/Cao cần người khác xác minh lại.
5. **Báo cáo cá nhân:** mỗi người **tiếp tục cập nhật chính file `person-N.md` đã dùng ở đợt 1**. Thêm mục `## Đợt 2 — kiểm thử sau merge` gồm ngày, commit, môi trường, bảng ca, lỗi mở, kết quả kiểm tra lại và giới hạn. Mỗi ca theo mẫu trong [README.md](README.md); ghi rõ bằng chứng là live, sandbox hay mock.
6. **Tổng hợp:** Người 5 cập nhật bảng cuối file này sau khi đọc đủ năm file cá nhân. Chỉ đánh dấu hoàn tất khi có bằng chứng mới của đợt 2.

## Bảng theo dõi đợt 2

| Người | Trạng thái | Ca đã chạy / dự kiến | Lỗi mở (Blocker/Cao/Vừa/Thấp) | Cập nhật gần nhất |
|---|---|---|---|---|
| Người 1 | Đang làm (Đã chạy ca biên) | 3 / 5 | 0 / 0 / 0 / 0 | 2026-10-04 |
| Người 2 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |
| Người 3 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |
| Người 4 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |
| Người 5 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |

## Điều kiện kết thúc

- Bốn hành trình chung có kết quả và bằng chứng trên môi trường test, hoặc có mục `Bị chặn` nêu rõ phần chưa thể chạy.
- Cả năm file `person-*.md` có mục Đợt 2 với commit, môi trường, ca đã chạy, kết quả và bằng chứng mới.
- Không còn lỗi Blocker/Cao chưa được xử lý hoặc chưa có quyết định rõ; lỗi Vừa/Thấp còn lại có người phụ trách và mức ảnh hưởng.
- Lint, typecheck, build và test liên quan có kết quả được ghi; các phần dùng mock/sandbox được phân biệt với luồng live.
- Người 5 đối chiếu bảng tổng hợp với nhật ký của năm người và ghi kết luận phát hành/test tiếp.
