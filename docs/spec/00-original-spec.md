# Đặc tả gốc đầy đủ

> Bản Markdown này là bản chuyển đổi tra cứu của `Nhom04_ThietKeDuLieu.docx`, giữ nguyên thứ tự nội dung, tiêu đề, caption và bảng trong tài liệu nguồn. Các hình ảnh/đồ họa được đánh dấu tại vị trí tương ứng và vẫn xem trong DOCX gốc để không tạo thêm file ảnh.

**Nguồn:** [`Nhom04_ThietKeDuLieu.docx`](../../Nhom04_ThietKeDuLieu.docx)

**Bản schema tra cứu chuẩn hóa:** [`schema-freeze-v1.md`](schema-freeze-v1.md)

---

BỘ GIÁO DỤC VÀ ĐÀO TẠO

TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT

THÀNH PHỐ HỒ CHÍ MINH

KHOA CÔNG NGHỆ THÔNG TIN

> [Hình ảnh/đồ họa trong DOCX gốc - xem file nguồn]

ĐỒ ÁN MÔN HỌC

MÔN HỌC: CÔNG NGHỆ PHẦN MỀM

ĐỀ TÀI: Xây dựng nền tảng thương mại điện tử

(E-Commerce Platform)

Thực hiện: Nhóm 4

1. Lương Viết Vĩ Đông 24110202

2. Nông Văn Cường 24110176

3. Trần Đăng Thắng 24110333

4. Nguyễn Trung Hải 24110207

5. Nguyễn Minh Trí 24110359

Giảng viên hướng dẫn: ThS. Nguyễn Trần Thi Văn

### Mục tiêu đề tài

Đề tài xây dựng một hệ thống thương mại điện tử hoạt động theo mô hình sàn giao dịch trực tuyến, trong đó nhiều người bán có thể tạo gian hàng và đăng bán sản phẩm, còn người mua có thể tìm kiếm sản phẩm, thêm sản phẩm vào giỏ hàng, đặt hàng, áp dụng mã giảm giá, lựa chọn phương thức thanh toán, theo dõi đơn hàng và đánh giá sản phẩm sau khi mua.

Hệ thống đồng thời cung cấp các chức năng quản trị nhằm quản lý người dùng, gian hàng, danh mục, sản phẩm, đơn hàng, khuyến mãi, nội dung đánh giá và các trường hợp vi phạm.

Mục tiêu chính:

- Tin học hóa quy trình mua và bán hàng trực tuyến.

- Xây dựng quy trình nghiệp vụ gần với một sàn thương mại điện tử thực tế.

- Phân tách rõ quyền hạn giữa Khách, Người mua, Người bán và Quản trị viên.

- Quản lý tập trung dữ liệu sản phẩm, đơn hàng, thanh toán, vận chuyển, khuyến mãi và đánh giá.

- Hỗ trợ tìm kiếm, lọc, tra cứu và thống kê dữ liệu.

- Tạo nền tảng phù hợp để nhóm áp dụng quy trình phân tích yêu cầu, thiết kế, lập trình, kiểm thử và triển khai trong môn Công nghệ phần mềm.

### Đối tượng sử dụng

Hệ thống gồm các nhóm người dùng chính:

- Khách (Guest): người chưa đăng nhập.

- Người mua (Buyer): khách hàng đã có tài khoản.

- Người bán / Chủ Shop (Seller): người tạo gian hàng và kinh doanh sản phẩm.

- Quản trị viên (Admin): người vận hành và kiểm soát toàn hệ thống.

### Phạm vi nghiệp vụ

#### Trong phạm vi đồ án

- Đăng ký, đăng nhập, đăng xuất.

- Quản lý hồ sơ người dùng và địa chỉ nhận hàng.

- Xem danh mục và sản phẩm.

- Tìm kiếm, lọc và sắp xếp sản phẩm.

- Quản lý giỏ hàng.

- Tạo và quản lý đơn hàng.

- Thanh toán COD và mô phỏng thanh toán trực tuyến.

- Theo dõi trạng thái vận chuyển.

- Quản lý voucher/khuyến mãi.

- Đánh giá sản phẩm.

- Quản lý gian hàng của người bán.

- Quản lý sản phẩm và tồn kho.

- Người bán xử lý đơn hàng.

- Thống kê cơ bản cho người bán.

- Admin quản lý tài khoản, shop, danh mục, sản phẩm, đơn hàng và vi phạm.

- Thông báo các sự kiện quan trọng của đơn hàng.

#### Ngoài phạm vi hoặc chỉ mô phỏng

- Kết nối ngân hàng/ví điện tử thật.

- Đơn vị vận chuyển thật và định vị shipper thời gian thực.

- Livestream bán hàng, video thương mại.

- Hệ thống quảng cáo đấu thầu.

- Gợi ý sản phẩm bằng AI ở quy mô lớn.

- Chống gian lận tài chính chuyên sâu.

- Hệ thống kho vận đa quốc gia.

- Quy trình hoàn tiền thực tế qua ngân hàng.

### Quy trình mua hàng tổng quát

- Khách truy cập hệ thống và xem/tìm kiếm sản phẩm.

- Khách đăng nhập hoặc đăng ký tài khoản để thực hiện đặt hàng.

- Người mua chọn sản phẩm và phân loại sản phẩm.

- Người mua thêm sản phẩm vào giỏ hàng.

- Người mua chọn các sản phẩm cần thanh toán.

- Hệ thống kiểm tra giá, tồn kho và trạng thái sản phẩm.

- Người mua chọn địa chỉ nhận hàng.

- Người mua chọn voucher hợp lệ nếu có.

- Người mua chọn phương thức thanh toán.

- Hệ thống tính tổng tiền.

- Người mua xác nhận đặt hàng.

- Hệ thống tạo đơn hàng và trừ/giữ số lượng tồn tương ứng.

- Người bán xác nhận và chuẩn bị hàng.

- Đơn hàng chuyển qua các trạng thái vận chuyển.

- Người mua nhận hàng.

- Đơn hàng hoàn thành.

- Người mua có thể đánh giá sản phẩm đã mua.

### Quy trình bán hàng tổng quát

- Người bán đăng ký tài khoản và tạo gian hàng.

- Người bán cập nhật thông tin shop.

- Người bán tạo sản phẩm, hình ảnh, giá, phân loại và số lượng tồn.

- Sản phẩm hợp lệ được hiển thị trên sàn.

- Khi có đơn mới, người bán tiếp nhận đơn.

- Người bán xác nhận đơn và chuẩn bị hàng.

- Người bán bàn giao hàng cho đơn vị vận chuyển mô phỏng.

- Hệ thống cập nhật trạng thái đơn.

- Sau khi đơn hoàn thành, doanh thu được ghi nhận vào thống kê của shop.

## MỤC LỤC

## DANH MỤC HÌNH

Hình 4.1. Sơ đồ Use Case tổng quát của hệ thống thương mại điện tử 68

Hình 4.2. Sơ đồ Use Case chức năng của Khách 68

Hình 4.3. Sơ đồ Use Case quản lý tài khoản và hồ sơ 69

Hình 4.4. Sơ đồ Use Case tra cứu và xem sản phẩm 70

Hình 4.5. Sơ đồ Use Case quản lý giỏ hàng 70

Hình 4.6. Sơ đồ Use Case đặt hàng và Checkout 71

Hình 4.7. Sơ đồ Use Case thanh toán 71

Hình 4.8. Sơ đồ Use Case quản lý đơn hàng của Người mua 72

Hình 4.9. Sơ đồ Use Case vận chuyển 72

Hình 4.10. Sơ đồ Use Case đánh giá sản phẩm 73

Hình 4.11. Sơ đồ Use Case thông báo 73

Hình 4.12. Sơ đồ Use Case quản lý gian hàng 74

Hình 4.13. Sơ đồ Use Case quản lý sản phẩm 75

Hình 4.14. Sơ đồ Use Case quản lý biến thể và tồn kho 76

Hình 4.15. Sơ đồ Use Case xử lý đơn hàng của Người bán 77

Hình 4.16. Sơ đồ Use Case quản lý voucher và khuyến mãi 78

Hình 4.17. Sơ đồ Use Case báo cáo thống kê của Người bán 79

Hình 4.18. Sơ đồ Use Case quản lý người dùng 80

Hình 4.19. Sơ đồ Use Case quản lý shop 81

Hình 4.20. Sơ đồ Use Case quản lý danh mục 81

Hình 4.21. Sơ đồ Use Case kiểm duyệt sản phẩm và nội dung 82

Hình 4.22. Sơ đồ Use Case quản lý đơn hàng toàn hệ thống 83

Hình 4.23. Sơ đồ Use Case quản lý voucher toàn sàn 83

Hình 4.24. Sơ đồ Use Case báo cáo thống kê quản trị 84

Hình 4.25. Sơ đồ Use Case quản lý thông báo và nhật ký quản trị 85

Hình 5.26. Lược đồ logic tổng quát của hệ thống. 86

Hình 5.27. Sơ đồ quan hệ dữ liệu của hệ thống thương mại điện tử. 109

Hình 5.28. Phân quyền và phạm vi truy cập dữ liệu. 110

Hình 5.29. Vòng đời và chuyển trạng thái đơn hàng. 122

Hình 5.30. Quy trình transaction tạo đơn. 124

## DANH MỤC BẢNG

Bảng 3.1. Danh sách tác nhân và chức năng chính 57

Bảng 3.2. Mô tả vai trò của các tác nhân 57

Bảng 5.1. Mô tả bảng User. 90

Bảng 5.2. Mô tả bảng UserProfile. 91

Bảng 5.3. Mô tả bảng Address. 92

Bảng 5.4. Mô tả bảng Shop. 93

Bảng 5.5. Mô tả bảng Category. 93

Bảng 5.6. Mô tả bảng Product. 94

Bảng 5.7. Mô tả bảng ProductImage. 95

Bảng 5.8. Mô tả bảng ProductVariant. 96

Bảng 5.9. Mô tả bảng Cart. 96

Bảng 5.10. Mô tả bảng CartItem. 97

Bảng 5.11. Mô tả bảng Order. 99

Bảng 5.12. Mô tả bảng OrderItem. 99

Bảng 5.13. Mô tả bảng OrderStatusHistory. 100

Bảng 5.14. Mô tả bảng Payment. 101

Bảng 5.15. Mô tả bảng Shipment. 102

Bảng 5.16. Mô tả bảng Voucher. 103

Bảng 5.17. Mô tả bảng VoucherUsage. 104

Bảng 5.18. Mô tả bảng Review. 105

Bảng 5.19. Mô tả bảng ReviewImage. 105

Bảng 5.20. Mô tả bảng Notification. 106

Bảng 5.21. Mô tả bảng ModerationRecord. 107

Bảng 5.22. Mô tả bảng AdminLog. 108

Bảng 5.23. Ràng buộc khóa chính. 111

Bảng 5.24. Ràng buộc khóa ngoại. 113

Bảng 5.25. Ràng buộc miền giá trị. 115

Bảng 5.26. Ràng buộc liên thuộc tính. 116

Bảng 5.27. Tầm ảnh hưởng của ràng buộc liên thuộc tính. 116

Bảng 5.28. Ràng buộc liên bộ. 117

Bảng 5.29. Tầm ảnh hưởng của ràng buộc liên bộ. 118

Bảng 5.30. Ràng buộc liên quan hệ. 119

Bảng 5.31. Tầm ảnh hưởng của ràng buộc liên quan hệ. 119

## 1. KHẢO SÁT HIỆN TRẠNG

### 1.1. Hiện trạng

#### 1.1.1. Tổng quan

Mua bán trực tuyến hiện nay là một hình thức giao dịch phổ biến. Thay vì người mua phải đến trực tiếp cửa hàng, các sàn thương mại điện tử cho phép người mua tiếp cận nhiều gian hàng và nhiều sản phẩm trên cùng một hệ thống.

Đặc trưng của mô hình sàn thương mại điện tử là hệ thống không chỉ phục vụ một cửa hàng duy nhất mà phải đồng thời giải quyết nhu cầu của nhiều nhóm người dùng: người mua, người bán và đơn vị quản trị sàn. Vì vậy dữ liệu và quy trình nghiệp vụ có quan hệ chặt chẽ với nhau, đặc biệt giữa sản phẩm - giỏ hàng - đơn hàng - thanh toán và vận chuyển - khuyến mãi - đánh giá.

Trong phạm vi đồ án, hệ thống thương mại điện tử được khảo sát theo các quy trình cốt lõi thường xuất hiện ở một sàn thương mại điện tử.

#### 1.1.2. Hiện trạng phía người mua

Người mua có nhu cầu:

- Xem sản phẩm mà không bắt buộc đăng nhập.

- Xem sản phẩm theo danh mục.

- Tìm sản phẩm bằng từ khóa.

- Lọc theo khoảng giá, danh mục, shop, đánh giá hoặc tình trạng còn hàng.

- Xem chi tiết sản phẩm trước khi quyết định mua.

- Xem giá bán, giá khuyến mãi, số lượng tồn và các phân loại.

- Xem thông tin shop.

- Xem đánh giá của những khách hàng đã mua.

- Lưu nhiều sản phẩm trong giỏ hàng.

- Chọn số lượng và phân loại sản phẩm.

- Chọn địa chỉ giao hàng.

- Sử dụng voucher nếu đáp ứng điều kiện.

- Biết rõ tổng tiền trước khi xác nhận.

- Chọn COD hoặc hình thức thanh toán trực tuyến mô phỏng.

- Theo dõi tiến độ xử lý đơn.

- Hủy đơn trong những trạng thái được cho phép.

- Xác nhận đã nhận hàng.

- Đánh giá sản phẩm sau khi đơn hoàn tất.

- Xem lại lịch sử mua hàng.

##### Các vấn đề cần giải quyết

Nếu không có hệ thống quản lý tập trung, người mua có thể gặp các vấn đề:

- Khó tìm kiếm sản phẩm trong số lượng sản phẩm lớn.

- Không biết chính xác sản phẩm còn hàng hay hết hàng.

- Giá trong giỏ hàng có thể khác giá hiện tại nếu dữ liệu không được kiểm tra lại.

- Voucher có thể bị áp dụng sai điều kiện.

- Khó biết đơn hàng đang ở giai đoạn nào.

- Không có lịch sử giao dịch tập trung.

- Đánh giá có thể không đáng tin nếu bất kỳ ai cũng được phép đánh giá sản phẩm.

- Việc mua nhiều sản phẩm từ nhiều shop làm quy trình xử lý phức tạp hơn.

Hệ thống cần kiểm tra dữ liệu tại thời điểm đặt hàng, ghi nhận lịch sử trạng thái đơn và chỉ cho phép các thao tác phù hợp với trạng thái hiện tại.

#### 1.1.3. Hiện trạng phía người bán

Người bán trên sàn phải quản lý nhiều loại thông tin:

- Hồ sơ gian hàng.

- Danh sách sản phẩm.

- Danh mục của sản phẩm.

- Hình ảnh sản phẩm.

- Phân loại/biến thể.

- Giá bán.

- Số lượng tồn.

- Trạng thái hiển thị sản phẩm.

- Đơn hàng mới.

- Đơn đang chuẩn bị.

- Đơn đang giao.

- Đơn hoàn thành/hủy.

- Voucher của shop.

- Đánh giá của khách hàng.

- Doanh thu và số lượng sản phẩm bán ra.

##### Quy trình đăng bán

- Người bán truy cập kênh quản lý shop.

- Chọn chức năng thêm sản phẩm.

- Nhập tên, mô tả, danh mục.

- Thêm hình ảnh.

- Khai báo giá bán.

- Khai báo phân loại nếu có.

- Khai báo tồn kho.

- Lưu sản phẩm.

- Hệ thống kiểm tra dữ liệu bắt buộc.

- Sản phẩm được đưa vào trạng thái phù hợp và có thể xuất hiện trên trang mua hàng.

##### Quy trình xử lý đơn

- Hệ thống thông báo shop có đơn mới.

- Shop xem chi tiết đơn.

- Shop kiểm tra khả năng đáp ứng.

- Shop xác nhận đơn.

- Shop chuẩn bị hàng.

- Shop chuyển trạng thái sang chờ/đã bàn giao vận chuyển.

- Hệ thống tiếp tục cập nhật trạng thái vận chuyển.

- Khi giao thành công, đơn chuyển sang hoàn thành.

- Doanh thu được ghi nhận.

##### Các vấn đề cần giải quyết

- Một shop có thể có nhiều sản phẩm và nhiều biến thể.

- Tồn kho phải được cập nhật nhất quán.

- Không được bán số lượng vượt tồn kho.

- Sản phẩm ngừng kinh doanh không nên bị xóa vật lý nếu đã xuất hiện trong đơn cũ.

- Người bán chỉ được quản lý dữ liệu thuộc shop của mình.

- Người bán không được tự ý thay đổi đơn đã ở trạng thái không cho phép.

- Thống kê phải lấy từ dữ liệu đơn hàng hợp lệ thay vì nhập thủ công.

#### 1.1.4. Hiện trạng quản lý sản phẩm và danh mục

Số lượng sản phẩm trên sàn có thể lớn nên cần tổ chức sản phẩm theo danh mục.

Thông tin cơ bản cần quản lý:

- Mã sản phẩm.

- Shop sở hữu.

- Tên sản phẩm.

- Danh mục.

- Mô tả.

- Hình ảnh.

- Giá.

- Phân loại/biến thể.

- Tồn kho.

- Số lượng đã bán.

- Trạng thái.

- Thời gian tạo/cập nhật.

Danh mục cần được Admin quản lý tập trung để tránh tình trạng mỗi shop tự tạo các danh mục trùng lặp hoặc không thống nhất.

#### 1.1.5. Hiện trạng quản lý giỏ hàng

Giỏ hàng là vùng dữ liệu tạm trước khi tạo đơn.

Hệ thống cần:

- Cho phép thêm nhiều sản phẩm.

- Phân biệt từng biến thể.

- Thay đổi số lượng.

- Xóa sản phẩm.

- Chọn/bỏ chọn sản phẩm để thanh toán.

- Không cho số lượng vượt tồn kho.

- Cập nhật lại giá và tồn kho trước khi checkout.

Giá lưu trong giỏ chỉ mang tính tham chiếu; giá dùng để tạo đơn phải được hệ thống xác nhận lại tại thời điểm đặt hàng.

#### 1.1.6. Hiện trạng quản lý đơn hàng

Đơn hàng là nghiệp vụ trung tâm của hệ thống.

Một vòng đời đơn hàng đề xuất:

Chờ xác nhận → Đã xác nhận → Đang chuẩn bị hàng → Đang giao → Đã giao/Hoàn thành

Các nhánh khác:

Chờ xác nhận → Đã hủy

hoặc khi mở rộng:

Đang giao → Giao thất bại

Mỗi lần thay đổi trạng thái cần được ghi nhận để:

- Người mua theo dõi.

- Người bán biết công việc tiếp theo.

- Admin kiểm tra khi có tranh chấp.

- Hệ thống thống kê chính xác.

#### 1.1.7. Hiện trạng thanh toán

Trong đồ án, thanh toán được chia thành:

- COD: thanh toán khi nhận hàng.

- Thanh toán trực tuyến mô phỏng: hệ thống giả lập kết quả thành công/thất bại, không kết nối tiền thật.

Thông tin thanh toán cần lưu:

- Mã giao dịch.

- Mã đơn.

- Phương thức.

- Số tiền.

- Trạng thái.

- Thời điểm tạo.

- Thời điểm thanh toán nếu thành công.

Không nên lưu thông tin nhạy cảm như số thẻ ngân hàng thật.

#### 1.1.8. Hiện trạng vận chuyển

Đồ án không xây dựng hệ thống logistics thật mà mô phỏng quá trình giao nhận bằng trạng thái.

Thông tin cần quản lý:

- Địa chỉ nhận.

- Người nhận.

- Số điện thoại.

- Phí vận chuyển.

- Đơn vị vận chuyển mô phỏng.

- Mã vận đơn nếu có.

- Trạng thái vận chuyển.

- Lịch sử trạng thái.

#### 1.1.9. Hiện trạng voucher và khuyến mãi

Voucher giúp mô phỏng hoạt động kích cầu của sàn và shop.

Một voucher có thể có:

- Mã voucher.

- Tên chương trình.

- Loại giảm: phần trăm hoặc số tiền.

- Giá trị giảm.

- Mức giảm tối đa.

- Giá trị đơn tối thiểu.

- Số lượng.

- Số lượt đã sử dụng.

- Thời gian bắt đầu.

- Thời gian kết thúc.

- Phạm vi áp dụng.

- Trạng thái.

Khi checkout, hệ thống phải kiểm tra voucher còn hiệu lực, còn lượt sử dụng và đơn hàng đạt điều kiện.

#### 1.1.10. Hiện trạng đánh giá sản phẩm

Đánh giá là nguồn thông tin tham khảo quan trọng đối với người mua.

Để hạn chế đánh giá không hợp lệ:

- Chỉ người đã mua sản phẩm mới được đánh giá.

- Đơn phải hoàn thành.

- Mỗi chi tiết đơn chỉ được đánh giá theo quy định của hệ thống.

- Điểm đánh giá nằm trong khoảng 1-5 sao.

- Admin có thể ẩn/xử lý đánh giá vi phạm.

#### 1.1.11. Hiện trạng quản trị sàn

Admin cần có công cụ quản trị tập trung để:

- Quản lý người dùng.

- Khóa/mở khóa tài khoản.

- Quản lý shop.

- Quản lý danh mục.

- Theo dõi sản phẩm.

- Ẩn sản phẩm vi phạm.

- Theo dõi đơn hàng.

- Quản lý voucher của sàn.

- Quản lý đánh giá/nội dung vi phạm.

- Xem báo cáo và thống kê.

Admin không nên chỉnh sửa tùy tiện dữ liệu giao dịch đã phát sinh; các hành động quản trị quan trọng cần có lý do hoặc nhật ký.

#### 1.1.12. Hiện trạng thông báo

Hệ thống cần thông báo cho đúng đối tượng khi có sự kiện:

- Người mua đặt hàng thành công.

- Người bán nhận đơn mới.

- Đơn được xác nhận.

- Đơn chuyển sang đang giao.

- Đơn giao thành công.

- Đơn bị hủy.

- Sản phẩm/shop/tài khoản bị Admin xử lý.

Trong MVP, thông báo có thể là thông báo nội bộ trong website, không bắt buộc email/SMS/push notification.

#### 1.1.13. Hiện trạng báo cáo và thống kê

##### Người bán cần

- Số đơn theo khoảng thời gian.

- Số đơn hoàn thành.

- Số đơn hủy.

- Doanh thu.

- Sản phẩm bán chạy.

- Số lượng sản phẩm đã bán.

##### Admin cần

- Tổng người dùng.

- Tổng shop.

- Tổng sản phẩm.

- Tổng đơn.

- Tổng giá trị giao dịch hợp lệ.

- Đơn theo trạng thái.

- Sản phẩm/shop có hoạt động nổi bật.

- Thống kê theo ngày/tháng/khoảng thời gian.

#### 1.1.14. Những hạn chế của quy trình thủ công hoặc hệ thống đơn giản

- Dữ liệu nằm rời rạc, khó đồng bộ.

- Dễ sai tồn kho.

- Khó kiểm soát quyền giữa các shop.

- Khó truy vết thay đổi trạng thái đơn.

- Dễ tính sai khuyến mãi.

- Báo cáo thủ công tốn thời gian.

- Khó kiểm soát nội dung vi phạm.

- Không có cơ chế xác thực người đã mua trước khi đánh giá.

- Khó mở rộng khi số lượng sản phẩm, shop và đơn tăng.

#### 1.1.15. Nhu cầu xây dựng hệ thống

Từ khảo sát trên, cần xây dựng một phần mềm có cơ sở dữ liệu tập trung, phân quyền rõ ràng, kiểm soát trạng thái nghiệp vụ và tự động hóa các phép tính trong quá trình mua bán.

Các công việc chính:

- Quản lý tài khoản.

- Quản lý hồ sơ và địa chỉ.

- Quản lý shop.

- Quản lý danh mục.

- Quản lý sản phẩm và tồn kho.

- Tìm kiếm sản phẩm.

- Quản lý giỏ hàng.

- Quản lý đặt hàng.

- Quản lý thanh toán.

- Quản lý vận chuyển.

- Quản lý voucher.

- Quản lý đánh giá.

- Quản lý thông báo.

- Quản lý vi phạm.

- Báo cáo và thống kê.

### 1.2. Yêu cầu

#### 1.2.1. Lưu trữ

Hệ thống cần lưu trữ:

- Tài khoản: mã người dùng, email/tên đăng nhập, mật khẩu đã mã hóa, vai trò, trạng thái.

- Hồ sơ: họ tên, số điện thoại, ảnh đại diện.

- Địa chỉ: người nhận, số điện thoại, tỉnh/thành, quận/huyện, phường/xã, địa chỉ chi tiết, mặc định.

- Shop: mã shop, chủ shop, tên shop, mô tả, ảnh/logo, trạng thái.

- Danh mục: mã danh mục, tên, danh mục cha, trạng thái.

- Sản phẩm: mã, shop, danh mục, tên, mô tả, trạng thái.

- Hình ảnh sản phẩm: sản phẩm, đường dẫn ảnh, thứ tự.

- Biến thể: tên biến thể, SKU, giá, tồn kho.

- Giỏ hàng: người mua, sản phẩm/biến thể, số lượng.

- Đơn hàng: người mua, shop, địa chỉ giao, tiền hàng, giảm giá, phí vận chuyển, tổng thanh toán, trạng thái.

- Chi tiết đơn: sản phẩm, biến thể, giá tại thời điểm mua, số lượng, thành tiền.

- Thanh toán: đơn hàng, phương thức, số tiền, trạng thái, mã giao dịch.

- Vận chuyển: đơn hàng, đơn vị vận chuyển, mã vận đơn, trạng thái.

- Lịch sử trạng thái: trạng thái cũ/mới, thời gian, người thực hiện.

- Voucher: mã, loại giảm, giá trị, điều kiện, số lượng, thời gian hiệu lực.

- Đánh giá: người mua, sản phẩm, chi tiết đơn, số sao, nội dung, thời gian, trạng thái.

- Thông báo: người nhận, tiêu đề, nội dung, trạng thái đã đọc.

- Vi phạm: đối tượng bị xử lý, lý do, người xử lý, thời gian.

- Nhật ký quản trị: hành động, tài khoản thực hiện, thời gian.

#### 1.2.2. Tra cứu

- Sản phẩm theo tên/từ khóa.

- Sản phẩm theo danh mục.

- Sản phẩm theo khoảng giá.

- Sản phẩm theo shop.

- Sản phẩm theo đánh giá.

- Đơn hàng theo mã đơn.

- Đơn hàng theo trạng thái.

- Đơn hàng theo khoảng thời gian.

- Shop theo tên/trạng thái.

- Người dùng theo tên/email/trạng thái.

- Voucher theo mã/thời gian/trạng thái.

- Đánh giá theo sản phẩm/số sao.

- Thông báo theo trạng thái đã đọc/chưa đọc.

#### 1.2.3. Tính toán

Thành tiền một dòng hàng:

ThanhTien = DonGiaTaiThoiDiemMua × SoLuong

Tổng tiền hàng:

TongTienHang = Σ ThanhTien

Giảm giá voucher phần trăm:

GiamGia = min(TongTienHang × TyLeGiam, MucGiamToiDa)

Voucher giảm cố định:

GiamGia = GiaTriGiamCoDinh

với điều kiện đơn đạt giá trị tối thiểu và voucher hợp lệ.

Tổng thanh toán:

TongThanhToan = TongTienHang + PhiVanChuyen - GiamGia

Trong mọi trường hợp:

TongThanhToan >= 0

Doanh thu shop trong báo cáo:

DoanhThu = Σ TongGiaTriCacDonHangHopLe

Chỉ tính các đơn thuộc trạng thái được quy định là hoàn thành/thành công.

#### 1.2.4. Kết xuất

- Danh sách sản phẩm.

- Danh sách đơn hàng.

- Chi tiết đơn hàng.

- Lịch sử trạng thái đơn.

- Danh sách sản phẩm sắp hết hàng.

- Báo cáo doanh thu shop.

- Báo cáo sản phẩm bán chạy.

- Báo cáo số đơn theo trạng thái.

- Báo cáo người dùng/shop/sản phẩm/đơn hàng toàn hệ thống.

## 2. LẬP DANH SÁCH YÊU CẦU

### 2.1. Danh sách yêu cầu chức năng nghiệp vụ

Phân loại công việc sử dụng tương tự mẫu: Lưu trữ, Tra cứu, Tính toán, Kết xuất.

Mã số: TK

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Đăng ký tài khoản | Lưu trữ | Email/tên đăng nhập không được trùng; mật khẩu phải đạt quy định | TK_BM1 | Tạo tài khoản người mua |
| 2 | Đăng nhập | Tra cứu | Kiểm tra thông tin xác thực và trạng thái tài khoản | TK_BM2 | Tài khoản bị khóa không được đăng nhập |
| 3 | Đăng xuất | Lưu trữ | Hủy phiên đăng nhập hiện tại |  |  |
| 4 | Xem hồ sơ | Tra cứu | Chỉ xem hồ sơ của tài khoản hiện tại |  |  |
| 5 | Cập nhật hồ sơ | Lưu trữ | Kiểm tra định dạng dữ liệu | TK_BM3 |  |
| 6 | Đổi mật khẩu | Lưu trữ | Phải xác nhận mật khẩu hiện tại hoặc cơ chế tương đương |  |  |
| 7 | Quản lý địa chỉ nhận hàng | Lưu trữ | Mỗi người dùng có thể có nhiều địa chỉ | TK_BM4 | Có một địa chỉ mặc định |
| 8 | Xem thông báo | Tra cứu | Chỉ xem thông báo của chính mình |  |  |
| 9 | Đánh dấu thông báo đã đọc | Lưu trữ | Thông báo phải thuộc người dùng |  |  |

Biểu mẫu liên quan:

TK_BM1 - ĐĂNG KÝ TÀI KHOẢN

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Họ tên* | __________________________ |
| Email / Tên đăng nhập* | __________________________ |
| Số điện thoại | __________________________ |
| Mật khẩu* | __________________________ |
| Xác nhận mật khẩu* | __________________________ |

TK_BM2 - ĐĂNG NHẬP

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Email / Tên đăng nhập* | __________________________ |
| Mật khẩu* | __________________________ |
| Ghi nhớ đăng nhập | Có / Không |
| Kết quả đăng nhập | Thành công / Thất bại |
| Thông báo lỗi | __________________________ |

TK_BM3 - CẬP NHẬT HỒ SƠ

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã người dùng | __________________________ |
| Họ tên* | __________________________ |
| Số điện thoại | __________________________ |
| Ảnh đại diện | __________________________ |
| Ngày cập nhật | ____/____/________ |

TK_BM4 - ĐỊA CHỈ NHẬN HÀNG

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Người nhận* | __________________________ |
| Số điện thoại* | __________________________ |
| Tỉnh / Thành phố* | __________________________ |
| Quận / Huyện* | __________________________ |
| Phường / Xã* | __________________________ |
| Địa chỉ chi tiết* | __________________________ |
| Đặt làm địa chỉ mặc định | Có / Không |

#### 2.1.2. Bộ phận/Nhóm: Tra cứu và xem sản phẩm

Mã số: TCSP

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem danh sách sản phẩm | Tra cứu | Chỉ hiển thị sản phẩm được phép bán | TCSP_BM1 | Khách chưa đăng nhập vẫn xem được |
| 2 | Xem sản phẩm theo danh mục | Tra cứu | Danh mục đang hoạt động |  |  |
| 3 | Tìm kiếm sản phẩm | Tra cứu | Theo từ khóa tên sản phẩm | TCSP_BM2 | Có thể hỗ trợ gần đúng |
| 4 | Lọc sản phẩm | Tra cứu | Theo giá, danh mục, shop, đánh giá |  |  |
| 5 | Sắp xếp sản phẩm | Tra cứu | Giá tăng/giảm, mới nhất, bán chạy |  |  |
| 6 | Xem chi tiết sản phẩm | Tra cứu | Hiển thị giá, tồn, mô tả, biến thể | TCSP_BM3 |  |
| 7 | Xem thông tin shop | Tra cứu | Shop không bị khóa |  |  |
| 8 | Xem đánh giá sản phẩm | Tra cứu | Chỉ hiển thị đánh giá hợp lệ |  |  |

TCSP_BM1 - DANH SÁCH SẢN PHẨM

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Từ khóa | __________________________ |
| Danh mục | __________________________ |
| Khoảng giá | Từ __________ đến __________ |
| Shop | __________________________ |
| Điểm đánh giá tối thiểu | __________________________ |
| Sắp xếp theo | Mới nhất / Giá tăng / Giá giảm / Bán chạy |
| Kết quả | Mã SP \| Tên SP \| Shop \| Giá \| Tồn kho \| Đánh giá |

TCSP_BM2 - TÌM KIẾM SẢN PHẨM

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Từ khóa* | __________________________ |
| Danh mục | __________________________ |
| Bộ lọc bổ sung | __________________________ |
| Số kết quả tìm thấy | __________________________ |

TCSP_BM3 - CHI TIẾT SẢN PHẨM

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã sản phẩm | __________________________ |
| Tên sản phẩm | __________________________ |
| Shop | __________________________ |
| Danh mục | __________________________ |
| Giá bán | __________________________ |
| Giá khuyến mãi | __________________________ |
| Biến thể | __________________________ |
| Tồn kho | __________________________ |
| Mô tả | __________________________ |
| Điểm đánh giá | __________________________ |
| Số lượng đã bán | __________________________ |

#### 2.1.3. Bộ phận/Nhóm: Quản lý giỏ hàng

Mã số: QLGH

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem giỏ hàng | Tra cứu | Hiển thị các dòng hàng của người mua | QLGH_BM1 |  |
| 2 | Thêm sản phẩm vào giỏ | Lưu trữ | Sản phẩm/biến thể còn hoạt động |  | Không vượt tồn kho |
| 3 | Thay đổi số lượng | Lưu trữ | 1 <= SoLuong <= TonKho |  |  |
| 4 | Xóa sản phẩm khỏi giỏ | Lưu trữ | Dòng hàng thuộc giỏ hiện tại |  |  |
| 5 | Chọn sản phẩm để thanh toán | Lưu trữ | Có ít nhất một dòng được chọn |  |  |
| 6 | Tạm tính giỏ hàng | Tính toán | Tổng đơn giá × số lượng |  | Chưa phải số tiền cuối cùng |
| 7 | Kiểm tra lại giỏ trước checkout | Tra cứu | Kiểm tra giá, tồn kho, trạng thái |  | Bắt buộc trước khi tạo đơn |

QLGH_BM1 - GIỎ HÀNG

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Người mua | __________________________ |
| Danh sách dòng hàng | Mã SP \| Tên SP \| Biến thể \| Đơn giá \| Số lượng \| Thành tiền \| Chọn thanh toán |
| Tạm tính | __________________________ |

Mã số: DH

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Chọn địa chỉ nhận hàng | Tra cứu | Địa chỉ thuộc người mua | DH_BM1 |  |
| 2 | Chọn voucher | Tra cứu | Voucher hợp lệ và đạt điều kiện |  |  |
| 3 | Chọn phương thức thanh toán | Lưu trữ | COD hoặc online mô phỏng |  |  |
| 4 | Tính tiền hàng | Tính toán | Σ Đơn giá × Số lượng |  |  |
| 5 | Tính giảm giá | Tính toán | Theo quy định voucher |  | Không vượt mức tối đa |
| 6 | Tính tổng thanh toán | Tính toán | Tiền hàng + Phí VC - Giảm giá |  |  |
| 7 | Kiểm tra tồn kho lần cuối | Tra cứu | Tồn kho phải đủ |  | Tránh overselling |
| 8 | Tạo đơn hàng | Lưu trữ | Dữ liệu checkout hợp lệ | DH_BM2 | Có thể tách theo shop |
| 9 | Lưu chi tiết đơn | Lưu trữ | Lưu snapshot tên/giá/biến thể cần thiết |  | Không phụ thuộc giá tương lai |
| 10 | Cập nhật tồn kho | Lưu trữ | Trừ tồn theo số lượng đặt |  | Thực hiện đồng bộ với tạo đơn |
| 11 | Tạo thông báo đơn mới | Lưu trữ | Gửi cho buyer và seller phù hợp |  |  |

DH_BM2 - THÔNG TIN ĐƠN HÀNG

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã đơn | __________________________ |
| Người mua | __________________________ |
| Shop | __________________________ |
| Người nhận | __________________________ |
| Địa chỉ | __________________________ |
| Tiền hàng | __________________________ |
| Phí vận chuyển | __________________________ |
| Giảm giá | __________________________ |
| Tổng thanh toán | __________________________ |
| Phương thức thanh toán | __________________________ |
| Trạng thái | __________________________ |

DH_BM1 - THÔNG TIN CHECKOUT

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Người mua | __________________________ |
| Địa chỉ nhận hàng* | __________________________ |
| Số điện thoại nhận* | __________________________ |
| Danh sách sản phẩm | __________________________ |
| Voucher áp dụng | __________________________ |
| Phương thức thanh toán* | COD / Online mô phỏng |
| Tiền hàng | __________________________ |
| Phí vận chuyển | __________________________ |
| Giảm giá | __________________________ |
| Tổng thanh toán | __________________________ |

#### 2.1.5. Bộ phận/Nhóm: Quản lý đơn hàng của người mua

Mã số: QLDH-M

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem danh sách đơn | Tra cứu | Chỉ đơn của tài khoản hiện tại | QLDH_M_BM1 | Lọc theo trạng thái |
| 2 | Xem chi tiết đơn | Tra cứu | Kiểm tra quyền sở hữu đơn |  |  |
| 3 | Theo dõi trạng thái | Tra cứu | Dựa vào lịch sử trạng thái |  |  |
| 4 | Hủy đơn | Lưu trữ | Chỉ khi trạng thái cho phép |  | Cần lý do hủy |
| 5 | Xác nhận đã nhận hàng | Lưu trữ | Đơn đã ở trạng thái giao phù hợp |  |  |
| 6 | Mua lại | Lưu trữ | Thêm lại các sản phẩm còn hợp lệ vào giỏ |  | Có thể thay đổi giá/tồn |

QLDH_M_BM1 - DANH SÁCH ĐƠN MUA

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Người mua | __________________________ |
| Khoảng thời gian | Từ ____/____/____ đến ____/____/____ |
| Trạng thái | __________________________ |
| Danh sách hiển thị | Mã đơn \| Ngày đặt \| Shop \| Tổng tiền \| Thanh toán \| Trạng thái |

#### 2.1.6. Bộ phận/Nhóm: Thanh toán

Mã số: TT

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Chọn COD | Lưu trữ | Đơn cho phép COD | TT_BM1 |  |
| 2 | Tạo giao dịch online mô phỏng | Lưu trữ | Số tiền bằng tổng cần thanh toán |  | Không dùng tiền thật |
| 3 | Ghi nhận thanh toán thành công | Lưu trữ | Chỉ cập nhật từ luồng mô phỏng hợp lệ |  |  |
| 4 | Ghi nhận thanh toán thất bại | Lưu trữ | Lưu trạng thái thất bại |  |  |
| 5 | Xem trạng thái thanh toán | Tra cứu | Theo mã đơn/giao dịch |  |  |
| 6 | Đối chiếu số tiền | Tính toán | Số tiền giao dịch = số tiền đơn cần thanh toán |  |  |

TT_BM1 - THÔNG TIN THANH TOÁN

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã giao dịch | __________________________ |
| Mã đơn* | __________________________ |
| Phương thức* | COD / Online mô phỏng |
| Số tiền* | __________________________ |
| Trạng thái | Chờ thanh toán / Thành công / Thất bại |
| Thời điểm tạo | __________________________ |
| Thời điểm thanh toán | __________________________ |
| Ghi chú | __________________________ |

#### 2.1.7. Bộ phận/Nhóm: Vận chuyển

Mã số: VC

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Tạo thông tin vận chuyển | Lưu trữ | Gắn với đơn hợp lệ | VC_BM1 | Mô phỏng |
| 2 | Cập nhật mã vận đơn | Lưu trữ | Không trùng trong phạm vi quy định |  |  |
| 3 | Cập nhật trạng thái giao hàng | Lưu trữ | Theo luồng trạng thái hợp lệ |  | Seller/Admin tùy quyền |
| 4 | Xem trạng thái vận chuyển | Tra cứu | Buyer/Seller của đơn được xem |  |  |
| 5 | Xem lịch sử vận chuyển | Kết xuất | Theo thời gian tăng dần |  |  |
| 6 | Tính phí vận chuyển | Tính toán | Theo mức phí mô phỏng của đồ án |  | Có thể dùng phí cố định |

VC_BM1 - THÔNG TIN VẬN CHUYỂN

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã đơn* | __________________________ |
| Người nhận* | __________________________ |
| Số điện thoại* | __________________________ |
| Địa chỉ giao* | __________________________ |
| Đơn vị vận chuyển | __________________________ |
| Mã vận đơn | __________________________ |
| Phí vận chuyển | __________________________ |
| Trạng thái vận chuyển | __________________________ |
| Thời gian cập nhật | __________________________ |

#### 2.1.8. Bộ phận/Nhóm: Đánh giá sản phẩm

Mã số: DG

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem đánh giá | Tra cứu | Chỉ đánh giá đang hiển thị | DG_BM1 |  |
| 2 | Thêm đánh giá | Lưu trữ | Đã mua và đơn hoàn thành | DG_BM2 | 1-5 sao |
| 3 | Sửa đánh giá | Lưu trữ | Trong phạm vi thời gian/quy định của đồ án |  | Tùy chọn |
| 4 | Xóa/ẩn đánh giá của bản thân | Lưu trữ | Đánh giá thuộc người dùng |  |  |
| 5 | Tính điểm trung bình | Tính toán | AVG(SoSao) của đánh giá hợp lệ |  |  |
| 6 | Báo cáo đánh giá vi phạm | Lưu trữ | Ghi nhận lý do |  | Có thể mở rộng |

DG_BM1 - DANH SÁCH ĐÁNH GIÁ SẢN PHẨM

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã sản phẩm | __________________________ |
| Tên sản phẩm | __________________________ |
| Lọc theo số sao | 1 / 2 / 3 / 4 / 5 / Tất cả |
| Danh sách hiển thị | Người đánh giá \| Số sao \| Nội dung \| Thời gian \| Trạng thái |

DG_BM2 - THÊM/SỬA ĐÁNH GIÁ

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã đơn | __________________________ |
| Mã chi tiết đơn | __________________________ |
| Sản phẩm* | __________________________ |
| Số sao* | 1 / 2 / 3 / 4 / 5 |
| Nội dung nhận xét | __________________________ |
| Hình ảnh đính kèm | __________________________ |
| Ngày đánh giá | ____/____/________ |

#### 2.1.9. Bộ phận/Nhóm: Quản lý gian hàng

Mã số: QLSHOP

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Đăng ký mở shop | Lưu trữ | Người dùng hợp lệ | QLSHOP_BM1 | Một tài khoản theo quy định đồ án |
| 2 | Xem thông tin shop | Tra cứu | Shop thuộc seller |  |  |
| 3 | Cập nhật thông tin shop | Lưu trữ | Tên/mô tả hợp lệ | QLSHOP_BM2 |  |
| 4 | Xem trạng thái shop | Tra cứu | Hoạt động/tạm khóa/khóa |  |  |
| 5 | Xem trang công khai của shop | Kết xuất | Chỉ nội dung được phép hiển thị |  |  |

QLSHOP_BM1 - ĐĂNG KÝ MỞ SHOP

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã người bán* | __________________________ |
| Tên shop* | __________________________ |
| Mô tả shop | __________________________ |
| Logo / Ảnh đại diện | __________________________ |
| Địa chỉ lấy hàng | __________________________ |
| Số điện thoại liên hệ | __________________________ |
| Ngày đăng ký | ____/____/________ |

QLSHOP_BM2 - CẬP NHẬT THÔNG TIN SHOP

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã shop | __________________________ |
| Tên shop* | __________________________ |
| Mô tả | __________________________ |
| Logo / Ảnh đại diện | __________________________ |
| Địa chỉ lấy hàng | __________________________ |
| Số điện thoại liên hệ | __________________________ |
| Trạng thái | __________________________ |

#### 2.1.10. Bộ phận/Nhóm: Quản lý sản phẩm của người bán

Mã số: QLSP

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem danh sách sản phẩm | Tra cứu | Chỉ sản phẩm của shop | QLSP_BM1 |  |
| 2 | Tìm sản phẩm trong shop | Tra cứu | Theo tên/SKU/trạng thái |  |  |
| 3 | Thêm sản phẩm | Lưu trữ | Đủ thông tin bắt buộc | QLSP_BM2 |  |
| 4 | Cập nhật sản phẩm | Lưu trữ | Seller sở hữu sản phẩm |  |  |
| 5 | Ngừng bán sản phẩm | Lưu trữ | Không xóa dữ liệu giao dịch cũ |  | Ưu tiên soft delete/status |
| 6 | Thêm hình ảnh | Lưu trữ | Đúng định dạng/kích thước quy định |  |  |
| 7 | Quản lý biến thể | Lưu trữ | SKU hợp lệ trong shop | QLSP_BM3 |  |
| 8 | Cập nhật giá | Lưu trữ | Giá > 0 |  | Không đổi giá của đơn cũ |
| 9 | Cập nhật tồn kho | Lưu trữ | Tồn kho >= 0 |  |  |
| 10 | Xem sản phẩm sắp hết hàng | Kết xuất | TonKho <= NguongCanhBao |  |  |

QLSP_BM2 - THÊM SẢN PHẨM

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Tên sản phẩm* | __________________________ |
| Danh mục* | __________________________ |
| Mô tả | __________________________ |
| Giá* | __________________________ |
| Phân loại / SKU | __________________________ |
| Số lượng tồn* | __________________________ |
| Hình ảnh | __________________________ |

QLSP_BM1 - DANH SÁCH SẢN PHẨM CỦA SHOP

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã shop | __________________________ |
| Từ khóa / SKU | __________________________ |
| Trạng thái | __________________________ |
| Danh mục | __________________________ |
| Danh sách hiển thị | Mã SP \| Tên SP \| SKU \| Giá \| Tồn kho \| Đã bán \| Trạng thái |

QLSP_BM3 - QUẢN LÝ BIẾN THỂ

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã sản phẩm* | __________________________ |
| Tên biến thể* | __________________________ |
| Giá trị biến thể* | __________________________ |
| SKU* | __________________________ |
| Giá bán* | __________________________ |
| Tồn kho* | __________________________ |
| Trạng thái | __________________________ |

#### 2.1.11. Bộ phận/Nhóm: Người bán xử lý đơn hàng

Mã số: QLDH-B

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem đơn của shop | Tra cứu | Chỉ đơn thuộc shop | QLDH_B_BM1 |  |
| 2 | Lọc đơn theo trạng thái | Tra cứu | Chờ xác nhận/chuẩn bị/đang giao/… |  |  |
| 3 | Xem chi tiết đơn | Tra cứu | Không xem dữ liệu ngoài phạm vi cần thiết |  |  |
| 4 | Xác nhận đơn | Lưu trữ | Đơn đang chờ xác nhận |  |  |
| 5 | Từ chối/hủy đơn | Lưu trữ | Chỉ trạng thái cho phép; ghi lý do |  |  |
| 6 | Chuyển sang chuẩn bị hàng | Lưu trữ | Đơn đã xác nhận |  |  |
| 7 | Bàn giao vận chuyển | Lưu trữ | Đơn đã chuẩn bị |  |  |
| 8 | Cập nhật trạng thái hợp lệ | Lưu trữ | Theo state transition |  | Không nhảy trạng thái tùy ý |
| 9 | In/xem phiếu đơn hàng | Kết xuất | Dữ liệu từ đơn | QLDH_B_BM2 |  |

QLDH_B_BM1 - DANH SÁCH ĐƠN BÁN

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã shop | __________________________ |
| Khoảng thời gian | __________________________ |
| Trạng thái đơn | __________________________ |
| Danh sách hiển thị | Mã đơn \| Người mua \| Ngày đặt \| Tổng tiền \| Thanh toán \| Trạng thái |

QLDH_B_BM2 - PHIẾU XỬ LÝ ĐƠN HÀNG

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã đơn* | __________________________ |
| Shop* | __________________________ |
| Người mua | __________________________ |
| Người nhận | __________________________ |
| Địa chỉ giao | __________________________ |
| Danh sách sản phẩm | __________________________ |
| Trạng thái hiện tại | __________________________ |
| Thao tác xử lý | Xác nhận / Từ chối / Chuẩn bị / Bàn giao vận chuyển |
| Lý do từ chối / hủy | __________________________ |
| Người xử lý | __________________________ |
| Thời gian xử lý | __________________________ |

Mã số: QLKM

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem danh sách voucher | Tra cứu | Theo shop hoặc voucher sàn | QLKM_BM1 |  |
| 2 | Tạo voucher | Lưu trữ | Thời gian và giá trị hợp lệ | QLKM_BM2 | Seller/Admin tùy loại |
| 3 | Cập nhật voucher | Lưu trữ | Chưa vi phạm quy định sử dụng |  |  |
| 4 | Ngừng voucher | Lưu trữ | Không xóa lịch sử voucher đã dùng |  |  |
| 5 | Kiểm tra điều kiện voucher | Tra cứu | Thời gian, số lượng, giá trị đơn |  |  |
| 6 | Tính số tiền giảm | Tính toán | Theo % hoặc số tiền cố định |  | Có mức giảm tối đa |
| 7 | Cập nhật lượt sử dụng | Lưu trữ | Khi đơn dùng voucher được tạo hợp lệ |  |  |

QLKM_BM1 - DANH SÁCH VOUCHER

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Phạm vi | Toàn sàn / Theo shop |
| Shop | __________________________ |
| Trạng thái | __________________________ |
| Danh sách hiển thị | Mã voucher \| Tên chương trình \| Loại giảm \| Giá trị \| Bắt đầu \| Kết thúc \| Lượt còn lại \| Trạng thái |

QLKM_BM2 - TẠO/CẬP NHẬT VOUCHER

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã voucher* | __________________________ |
| Tên chương trình* | __________________________ |
| Phạm vi áp dụng* | Toàn sàn / Theo shop |
| Loại giảm* | Phần trăm / Số tiền cố định |
| Giá trị giảm* | __________________________ |
| Mức giảm tối đa | __________________________ |
| Giá trị đơn tối thiểu | __________________________ |
| Số lượng phát hành* | __________________________ |
| Thời gian bắt đầu* | __________________________ |
| Thời gian kết thúc* | __________________________ |
| Trạng thái | __________________________ |

Mã số: BCTK-B

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Thống kê doanh thu | Kết xuất | Tổng đơn hợp lệ theo thời gian | BCTK_B_BM1 |  |
| 2 | Thống kê số đơn | Kết xuất | Theo trạng thái/khoảng thời gian |  |  |
| 3 | Thống kê sản phẩm bán chạy | Kết xuất | Tổng số lượng bán của đơn hợp lệ |  |  |
| 4 | Thống kê đơn hủy | Kết xuất | Theo khoảng thời gian |  |  |
| 5 | Xem sản phẩm sắp hết hàng | Kết xuất | Theo ngưỡng tồn kho |  |  |

BCTK_B_BM1 - BÁO CÁO KINH DOANH SHOP

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã shop* | __________________________ |
| Khoảng thời gian* | Từ ____/____/____ đến ____/____/____ |
| Tổng số đơn | __________________________ |
| Số đơn hoàn thành | __________________________ |
| Số đơn hủy | __________________________ |
| Doanh thu hợp lệ | __________________________ |
| Sản phẩm bán chạy | __________________________ |
| Sản phẩm sắp hết hàng | __________________________ |

#### 2.1.14. Bộ phận/Nhóm: Admin quản lý người dùng

Mã số: QLND

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem danh sách người dùng | Tra cứu | Admin | QLND_BM1 |  |
| 2 | Tìm kiếm người dùng | Tra cứu | Theo tên/email/mã |  |  |
| 3 | Xem chi tiết tài khoản | Tra cứu | Theo quyền quản trị |  | Không hiển thị mật khẩu |
| 4 | Khóa tài khoản | Lưu trữ | Ghi lý do | QLND_BM2 |  |
| 5 | Mở khóa tài khoản | Lưu trữ | Admin có quyền |  |  |
| 6 | Xem lịch sử xử lý | Tra cứu | Theo tài khoản |  |  |

QLND_BM1 - DANH SÁCH NGƯỜI DÙNG

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Từ khóa | __________________________ |
| Vai trò | Buyer / Seller / Admin / Tất cả |
| Trạng thái | Hoạt động / Khóa / Tất cả |
| Danh sách hiển thị | Mã người dùng \| Họ tên \| Email \| Vai trò \| Trạng thái \| Ngày tạo |

QLND_BM2 - XỬ LÝ TÀI KHOẢN

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã người dùng* | __________________________ |
| Họ tên | __________________________ |
| Email | __________________________ |
| Trạng thái hiện tại | __________________________ |
| Hành động* | Khóa / Mở khóa |
| Lý do xử lý* | __________________________ |
| Admin thực hiện* | __________________________ |
| Thời gian xử lý* | __________________________ |

#### 2.1.15. Bộ phận/Nhóm: Admin quản lý shop

Mã số: QLS-A

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem danh sách shop | Tra cứu | Admin | QLS_A_BM1 |  |
| 2 | Tìm kiếm shop | Tra cứu | Theo tên/chủ shop/trạng thái |  |  |
| 3 | Xem chi tiết shop | Tra cứu | Admin |  |  |
| 4 | Khóa shop | Lưu trữ | Có lý do xử lý |  | Sản phẩm shop không tiếp tục bán |
| 5 | Mở khóa shop | Lưu trữ | Sau khi đủ điều kiện |  |  |
| 6 | Xem lịch sử vi phạm | Tra cứu | Theo shop |  |  |

QLS_A_BM1 - DANH SÁCH/QUẢN LÝ SHOP

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Từ khóa | __________________________ |
| Chủ shop | __________________________ |
| Trạng thái | __________________________ |
| Danh sách hiển thị | Mã shop \| Tên shop \| Chủ shop \| Số sản phẩm \| Trạng thái \| Ngày tạo |
| Hành động quản trị | Xem / Khóa / Mở khóa |
| Lý do xử lý | __________________________ |

#### 2.1.16. Bộ phận/Nhóm: Admin quản lý danh mục

Mã số: QLDM

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem danh mục | Tra cứu | Hiển thị cấu trúc cha-con | QLDM_BM1 |  |
| 2 | Thêm danh mục | Lưu trữ | Tên hợp lệ, tránh trùng trong cùng cấp | QLDM_BM2 |  |
| 3 | Sửa danh mục | Lưu trữ | Không làm hỏng quan hệ cây |  |  |
| 4 | Ngừng danh mục | Lưu trữ | Xử lý sản phẩm đang thuộc danh mục |  | Ưu tiên trạng thái |
| 5 | Tìm danh mục | Tra cứu | Theo tên/mã |  |  |

QLDM_BM1 - DANH SÁCH DANH MỤC

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Từ khóa | __________________________ |
| Danh mục cha | __________________________ |
| Trạng thái | __________________________ |
| Danh sách hiển thị | Mã danh mục \| Tên danh mục \| Danh mục cha \| Số sản phẩm \| Trạng thái |

QLDM_BM2 - THÊM/CẬP NHẬT DANH MỤC

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã danh mục | __________________________ |
| Tên danh mục* | __________________________ |
| Danh mục cha | __________________________ |
| Mô tả | __________________________ |
| Trạng thái* | Hoạt động / Ngừng hoạt động |

#### 2.1.17. Bộ phận/Nhóm: Admin kiểm duyệt sản phẩm và nội dung

Mã số: KDSP

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem sản phẩm trên sàn | Tra cứu | Theo trạng thái/shop/danh mục | KDSP_BM1 |  |
| 2 | Xem chi tiết sản phẩm | Tra cứu | Admin |  |  |
| 3 | Ẩn sản phẩm vi phạm | Lưu trữ | Ghi lý do | KDSP_BM2 | Không xóa lịch sử đơn |
| 4 | Khôi phục sản phẩm | Lưu trữ | Đã xử lý vi phạm |  |  |
| 5 | Xem đánh giá bị báo cáo | Tra cứu | Admin |  |  |
| 6 | Ẩn đánh giá vi phạm | Lưu trữ | Ghi lý do |  |  |

KDSP_BM1 - DANH SÁCH SẢN PHẨM KIỂM DUYỆT

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Từ khóa | __________________________ |
| Shop | __________________________ |
| Danh mục | __________________________ |
| Trạng thái | __________________________ |
| Danh sách hiển thị | Mã SP \| Tên SP \| Shop \| Danh mục \| Trạng thái \| Số báo cáo |

KDSP_BM2 - PHIẾU XỬ LÝ VI PHẠM

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Loại đối tượng* | Sản phẩm / Đánh giá |
| Mã đối tượng* | __________________________ |
| Shop / Người dùng liên quan | __________________________ |
| Nội dung vi phạm | __________________________ |
| Hành động* | Ẩn / Khôi phục / Cảnh báo |
| Lý do xử lý* | __________________________ |
| Admin thực hiện* | __________________________ |
| Thời gian xử lý* | __________________________ |

#### 2.1.18. Bộ phận/Nhóm: Admin quản lý đơn hàng

Mã số: QLDH-A

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Xem toàn bộ đơn hàng | Tra cứu | Admin | QLDH_A_BM1 |  |
| 2 | Tìm đơn theo mã | Tra cứu | Mã đơn chính xác |  |  |
| 3 | Lọc đơn | Tra cứu | Theo trạng thái/shop/buyer/thời gian |  |  |
| 4 | Xem lịch sử trạng thái | Tra cứu | Không chỉnh sửa lịch sử |  |  |
| 5 | Can thiệp trạng thái đặc biệt | Lưu trữ | Chỉ quyền Admin và phải ghi lý do |  | Hạn chế sử dụng |
| 6 | Xem thanh toán | Tra cứu | Theo đơn |  |  |
| 7 | Xem vận chuyển | Tra cứu | Theo đơn |  |  |

QLDH_A_BM1 - DANH SÁCH/CHI TIẾT ĐƠN TOÀN HỆ THỐNG

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Mã đơn | __________________________ |
| Buyer | __________________________ |
| Shop | __________________________ |
| Khoảng thời gian | __________________________ |
| Trạng thái | __________________________ |
| Danh sách hiển thị | Mã đơn \| Buyer \| Shop \| Ngày đặt \| Tổng tiền \| Thanh toán \| Vận chuyển \| Trạng thái |
| Lý do can thiệp đặc biệt | __________________________ |
| Admin thực hiện | __________________________ |

Mã số: BCTK-A

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Thống kê số người dùng | Kết xuất | Theo thời gian/trạng thái | BCTK_A_BM1 |  |
| 2 | Thống kê số shop | Kết xuất | Theo trạng thái |  |  |
| 3 | Thống kê số sản phẩm | Kết xuất | Theo danh mục/trạng thái |  |  |
| 4 | Thống kê số đơn | Kết xuất | Theo thời gian/trạng thái |  |  |
| 5 | Thống kê giá trị giao dịch | Kết xuất | Chỉ đơn hợp lệ |  |  |
| 6 | Thống kê shop theo doanh thu | Kết xuất | Tổng giá trị đơn hợp lệ |  |  |
| 7 | Thống kê sản phẩm bán chạy | Kết xuất | Tổng số lượng bán |  |  |
| 8 | Thống kê vi phạm | Kết xuất | Theo loại đối tượng/thời gian |  |  |

BCTK_A_BM1 - BÁO CÁO TOÀN HỆ THỐNG

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Khoảng thời gian* | Từ ____/____/____ đến ____/____/____ |
| Tổng người dùng | __________________________ |
| Tổng shop | __________________________ |
| Tổng sản phẩm | __________________________ |
| Tổng đơn hàng | __________________________ |
| Tổng giá trị giao dịch hợp lệ | __________________________ |
| Số đơn theo trạng thái | __________________________ |
| Top shop theo doanh thu | __________________________ |
| Top sản phẩm bán chạy | __________________________ |
| Số trường hợp vi phạm | __________________________ |

#### 2.1.20. Bộ phận/Nhóm: Thông báo

Mã số: TB

| STT | Công việc | Loại công việc | Quy định/Công thức liên quan | Biểu mẫu liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Tạo thông báo đơn mới | Lưu trữ | Gửi seller liên quan |  | Tự động |
| 2 | Tạo thông báo thay đổi trạng thái | Lưu trữ | Gửi buyer/seller phù hợp |  | Tự động |
| 3 | Tạo thông báo xử lý vi phạm | Lưu trữ | Gửi tài khoản/shop liên quan |  |  |
| 4 | Xem danh sách thông báo | Tra cứu | Theo người nhận | TB_BM1 |  |
| 5 | Đánh dấu đã đọc | Lưu trữ | Người nhận sở hữu thông báo |  |  |
| 6 | Đếm thông báo chưa đọc | Tính toán | COUNT(thông báo chưa đọc) |  |  |

TB_BM1 - DANH SÁCH THÔNG BÁO

| Tên trường | Giá trị điền / Định dạng |
| --- | --- |
| Người nhận | __________________________ |
| Loại thông báo | Đơn hàng / Thanh toán / Vận chuyển / Vi phạm / Hệ thống |
| Trạng thái | Đã đọc / Chưa đọc / Tất cả |
| Danh sách hiển thị | Tiêu đề \| Nội dung \| Loại \| Thời gian \| Trạng thái đọc |

### 2.2. Danh sách quy định nghiệp vụ

| Mã | Quy định |
| --- | --- |
| QD01 | Email/tên đăng nhập phải duy nhất trong hệ thống. |
| QD02 | Mật khẩu không lưu dạng văn bản thuần. |
| QD03 | Tài khoản bị khóa không được thực hiện nghiệp vụ cần đăng nhập. |
| QD04 | Người bán chỉ quản lý shop và sản phẩm thuộc quyền sở hữu của mình. |
| QD05 | Giá sản phẩm phải lớn hơn 0. |
| QD06 | Tồn kho không được nhỏ hơn 0. |
| QD07 | Số lượng đặt mua không được vượt tồn kho tại thời điểm xác nhận đơn. |
| QD08 | Giá trong đơn hàng là giá được chốt tại thời điểm đặt, không tự đổi khi seller đổi giá sau đó. |
| QD09 | Voucher chỉ áp dụng khi còn hiệu lực, còn lượt và đạt giá trị đơn tối thiểu. |
| QD10 | Tổng tiền thanh toán không được âm. |
| QD11 | Chỉ được chuyển trạng thái đơn theo luồng trạng thái đã quy định. |
| QD12 | Buyer chỉ được hủy đơn khi đơn đang ở trạng thái cho phép. |
| QD13 | Seller chỉ được xử lý các đơn thuộc shop của mình. |
| QD14 | Chỉ người đã mua sản phẩm trong đơn hoàn thành mới được đánh giá. |
| QD15 | Điểm đánh giá từ 1 đến 5 sao. |
| QD16 | Sản phẩm/shop có lịch sử giao dịch không xóa vật lý tùy tiện; ưu tiên đổi trạng thái. |
| QD17 | Admin khi khóa tài khoản/shop/sản phẩm phải lưu lý do. |
| QD18 | Không lưu thông tin thẻ ngân hàng thật trong hệ thống đồ án. |
| QD19 | Dữ liệu thống kê doanh thu chỉ tính các đơn được xác định là hợp lệ/hoàn thành. |
| QD20 | Các thao tác quản trị quan trọng cần được ghi nhật ký. |

### 2.3. Danh sách yêu cầu chức năng hệ thống

| STT | Nội dung | Mô tả chi tiết | Ghi chú |
| --- | --- | --- | --- |
| 1 | Xác thực | Hệ thống hỗ trợ đăng ký, đăng nhập, đăng xuất và quản lý phiên |  |
| 2 | Phân quyền | Guest, Buyer, Seller, Admin có quyền khác nhau | Bắt buộc |
| 3 | Buyer | Xem/tìm sản phẩm, giỏ hàng, đặt hàng, thanh toán, theo dõi đơn, đánh giá |  |
| 4 | Seller | Quản lý shop, sản phẩm, tồn kho, voucher, đơn hàng, thống kê shop |  |
| 5 | Admin | Quản lý người dùng, shop, danh mục, sản phẩm, đơn, nội dung, báo cáo |  |
| 6 | Kiểm soát sở hữu dữ liệu | Seller không truy cập dữ liệu quản trị của shop khác; Buyer không xem đơn người khác | Bắt buộc |
| 7 | Quản lý trạng thái | Đơn hàng, thanh toán, vận chuyển, sản phẩm, shop và tài khoản đều có trạng thái |  |
| 8 | Tìm kiếm và lọc | Hỗ trợ tìm kiếm sản phẩm và dữ liệu quản trị theo tiêu chí |  |
| 9 | Kiểm tra dữ liệu | Kiểm tra dữ liệu đầu vào cả phía giao diện và phía server |  |
| 10 | Ghi lịch sử đơn | Lưu lại các lần thay đổi trạng thái đơn |  |
| 11 | Thông báo | Tạo thông báo cho các sự kiện nghiệp vụ quan trọng | MVP |
| 12 | Nhật ký quản trị | Lưu hành động quản trị quan trọng | Khuyến nghị |
| 13 | Thanh toán mô phỏng | Cho phép COD và luồng online giả lập | Không dùng tiền thật |
| 14 | Báo cáo | Tổng hợp dữ liệu theo quyền Buyer/Seller/Admin phù hợp |  |

#### 2.3.1. Ma trận phân quyền

| Chức năng | Guest | Buyer | Seller | Admin |
| --- | --- | --- | --- | --- |
| Xem/tìm sản phẩm | ✓ | ✓ | ✓ | ✓ |
| Đăng ký/đăng nhập | ✓ | ✓ | ✓ | ✓ |
| Quản lý hồ sơ cá nhân |  | ✓ | ✓ | ✓ |
| Giỏ hàng |  | ✓ |  |  |
| Đặt hàng |  | ✓ |  |  |
| Xem đơn mua |  | ✓ |  | ✓ |
| Đánh giá sản phẩm |  | ✓ |  | ✓/kiểm duyệt |
| Tạo/quản lý shop |  |  | ✓ | ✓/kiểm soát |
| Quản lý sản phẩm shop |  |  | ✓ | ✓/kiểm duyệt |
| Xử lý đơn bán |  |  | ✓ | ✓ |
| Voucher shop |  |  | ✓ | ✓ |
| Thống kê shop |  |  | ✓ | ✓ |
| Quản lý danh mục toàn sàn |  |  |  | ✓ |
| Quản lý người dùng |  |  |  | ✓ |
| Khóa shop/sản phẩm |  |  |  | ✓ |
| Báo cáo toàn hệ thống |  |  |  | ✓ |

### 2.4. Danh sách yêu cầu phi chức năng

| STT | Nội dung | Tiêu chuẩn | Mô tả chi tiết | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | Giao diện dễ sử dụng | Tiện dụng | Bố cục nhất quán, thao tác mua hàng rõ ràng, phù hợp người dùng phổ thông | Responsive |
| 2 | Tốc độ tải trang | Hiệu quả | Các trang thông thường nên phản hồi nhanh trong điều kiện thử nghiệm | Mục tiêu < 3 giây với dữ liệu đồ án |
| 3 | Tìm kiếm | Hiệu quả | Kết quả tìm kiếm phải trả về trong thời gian chấp nhận được | Mục tiêu < 3 giây |
| 4 | Tạo đơn | Hiệu quả | Không để người dùng chờ quá lâu và không tạo trùng đơn do bấm nhiều lần | Cần chống duplicate request |
| 5 | Bảo mật mật khẩu | An toàn | Mật khẩu phải được băm bằng thuật toán phù hợp | Không lưu plaintext |
| 6 | Phân quyền API | An toàn | Server kiểm tra quyền, không chỉ ẩn nút trên giao diện | Bắt buộc |
| 7 | Bảo vệ dữ liệu | An toàn | Buyer/Seller không truy cập dữ liệu không thuộc quyền | Bắt buộc |
| 8 | Kiểm tra đầu vào | An toàn | Validate dữ liệu trước khi ghi CSDL | Client + Server |
| 9 | Nhất quán dữ liệu đơn | Tin cậy | Tạo đơn, chi tiết đơn và cập nhật tồn kho phải đảm bảo nhất quán | Nên dùng transaction |
| 10 | Khả năng phục hồi | Tin cậy | Lỗi thanh toán mô phỏng hoặc lỗi hệ thống không được làm mất dữ liệu đơn hợp lệ |  |
| 11 | Khả năng mở rộng | Tiến hóa | Thiết kế module để có thể bổ sung chat, yêu thích, hoàn trả, payment gateway thật |  |
| 12 | Tương thích | Tương thích | Hoạt động tốt trên các trình duyệt hiện đại | Chrome/Edge/Firefox |
| 13 | Responsive | Tương thích | Giao diện sử dụng được trên desktop, tablet và mobile |  |
| 14 | Dễ bảo trì | Bảo trì | Tách module theo nghiệp vụ, quy ước code thống nhất |  |
| 15 | Nhật ký lỗi | Bảo trì | Backend ghi log các lỗi quan trọng | Không log mật khẩu/token |
| 16 | Sao lưu dữ liệu | Tin cậy | Có phương án backup CSDL trong môi trường triển khai | Theo khả năng đồ án |
| 17 | Khả năng kiểm thử | Bảo trì | Các nghiệp vụ chính có thể kiểm thử độc lập | Ưu tiên auth/cart/order |
| 18 | Tính toàn vẹn | Tin cậy | Không cho tồn kho âm, đơn sai tổng tiền hoặc trạng thái bất hợp lệ | Bắt buộc |

## 3. DANH SÁCH CÁC TÁC NHÂN VÀ CHỨC NĂNG CỦA PHẦN MỀM

Phần này nhận diện các tác nhân tham gia hệ thống và mô tả các chức năng mà từng tác nhân được phép thực hiện. Danh sách được tổng hợp từ các yêu cầu chức năng và ma trận phân quyền đã xác định ở Phần 2.

### 3.1. Nhận diện tác nhân và chức năng

| Tác nhân | Chức năng chính |
| --- | --- |
| Khách (Guest) | Xem danh sách sản phẩm; xem theo danh mục; tìm kiếm, lọc và sắp xếp sản phẩm; xem chi tiết sản phẩm; xem thông tin shop; xem đánh giá; đăng ký tài khoản; đăng nhập. |
| Người mua (Buyer) | Quản lý hồ sơ và địa chỉ nhận hàng; quản lý giỏ hàng; checkout; chọn voucher; chọn phương thức thanh toán; tạo đơn; xem và theo dõi đơn; hủy đơn khi hợp lệ; xác nhận đã nhận hàng; mua lại; đánh giá sản phẩm; xem thông báo. |
| Người bán (Seller) | Đăng ký và quản lý gian hàng; quản lý sản phẩm, hình ảnh, biến thể, giá và tồn kho; quản lý voucher của shop; tiếp nhận và xử lý đơn; chuẩn bị hàng và bàn giao vận chuyển; theo dõi trạng thái giao hàng; xem đánh giá; xem báo cáo kinh doanh và cảnh báo tồn kho. |
| Quản trị viên (Admin) | Quản lý người dùng; quản lý shop; quản lý danh mục; kiểm duyệt sản phẩm và nội dung; quản lý đơn hàng toàn hệ thống; quản lý voucher toàn sàn; xử lý vi phạm; quản lý thông báo; xem báo cáo thống kê và nhật ký quản trị. |

> **Bảng 3.. Danh sách tác nhân và chức năng chính**

### 3.2. Mô tả chi tiết từng tác nhân

| Tên tác nhân | Công việc / Vai trò |
| --- | --- |
| Khách (Guest) | Người chưa đăng nhập vào hệ thống. Khách được phép tra cứu nội dung công khai như sản phẩm, danh mục, shop và đánh giá; đồng thời có thể đăng ký hoặc đăng nhập để sử dụng các chức năng mua hàng. |
| Người mua (Buyer) | Người dùng đã có tài khoản và đăng nhập với vai trò mua hàng. Người mua quản lý thông tin cá nhân, giỏ hàng, địa chỉ, đặt hàng, thanh toán, theo dõi đơn, đánh giá sản phẩm và nhận thông báo liên quan đến giao dịch của mình. |
| Người bán (Seller) | Người dùng có gian hàng trên hệ thống. Người bán chịu trách nhiệm quản lý dữ liệu thuộc shop của mình, bao gồm sản phẩm, biến thể, tồn kho, voucher và đơn hàng; đồng thời sử dụng các chức năng thống kê để theo dõi hoạt động kinh doanh. |
| Quản trị viên (Admin) | Tác nhân có quyền quản trị toàn hệ thống. Admin quản lý tài khoản, shop, danh mục, sản phẩm, đơn hàng, nội dung vi phạm, voucher toàn sàn và báo cáo; các thao tác quản trị quan trọng phải tuân theo quyền hạn và quy định nghiệp vụ. |

> **Bảng 3.. Mô tả vai trò của các tác nhân**

### 3.3. Mô tả chi tiết các chức năng

#### 3.3.1. Chức năng chung và tài khoản

| STT | Chức năng | Mô tả |
| --- | --- | --- |
| 1 | Đăng ký tài khoản | Cho phép khách tạo tài khoản người mua với thông tin hợp lệ; email hoặc tên đăng nhập không được trùng. |
| 2 | Đăng nhập | Xác thực thông tin đăng nhập và trạng thái tài khoản trước khi cấp quyền truy cập. |
| 3 | Đăng xuất | Kết thúc phiên đăng nhập hiện tại của người dùng. |
| 4 | Xem hồ sơ | Cho phép người dùng đã đăng nhập xem thông tin hồ sơ của chính mình. |
| 5 | Cập nhật hồ sơ | Cho phép cập nhật họ tên, số điện thoại, ảnh đại diện và các thông tin được phép thay đổi. |
| 6 | Đổi mật khẩu | Cho phép thay đổi mật khẩu sau khi đáp ứng cơ chế xác nhận theo quy định. |
| 7 | Quản lý địa chỉ nhận hàng | Cho phép người mua thêm, sửa, xóa và chọn địa chỉ nhận hàng mặc định. |
| 8 | Xem và đánh dấu thông báo | Cho phép người dùng xem thông báo thuộc tài khoản của mình và đánh dấu trạng thái đã đọc. |

#### 3.3.2. Chức năng tra cứu và xem sản phẩm

| STT | Chức năng | Mô tả |
| --- | --- | --- |
| 1 | Xem danh sách sản phẩm | Hiển thị các sản phẩm đang được phép bán trên hệ thống. |
| 2 | Xem sản phẩm theo danh mục | Hiển thị sản phẩm thuộc danh mục đang hoạt động. |
| 3 | Tìm kiếm sản phẩm | Tìm sản phẩm theo từ khóa tên sản phẩm. |
| 4 | Lọc sản phẩm | Lọc theo khoảng giá, danh mục, shop, đánh giá hoặc tình trạng còn hàng. |
| 5 | Sắp xếp sản phẩm | Sắp xếp kết quả theo giá, thời gian cập nhật hoặc mức độ bán chạy. |
| 6 | Xem chi tiết sản phẩm | Hiển thị thông tin giá, tồn kho, mô tả, hình ảnh và biến thể của sản phẩm. |
| 7 | Xem thông tin shop | Hiển thị thông tin công khai của shop đang hoạt động. |
| 8 | Xem đánh giá sản phẩm | Hiển thị các đánh giá hợp lệ của sản phẩm. |

#### 3.3.3. Chức năng mua hàng

| STT | Chức năng | Mô tả |
| --- | --- | --- |
| 1 | Xem giỏ hàng | Hiển thị các dòng sản phẩm đã thêm vào giỏ của người mua. |
| 2 | Thêm sản phẩm vào giỏ | Thêm sản phẩm hoặc biến thể còn hoạt động vào giỏ với số lượng không vượt tồn kho. |
| 3 | Cập nhật giỏ hàng | Thay đổi số lượng, xóa dòng hàng và chọn các dòng cần thanh toán. |
| 4 | Kiểm tra giỏ trước checkout | Kiểm tra lại giá, tồn kho và trạng thái sản phẩm trước khi tạo đơn. |
| 5 | Checkout | Chọn địa chỉ, voucher, phương thức thanh toán và tính tổng thanh toán. |
| 6 | Áp dụng voucher | Kiểm tra thời gian hiệu lực, số lượt sử dụng và điều kiện giá trị đơn trước khi giảm giá. |
| 7 | Tạo đơn hàng | Tạo đơn từ dữ liệu checkout hợp lệ, lưu chi tiết đơn và cập nhật tồn kho tương ứng. |
| 8 | Thanh toán | Hỗ trợ COD hoặc thanh toán trực tuyến mô phỏng; ghi nhận trạng thái giao dịch. |
| 9 | Theo dõi đơn hàng | Cho phép người mua xem danh sách đơn, chi tiết đơn và lịch sử trạng thái. |
| 10 | Hủy đơn | Cho phép hủy đơn trong các trạng thái được quy định và lưu lý do hủy. |
| 11 | Xác nhận đã nhận hàng | Cho phép người mua xác nhận nhận hàng khi đơn đã ở trạng thái giao phù hợp. |
| 12 | Mua lại | Đưa lại các sản phẩm còn hợp lệ từ đơn cũ vào giỏ hàng. |
| 13 | Đánh giá sản phẩm | Cho phép người đã mua và có đơn hoàn thành đánh giá sản phẩm theo số sao và nội dung nhận xét. |

#### 3.3.4. Chức năng của Người bán

| STT | Chức năng | Mô tả |
| --- | --- | --- |
| 1 | Đăng ký mở shop | Tạo gian hàng cho người dùng hợp lệ theo quy định của đồ án. |
| 2 | Cập nhật thông tin shop | Cho phép seller chỉnh sửa tên shop, mô tả, logo, địa chỉ lấy hàng và thông tin liên hệ. |
| 3 | Quản lý sản phẩm | Xem, tìm, thêm, cập nhật và ngừng bán sản phẩm thuộc shop của mình. |
| 4 | Quản lý hình ảnh sản phẩm | Thêm hoặc cập nhật hình ảnh đúng định dạng và quy định hệ thống. |
| 5 | Quản lý biến thể | Thêm và cập nhật biến thể, SKU, giá bán, tồn kho và trạng thái. |
| 6 | Cập nhật giá và tồn kho | Điều chỉnh giá và số lượng tồn cho sản phẩm/biến thể; không làm thay đổi dữ liệu đơn đã phát sinh. |
| 7 | Xem sản phẩm sắp hết hàng | Kết xuất danh sách sản phẩm có tồn kho nhỏ hơn hoặc bằng ngưỡng cảnh báo. |
| 8 | Quản lý voucher shop | Tạo, cập nhật, ngừng voucher và theo dõi điều kiện sử dụng trong phạm vi shop. |
| 9 | Xử lý đơn bán | Xem đơn của shop, xác nhận, từ chối/hủy khi được phép và chuyển trạng thái theo đúng luồng. |
| 10 | Chuẩn bị và bàn giao vận chuyển | Chuyển đơn sang trạng thái chuẩn bị và bàn giao cho đơn vị vận chuyển mô phỏng. |
| 11 | Xem báo cáo kinh doanh | Theo dõi doanh thu, số đơn, đơn hủy, sản phẩm bán chạy và tồn kho theo khoảng thời gian. |

#### 3.3.5. Chức năng quản trị

| STT | Chức năng | Mô tả |
| --- | --- | --- |
| 1 | Quản lý người dùng | Xem, tìm kiếm, khóa/mở khóa và xử lý trạng thái tài khoản theo quyền Admin. |
| 2 | Quản lý shop | Xem, tìm kiếm và cập nhật trạng thái shop; xử lý shop vi phạm khi cần. |
| 3 | Quản lý danh mục | Thêm, cập nhật, sắp xếp cấu trúc cha-con và ngừng hoạt động danh mục. |
| 4 | Kiểm duyệt sản phẩm và nội dung | Theo dõi sản phẩm, đánh giá và nội dung vi phạm; thực hiện ẩn hoặc xử lý theo quy định. |
| 5 | Quản lý đơn hàng toàn hệ thống | Tra cứu đơn theo mã, trạng thái, shop, buyer hoặc khoảng thời gian; hỗ trợ kiểm tra khi có vấn đề. |
| 6 | Quản lý voucher toàn sàn | Tạo và quản lý voucher có phạm vi áp dụng toàn hệ thống. |
| 7 | Quản lý thông báo | Theo dõi hoặc tạo các thông báo hệ thống cần thiết cho đúng đối tượng. |
| 8 | Báo cáo và thống kê quản trị | Thống kê người dùng, shop, sản phẩm, đơn hàng, giao dịch hợp lệ và các chỉ số vận hành toàn hệ thống. |
| 9 | Nhật ký quản trị | Ghi nhận các thao tác quản trị quan trọng để phục vụ kiểm tra và truy vết. |

### 3.4. Đặc tả các Use Case chính

Các Use Case dưới đây mô tả những luồng nghiệp vụ tiêu biểu và có ảnh hưởng trực tiếp đến quá trình mua bán, quản lý sản phẩm và quản trị hệ thống.

#### 3.4.1. Use Case Đăng ký tài khoản

| Mô tả | Cho phép khách tạo tài khoản người mua. |
| --- | --- |
| Tác nhân | Khách |
| Tiền điều kiện | Khách chưa đăng nhập; email/tên đăng nhập chưa tồn tại. |
| Hậu điều kiện | Tài khoản được tạo và có thể sử dụng để đăng nhập. |
| Luồng chính | 1. Khách mở chức năng đăng ký. 2. Nhập các thông tin bắt buộc. 3. Hệ thống kiểm tra định dạng và tính duy nhất. 4. Khách xác nhận đăng ký. 5. Hệ thống lưu tài khoản và thông báo kết quả. |
| Ngoại lệ / Luồng thay thế | Dữ liệu không hợp lệ hoặc email/tên đăng nhập đã tồn tại thì hệ thống yêu cầu nhập lại. |

#### 3.4.2. Use Case Đăng nhập

| Mô tả | Xác thực người dùng và cấp quyền theo vai trò. |
| --- | --- |
| Tác nhân | Buyer / Seller / Admin |
| Tiền điều kiện | Người dùng có tài khoản hợp lệ. |
| Hậu điều kiện | Phiên đăng nhập được tạo và giao diện hiển thị theo quyền. |
| Luồng chính | 1. Người dùng mở màn hình đăng nhập. 2. Nhập email/tên đăng nhập và mật khẩu. 3. Hệ thống kiểm tra thông tin xác thực và trạng thái tài khoản. 4. Nếu hợp lệ, hệ thống tạo phiên và chuyển đến giao diện tương ứng. |
| Ngoại lệ / Luồng thay thế | Sai thông tin hoặc tài khoản bị khóa thì từ chối đăng nhập và hiển thị thông báo. |

#### 3.4.3. Use Case Tìm kiếm sản phẩm

| Mô tả | Tìm sản phẩm theo từ khóa và điều kiện lọc. |
| --- | --- |
| Tác nhân | Guest / Buyer / Seller / Admin |
| Tiền điều kiện | Hệ thống có dữ liệu sản phẩm. |
| Hậu điều kiện | Danh sách sản phẩm phù hợp được hiển thị. |
| Luồng chính | 1. Tác nhân nhập từ khóa hoặc chọn bộ lọc. 2. Hệ thống truy vấn các sản phẩm được phép hiển thị. 3. Hệ thống sắp xếp và trả về danh sách kết quả. 4. Tác nhân chọn một sản phẩm để xem chi tiết nếu cần. |
| Ngoại lệ / Luồng thay thế | Không có kết quả thì hiển thị trạng thái không tìm thấy sản phẩm phù hợp. |

#### 3.4.4. Use Case Thêm sản phẩm vào giỏ hàng

| Mô tả | Lưu sản phẩm/biến thể người mua muốn mua vào giỏ. |
| --- | --- |
| Tác nhân | Buyer |
| Tiền điều kiện | Người mua đã đăng nhập; sản phẩm/biến thể còn hoạt động và còn tồn. |
| Hậu điều kiện | Dòng hàng được thêm hoặc cập nhật trong giỏ. |
| Luồng chính | 1. Người mua chọn sản phẩm, biến thể và số lượng. 2. Nhấn thêm vào giỏ. 3. Hệ thống kiểm tra trạng thái và tồn kho. 4. Hệ thống thêm dòng hàng hoặc tăng số lượng tương ứng. |
| Ngoại lệ / Luồng thay thế | Nếu vượt tồn kho hoặc sản phẩm ngừng bán thì hệ thống từ chối thao tác. |

#### 3.4.5. Use Case Checkout

| Mô tả | Tổng hợp dữ liệu cần thiết trước khi tạo đơn. |
| --- | --- |
| Tác nhân | Buyer |
| Tiền điều kiện | Giỏ hàng có ít nhất một dòng được chọn và hợp lệ. |
| Hậu điều kiện | Thông tin checkout được xác nhận sẵn sàng để tạo đơn. |
| Luồng chính | 1. Hệ thống kiểm tra lại giá, tồn kho và trạng thái. 2. Người mua chọn địa chỉ nhận hàng. 3. Người mua chọn voucher nếu có. 4. Người mua chọn phương thức thanh toán. 5. Hệ thống tính tiền hàng, phí vận chuyển, giảm giá và tổng thanh toán. 6. Người mua xác nhận thông tin. |
| Ngoại lệ / Luồng thay thế | Nếu sản phẩm thay đổi giá, hết hàng hoặc voucher không còn hợp lệ thì hệ thống cập nhật và yêu cầu xác nhận lại. |

#### 3.4.6. Use Case Áp dụng voucher

| Mô tả | Tính số tiền giảm cho đơn hàng theo voucher hợp lệ. |
| --- | --- |
| Tác nhân | Buyer |
| Tiền điều kiện | Voucher tồn tại; đơn hàng đang ở bước checkout. |
| Hậu điều kiện | Số tiền giảm hợp lệ được áp dụng vào tổng thanh toán. |
| Luồng chính | 1. Người mua chọn hoặc nhập voucher. 2. Hệ thống kiểm tra thời gian hiệu lực, số lượt, phạm vi và giá trị đơn tối thiểu. 3. Hệ thống tính mức giảm theo loại voucher và mức giảm tối đa. 4. Tổng thanh toán được cập nhật. |
| Ngoại lệ / Luồng thay thế | Voucher hết hạn, hết lượt hoặc không đạt điều kiện thì không được áp dụng. |

#### 3.4.7. Use Case Tạo đơn hàng

| Mô tả | Ghi nhận giao dịch mua hàng từ dữ liệu checkout hợp lệ. |
| --- | --- |
| Tác nhân | Buyer |
| Tiền điều kiện | Checkout hợp lệ; tồn kho đủ. |
| Hậu điều kiện | Đơn và chi tiết đơn được tạo; tồn kho được cập nhật; thông báo đơn mới được sinh ra. |
| Luồng chính | 1. Người mua xác nhận đặt hàng. 2. Hệ thống kiểm tra tồn kho lần cuối. 3. Hệ thống tạo đơn theo shop nếu cần. 4. Hệ thống lưu chi tiết đơn với giá tại thời điểm mua. 5. Hệ thống trừ/giữ tồn kho tương ứng. 6. Hệ thống tạo thông báo cho buyer và seller. |
| Ngoại lệ / Luồng thay thế | Nếu tồn kho không đủ hoặc dữ liệu thay đổi trước khi tạo đơn thì giao dịch bị dừng và yêu cầu người mua cập nhật giỏ. |

#### 3.4.8. Use Case Thanh toán

| Mô tả | Ghi nhận hình thức và trạng thái thanh toán của đơn. |
| --- | --- |
| Tác nhân | Buyer |
| Tiền điều kiện | Đơn hàng đã được tạo và có số tiền cần thanh toán. |
| Hậu điều kiện | Trạng thái thanh toán được lưu theo kết quả thực hiện. |
| Luồng chính | 1. Người mua chọn COD hoặc online mô phỏng. 2. Hệ thống tạo thông tin thanh toán gắn với đơn. 3. Với online mô phỏng, hệ thống giả lập kết quả giao dịch. 4. Hệ thống ghi nhận thành công hoặc thất bại. |
| Ngoại lệ / Luồng thay thế | Nếu số tiền giao dịch không khớp tổng thanh toán hoặc giao dịch thất bại thì không ghi nhận thanh toán thành công. |

#### 3.4.9. Use Case Hủy đơn hàng

| Mô tả | Cho phép hủy đơn trong trạng thái còn được phép. |
| --- | --- |
| Tác nhân | Buyer / Seller |
| Tiền điều kiện | Đơn thuộc phạm vi của tác nhân và đang ở trạng thái cho phép hủy. |
| Hậu điều kiện | Đơn chuyển sang trạng thái hủy và lưu lý do. |
| Luồng chính | 1. Tác nhân mở chi tiết đơn. 2. Chọn chức năng hủy/từ chối. 3. Nhập lý do nếu được yêu cầu. 4. Hệ thống kiểm tra trạng thái hiện tại. 5. Hệ thống cập nhật trạng thái và lưu lịch sử. |
| Ngoại lệ / Luồng thay thế | Nếu đơn đã qua trạng thái cho phép hủy thì hệ thống từ chối thao tác. |

#### 3.4.10. Use Case Đánh giá sản phẩm

| Mô tả | Ghi nhận nhận xét của người mua sau giao dịch. |
| --- | --- |
| Tác nhân | Buyer |
| Tiền điều kiện | Người mua đã mua sản phẩm và đơn tương ứng đã hoàn thành. |
| Hậu điều kiện | Đánh giá hợp lệ được lưu và có thể hiển thị trên trang sản phẩm. |
| Luồng chính | 1. Người mua mở đơn đã hoàn thành. 2. Chọn sản phẩm cần đánh giá. 3. Nhập số sao và nội dung nhận xét. 4. Hệ thống kiểm tra điều kiện đánh giá. 5. Hệ thống lưu đánh giá. |
| Ngoại lệ / Luồng thay thế | Không đáp ứng điều kiện mua hàng/hoàn thành đơn hoặc vượt quy định số lần đánh giá thì không được lưu. |

#### 3.4.11. Use Case Thêm sản phẩm

| Mô tả | Cho phép seller tạo sản phẩm mới cho shop. |
| --- | --- |
| Tác nhân | Seller |
| Tiền điều kiện | Seller đã đăng nhập và shop đang hoạt động. |
| Hậu điều kiện | Sản phẩm mới được lưu với trạng thái phù hợp để quản lý/hiển thị. |
| Luồng chính | 1. Seller mở chức năng thêm sản phẩm. 2. Nhập tên, danh mục, mô tả, giá, tồn kho và hình ảnh. 3. Khai báo biến thể/SKU nếu có. 4. Hệ thống kiểm tra dữ liệu bắt buộc. 5. Seller lưu sản phẩm. |
| Ngoại lệ / Luồng thay thế | Thiếu dữ liệu bắt buộc, giá không hợp lệ hoặc SKU vi phạm quy định thì hệ thống yêu cầu sửa. |

#### 3.4.12. Use Case Quản lý biến thể và tồn kho

| Mô tả | Cho phép seller duy trì SKU, giá và tồn của sản phẩm. |
| --- | --- |
| Tác nhân | Seller |
| Tiền điều kiện | Sản phẩm thuộc shop của seller. |
| Hậu điều kiện | Biến thể và tồn kho được cập nhật; dữ liệu đơn cũ không bị thay đổi. |
| Luồng chính | 1. Seller mở sản phẩm. 2. Thêm hoặc chỉnh sửa biến thể. 3. Nhập SKU, giá, tồn kho và trạng thái. 4. Hệ thống kiểm tra tính hợp lệ. 5. Hệ thống lưu thay đổi. |
| Ngoại lệ / Luồng thay thế | Tồn kho âm, giá không hợp lệ hoặc SKU vi phạm quy định thì từ chối cập nhật. |

#### 3.4.13. Use Case Xử lý đơn hàng của Seller

| Mô tả | Cho phép seller tiếp nhận và chuyển trạng thái đơn theo quy trình. |
| --- | --- |
| Tác nhân | Seller |
| Tiền điều kiện | Đơn thuộc shop và seller đã đăng nhập. |
| Hậu điều kiện | Đơn được cập nhật sang trạng thái hợp lệ tiếp theo và lưu lịch sử. |
| Luồng chính | 1. Seller xem danh sách đơn mới. 2. Mở chi tiết đơn. 3. Xác nhận hoặc từ chối theo điều kiện. 4. Nếu xác nhận, chuyển sang chuẩn bị hàng. 5. Sau khi chuẩn bị xong, bàn giao vận chuyển. 6. Hệ thống lưu từng lần chuyển trạng thái. |
| Ngoại lệ / Luồng thay thế | Không cho phép seller nhảy trạng thái hoặc xử lý đơn không thuộc shop. |

#### 3.4.14. Use Case Khóa tài khoản hoặc shop

| Mô tả | Cho phép Admin tạm ngừng quyền hoạt động của đối tượng vi phạm. |
| --- | --- |
| Tác nhân | Admin |
| Tiền điều kiện | Admin đã đăng nhập và có quyền quản trị; đối tượng tồn tại. |
| Hậu điều kiện | Trạng thái tài khoản/shop được cập nhật và hành động được ghi nhận. |
| Luồng chính | 1. Admin tìm người dùng hoặc shop. 2. Mở thông tin chi tiết. 3. Chọn thao tác khóa và nhập lý do nếu cần. 4. Hệ thống xác nhận quyền và cập nhật trạng thái. 5. Hệ thống ghi nhật ký và có thể tạo thông báo cho đối tượng. |
| Ngoại lệ / Luồng thay thế | Nếu đối tượng không tồn tại hoặc thao tác không hợp lệ thì hệ thống không thay đổi dữ liệu. |

#### 3.4.15. Use Case Xử lý sản phẩm hoặc nội dung vi phạm

| Mô tả | Cho phép Admin ẩn hoặc xử lý nội dung không phù hợp. |
| --- | --- |
| Tác nhân | Admin |
| Tiền điều kiện | Admin đã đăng nhập; sản phẩm/đánh giá tồn tại. |
| Hậu điều kiện | Đối tượng chuyển sang trạng thái bị ẩn/xử lý và lý do được lưu. |
| Luồng chính | 1. Admin tra cứu đối tượng. 2. Xem chi tiết và thông tin liên quan. 3. Chọn hình thức xử lý. 4. Nhập lý do. 5. Hệ thống cập nhật trạng thái và lưu nhật ký. |
| Ngoại lệ / Luồng thay thế | Không xóa vật lý dữ liệu giao dịch đã phát sinh; nếu thao tác không hợp lệ thì từ chối cập nhật. |

## 4. CÁC LƯỢC ĐỒ CHỨC NĂNG

Phần này bố trí sẵn đầy đủ vị trí và tên các lược đồ Use Case. Nhóm sẽ bổ sung hình vẽ vào đúng vị trí tương ứng sau khi hoàn thiện sơ đồ.

### 4.1. Lược đồ Use Case tổng quát

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.1. Sơ đồ Use Case tổng quát của hệ thống thương mại điện tử**

### 4.2. Lược đồ Use Case phía Khách và Người mua

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.2. Sơ đồ Use Case chức năng của Khách**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.3. Sơ đồ Use Case quản lý tài khoản và hồ sơ**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.4. Sơ đồ Use Case tra cứu và xem sản phẩm**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.5. Sơ đồ Use Case quản lý giỏ hàng**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.. Sơ đồ Use Case đặt hàng và Checkout**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.7. Sơ đồ Use Case thanh toán**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.. Sơ đồ Use Case quản lý đơn hàng của Người mua**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.9. Sơ đồ Use Case vận chuyển**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.10. Sơ đồ Use Case đánh giá sản phẩm**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.11. Sơ đồ Use Case thông báo**

### 4.3. Lược đồ Use Case phía Người bán

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.12. Sơ đồ Use Case quản lý gian hàng**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.13. Sơ đồ Use Case quản lý sản phẩm**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.14. Sơ đồ Use Case quản lý biến thể và tồn kho**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.15. Sơ đồ Use Case xử lý đơn hàng của Người bán**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.16. Sơ đồ Use Case quản lý voucher và khuyến mãi**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.17. Sơ đồ Use Case báo cáo thống kê của Người bán**

### 4.4. Lược đồ Use Case phía Quản trị viên

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.18. Sơ đồ Use Case quản lý người dùng**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.19. Sơ đồ Use Case quản lý shop**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.20. Sơ đồ Use Case quản lý danh mục**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.21. Sơ đồ Use Case kiểm duyệt sản phẩm và nội dung**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.22. Sơ đồ Use Case quản lý đơn hàng toàn hệ thống**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.23. Sơ đồ Use Case quản lý voucher toàn sàn**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.24. Sơ đồ Use Case báo cáo thống kê quản trị**

> [Bảng/hình ảnh trong DOCX gốc - xem file nguồn]

> **Hình 4.25. Sơ đồ Use Case quản lý thông báo và nhật ký quản trị**

## 5. THIẾT KẾ DỮ LIỆU

Phần này trình bày thiết kế dữ liệu cho hệ thống thương mại điện tử đa người bán dựa trên các yêu cầu nghiệp vụ, quy định QD01–QD20, các Use Case và phạm vi MVP đã xác định ở các phần trước. Thiết kế sử dụng PostgreSQL trên Supabase, ưu tiên tính toàn vẹn dữ liệu giao dịch, khả năng truy vết và hạn chế dữ liệu trùng lặp.

Schema Freeze v1 gồm 22 bảng nghiệp vụ. Các quyết định chính gồm: Supabase Auth quản lý xác thực; User.UserID dùng trực tiếp UUID của auth.users.id; giá và tồn kho chỉ được lưu tại ProductVariant; OrderItem lưu snapshot giá và thông tin sản phẩm tại thời điểm mua; Order lưu snapshot địa chỉ giao hàng; một Order thuộc một Shop; một Order sử dụng tối đa một voucher; Order có thể có nhiều Payment để hỗ trợ retry nhưng tối đa một Payment SUCCESS; danh mục tối đa hai cấp trong MVP; các đối tượng có lịch sử giao dịch ưu tiên đổi trạng thái thay vì xóa vật lý.

### 5.1. Lược đồ logic

> [Hình ảnh/đồ họa trong DOCX gốc - xem file nguồn]

> **Hình 5.26. Lược đồ logic tổng quát của hệ thống.**

#### 5.1.1. Các quyết định thiết kế nền tảng

- Authentication: Supabase Auth quản lý đăng ký, đăng nhập, Google OAuth, phiên và thông tin xác thực. CSDL nghiệp vụ không lưu mật khẩu.

- User.UserID là UUID và đồng thời là khóa ngoại tham chiếu auth.users(id). Không tạo AuthID riêng.

- Guest không phải một bản ghi hay Role trong CSDL; Guest là người dùng chưa xác thực.

- ProductVariant là nguồn dữ liệu duy nhất cho giá hiện hành và tồn kho. Sản phẩm không có phân loại vẫn có một default variant.

- OrderItem lưu snapshot tên sản phẩm, biến thể và đơn giá để bảo đảm QD08: thay đổi giá sau này không làm thay đổi đơn cũ.

- Order lưu snapshot người nhận và địa chỉ giao hàng; không chỉ tham chiếu Address vì Buyer có thể sửa/xóa địa chỉ đã lưu.

- Checkout là quy trình nghiệp vụ, không phải một bảng dữ liệu.

- Checkout có nhiều shop được tách thành nhiều Order, mỗi Order thuộc đúng một Shop.

- Một Order sử dụng tối đa một voucher trong MVP. Order không lưu VoucherID; VoucherUsage là nguồn quan hệ duy nhất giữa Order và Voucher.

- Order 1:N Payment để hỗ trợ retry thanh toán online. Mỗi Order chỉ có tối đa một Payment ở trạng thái SUCCESS.

- Trong phạm vi MVP, Category tối đa hai cấp: danh mục cha và danh mục con. Ràng buộc độ sâu được kiểm tra ở tầng Service.

- ModerationRecord và AdminLog sử dụng TargetType + TargetID theo mô hình polymorphic association. Tính tồn tại của đối tượng được kiểm tra ở tầng Service.

- Báo cáo, số lượng đã bán, điểm đánh giá trung bình và số lượt dùng voucher được tính từ dữ liệu giao dịch, không tạo nguồn dữ liệu tổng hợp thứ hai.

- Shop.OwnerID UNIQUE là giả định của MVP, không phải yêu cầu gốc. Trong phạm vi đồ án, mỗi tài khoản chỉ sở hữu tối đa một gian hàng để đơn giản hóa phân quyền Seller.

#### 5.1.2. Danh sách lược đồ quan hệ

User(UserID, Email, Role, Status, CreatedAt, UpdatedAt)

UserProfile(UserID, FullName, Phone, AvatarURL, UpdatedAt)

Address(AddressID, UserID, RecipientName, Phone, Province, District, Ward, DetailAddress, IsDefault, CreatedAt, UpdatedAt)

Shop(ShopID, OwnerID, ShopName, Description, LogoURL, PickupAddress, ContactPhone, Status, CreatedAt, UpdatedAt)

Category(CategoryID, ParentCategoryID, CategoryName, Description, Status, CreatedAt, UpdatedAt)

Product(ProductID, ShopID, CategoryID, ProductName, Description, Status, CreatedAt, UpdatedAt)

ProductImage(ImageID, ProductID, ImageURL, SortOrder)

ProductVariant(VariantID, ProductID, VariantName, VariantValue, SKU, Price, StockQuantity, Status, CreatedAt, UpdatedAt)

Cart(CartID, BuyerID, CreatedAt, UpdatedAt)

CartItem(CartItemID, CartID, VariantID, Quantity, IsSelected, CreatedAt, UpdatedAt)

Order(OrderID, BuyerID, ShopID, RecipientName, RecipientPhone, Province, District, Ward, DeliveryAddress, Subtotal, DiscountAmount, ShippingFee, TotalAmount, Status, CancelReason, CreatedAt, UpdatedAt)

OrderItem(OrderItemID, OrderID, ProductID, VariantID, ProductNameSnapshot, VariantSnapshot, UnitPrice, Quantity, LineTotal)

OrderStatusHistory(HistoryID, OrderID, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)

Payment(PaymentID, OrderID, TransactionCode, Method, Amount, Status, CreatedAt, PaidAt, Note)

Shipment(ShipmentID, OrderID, CarrierName, TrackingCode, Status, UpdatedAt)

Voucher(VoucherID, Code, VoucherName, Scope, ShopID, DiscountType, DiscountValue, MaxDiscount, MinOrderValue, Quantity, StartAt, EndAt, Status, CreatedAt, UpdatedAt)

VoucherUsage(UsageID, VoucherID, OrderID, BuyerID, DiscountAmount, UsedAt)

Review(ReviewID, BuyerID, ProductID, OrderItemID, Rating, Content, Status, CreatedAt, UpdatedAt)

ReviewImage(ReviewImageID, ReviewID, ImageURL, SortOrder)

Notification(NotificationID, RecipientID, Type, Title, Content, IsRead, CreatedAt, ReadAt)

ModerationRecord(ModerationID, TargetType, TargetID, Reason, Action, AdminID, CreatedAt)

AdminLog(LogID, AdminID, Action, TargetType, TargetID, Reason, CreatedAt)

### 5.2. Mô tả chi tiết các bảng dữ liệu

Quy ước kiểu dữ liệu: UUID dùng cho khóa định danh; TIMESTAMPTZ dùng cho thời gian; NUMERIC(15,2) dùng cho giá trị tiền; các trường trạng thái được giới hạn theo miền giá trị nghiệp vụ. Các trường CreatedAt/UpdatedAt được hệ thống quản lý tự động.

#### 5.2.1. Bảng User

Lược đồ: User(UserID, Email, Role, Status, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | UserID | UUID | NOT NULL | Mã người dùng | PK, FK → auth.users(id); ON DELETE RESTRICT |
| 2 | Email | VARCHAR(255) | Email hợp lệ | Email nghiệp vụ | UNIQUE, NOT NULL; đồng bộ Supabase Auth |
| 3 | Role | VARCHAR(20) | {BUYER, SELLER, ADMIN} | Vai trò hệ thống | NOT NULL |
| 4 | Status | VARCHAR(20) | {ACTIVE, LOCKED} | Trạng thái tài khoản | NOT NULL |
| 5 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 6 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Không lưu Password/PasswordHash; Supabase Auth quản lý |

> **Bảng 5.1. Mô tả bảng User.**

#### 5.2.2. Bảng UserProfile

Lược đồ: UserProfile(UserID, FullName, Phone, AvatarURL, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | UserID | UUID | NOT NULL | Mã người dùng | PK, FK → User.UserID |
| 2 | FullName | VARCHAR(150) | Chuỗi <= 150 | Họ tên |  |
| 3 | Phone | VARCHAR(20) | SĐT hợp lệ / NULL | Số điện thoại | Có thể NULL |
| 4 | AvatarURL | TEXT | URL / NULL | Ảnh đại diện | Supabase Storage |
| 5 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.2. Mô tả bảng UserProfile.**

#### 5.2.3. Bảng Address

Lược đồ: Address(AddressID, UserID, RecipientName, Phone, Province, District, Ward, DetailAddress, IsDefault, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | AddressID | UUID | NOT NULL | Mã địa chỉ | PK |
| 2 | UserID | UUID | NOT NULL | Chủ sở hữu địa chỉ | FK → User.UserID |
| 3 | RecipientName | VARCHAR(150) | Chuỗi không rỗng | Tên người nhận | NOT NULL |
| 4 | Phone | VARCHAR(20) | SĐT hợp lệ | Số điện thoại nhận | NOT NULL |
| 5 | Province | VARCHAR(100) | Chuỗi không rỗng | Tỉnh/Thành | NOT NULL |
| 6 | District | VARCHAR(100) | Chuỗi không rỗng | Quận/Huyện | NOT NULL |
| 7 | Ward | VARCHAR(100) | Chuỗi không rỗng | Phường/Xã | NOT NULL |
| 8 | DetailAddress | VARCHAR(255) | Chuỗi không rỗng | Địa chỉ chi tiết | NOT NULL |
| 9 | IsDefault | BOOLEAN | {TRUE, FALSE} | Địa chỉ mặc định | Mặc định FALSE; tối đa 1 default/User |
| 10 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 11 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.3. Mô tả bảng Address.**

#### 5.2.4. Bảng Shop

Lược đồ: Shop(ShopID, OwnerID, ShopName, Description, LogoURL, PickupAddress, ContactPhone, Status, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | ShopID | UUID | NOT NULL | Mã gian hàng | PK |
| 2 | OwnerID | UUID | NOT NULL | Chủ shop | FK → User.UserID; UNIQUE trong MVP |
| 3 | ShopName | VARCHAR(150) | Chuỗi không rỗng | Tên gian hàng | NOT NULL |
| 4 | Description | TEXT | Nội dung / NULL | Mô tả shop | Có thể NULL |
| 5 | LogoURL | TEXT | URL / NULL | Logo shop | Supabase Storage |
| 6 | PickupAddress | VARCHAR(255) | Chuỗi hợp lệ | Địa chỉ lấy hàng |  |
| 7 | ContactPhone | VARCHAR(20) | SĐT hợp lệ | Số điện thoại liên hệ |  |
| 8 | Status | VARCHAR(20) | {PENDING, ACTIVE, SUSPENDED, LOCKED} | Trạng thái shop | NOT NULL |
| 9 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 10 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | OwnerID UNIQUE là giả định MVP, không phải yêu cầu gốc |

> **Bảng 5.4. Mô tả bảng Shop.**

#### 5.2.5. Bảng Category

Lược đồ: Category(CategoryID, ParentCategoryID, CategoryName, Description, Status, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | CategoryID | UUID | NOT NULL | Mã danh mục | PK |
| 2 | ParentCategoryID | UUID | UUID / NULL | Danh mục cha | FK tự tham chiếu; NULL = cấp 1 |
| 3 | CategoryName | VARCHAR(150) | Chuỗi không rỗng | Tên danh mục | NOT NULL |
| 4 | Description | TEXT | Nội dung / NULL | Mô tả | Có thể NULL |
| 5 | Status | VARCHAR(20) | {ACTIVE, INACTIVE} | Trạng thái danh mục | NOT NULL |
| 6 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Tối đa 2 cấp trong MVP; Service kiểm tra |
| 7 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.5. Mô tả bảng Category.**

#### 5.2.6. Bảng Product

Lược đồ: Product(ProductID, ShopID, CategoryID, ProductName, Description, Status, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | ProductID | UUID | NOT NULL | Mã sản phẩm | PK |
| 2 | ShopID | UUID | NOT NULL | Shop sở hữu sản phẩm | FK → Shop.ShopID |
| 3 | CategoryID | UUID | NOT NULL | Danh mục sản phẩm | FK → Category.CategoryID |
| 4 | ProductName | VARCHAR(255) | Chuỗi không rỗng | Tên sản phẩm | NOT NULL |
| 5 | Description | TEXT | Nội dung / NULL | Mô tả sản phẩm | Có thể NULL |
| 6 | Status | VARCHAR(20) | {DRAFT, ACTIVE, INACTIVE, HIDDEN} | Trạng thái sản phẩm | NOT NULL |
| 7 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Không lưu giá/tồn kho tại Product |
| 8 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Giá/tồn kho nằm tại ProductVariant |

> **Bảng 5.6. Mô tả bảng Product.**

#### 5.2.7. Bảng ProductImage

Lược đồ: ProductImage(ImageID, ProductID, ImageURL, SortOrder)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | ImageID | UUID | NOT NULL | Mã ảnh sản phẩm | PK |
| 2 | ProductID | UUID | NOT NULL | Sản phẩm sở hữu ảnh | FK → Product.ProductID |
| 3 | ImageURL | TEXT | URL hợp lệ | Đường dẫn ảnh | Lưu file trên Supabase Storage |
| 4 | SortOrder | INTEGER | >= 0 | Thứ tự hiển thị |  |

> **Bảng 5.7. Mô tả bảng ProductImage.**

#### 5.2.8. Bảng ProductVariant

Lược đồ: ProductVariant(VariantID, ProductID, VariantName, VariantValue, SKU, Price, StockQuantity, Status, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | VariantID | UUID | NOT NULL | Mã biến thể | PK |
| 2 | ProductID | UUID | NOT NULL | Sản phẩm sở hữu biến thể | FK → Product.ProductID |
| 3 | VariantName | VARCHAR(100) | Chuỗi hợp lệ | Tên nhóm phân loại | Default variant dùng giá trị quy ước |
| 4 | VariantValue | VARCHAR(150) | Chuỗi hợp lệ | Giá trị phân loại |  |
| 5 | SKU | VARCHAR(100) | Chuỗi không rỗng | Mã SKU | Duy nhất trong phạm vi Shop; Service kiểm tra |
| 6 | Price | NUMERIC(15,2) | > 0 | Giá bán hiện hành | Nguồn giá duy nhất |
| 7 | StockQuantity | INTEGER | >= 0 | Tồn kho hiện hành | Nguồn tồn kho duy nhất |
| 8 | Status | VARCHAR(20) | {ACTIVE, INACTIVE} | Trạng thái biến thể | NOT NULL |
| 9 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 10 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.8. Mô tả bảng ProductVariant.**

#### 5.2.9. Bảng Cart

Lược đồ: Cart(CartID, BuyerID, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | CartID | UUID | NOT NULL | Mã giỏ hàng | PK |
| 2 | BuyerID | UUID | NOT NULL | Chủ giỏ hàng | FK → User.UserID; UNIQUE |
| 3 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 4 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.9. Mô tả bảng Cart.**

#### 5.2.10. Bảng CartItem

Lược đồ: CartItem(CartItemID, CartID, VariantID, Quantity, IsSelected, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | CartItemID | UUID | NOT NULL | Mã dòng giỏ hàng | PK |
| 2 | CartID | UUID | NOT NULL | Giỏ hàng sở hữu dòng | FK → Cart.CartID |
| 3 | VariantID | UUID | NOT NULL | Biến thể được chọn | FK → ProductVariant.VariantID |
| 4 | Quantity | INTEGER | >= 1 | Số lượng |  |
| 5 | IsSelected | BOOLEAN | {TRUE, FALSE} | Có được chọn checkout hay không |  |
| 6 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm thêm | Hệ thống quản lý |
| 7 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | UNIQUE(CartID, VariantID) áp dụng cho dòng giỏ |

> **Bảng 5.10. Mô tả bảng CartItem.**

#### 5.2.11. Bảng Order

Lược đồ: Order(OrderID, BuyerID, ShopID, RecipientName, RecipientPhone, Province, District, Ward, DeliveryAddress, Subtotal, DiscountAmount, ShippingFee, TotalAmount, Status, CancelReason, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | OrderID | UUID | NOT NULL | Mã đơn hàng | PK |
| 2 | BuyerID | UUID | NOT NULL | Người mua | FK → User.UserID |
| 3 | ShopID | UUID | NOT NULL | Shop xử lý đơn | FK → Shop.ShopID |
| 4 | RecipientName | VARCHAR(150) | Chuỗi không rỗng | Tên người nhận | Snapshot |
| 5 | RecipientPhone | VARCHAR(20) | SĐT hợp lệ | Số điện thoại nhận | Snapshot |
| 6 | Province | VARCHAR(100) | Chuỗi không rỗng | Tỉnh/Thành | Snapshot |
| 7 | District | VARCHAR(100) | Chuỗi không rỗng | Quận/Huyện | Snapshot |
| 8 | Ward | VARCHAR(100) | Chuỗi không rỗng | Phường/Xã | Snapshot |
| 9 | DeliveryAddress | VARCHAR(255) | Chuỗi không rỗng | Địa chỉ chi tiết | Snapshot |
| 10 | Subtotal | NUMERIC(15,2) | >= 0 | Tiền hàng | Chốt khi tạo Order; bất biến |
| 11 | DiscountAmount | NUMERIC(15,2) | >= 0 | Số tiền giảm | Mặc định 0; chốt khi tạo Order |
| 12 | ShippingFee | NUMERIC(15,2) | >= 0 | Phí vận chuyển | Chốt khi tạo Order |
| 13 | TotalAmount | NUMERIC(15,2) | >= 0 | Tổng thanh toán | = Subtotal + ShippingFee - DiscountAmount; chốt khi tạo Order |
| 14 | Status | VARCHAR(30) | {PENDING_CONFIRMATION, CONFIRMED, PREPARING, SHIPPING, COMPLETED, CANCELLED, DELIVERY_FAILED} | Trạng thái đơn | NOT NULL |
| 15 | CancelReason | TEXT | Nội dung / NULL | Lý do hủy | Service bắt buộc khi Status = CANCELLED |
| 16 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 17 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.11. Mô tả bảng Order.**

#### 5.2.12. Bảng OrderItem

Lược đồ: OrderItem(OrderItemID, OrderID, ProductID, VariantID, ProductNameSnapshot, VariantSnapshot, UnitPrice, Quantity, LineTotal)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | OrderItemID | UUID | NOT NULL | Mã chi tiết đơn | PK |
| 2 | OrderID | UUID | NOT NULL | Đơn hàng chứa dòng hàng | FK → Order.OrderID |
| 3 | ProductID | UUID | NOT NULL | Sản phẩm đã mua | FK → Product.ProductID |
| 4 | VariantID | UUID | NOT NULL | Biến thể đã mua | FK → ProductVariant.VariantID |
| 5 | ProductNameSnapshot | VARCHAR(255) | Chuỗi không rỗng | Tên sản phẩm lúc mua | Snapshot |
| 6 | VariantSnapshot | VARCHAR(255) | Chuỗi / NULL | Mô tả biến thể lúc mua | Snapshot |
| 7 | UnitPrice | NUMERIC(15,2) | > 0 | Đơn giá lúc mua | Snapshot, bất biến |
| 8 | Quantity | INTEGER | >= 1 | Số lượng mua |  |
| 9 | LineTotal | NUMERIC(15,2) | >= 0 | Thành tiền dòng | = UnitPrice × Quantity |

> **Bảng 5.12. Mô tả bảng OrderItem.**

#### 5.2.13. Bảng OrderStatusHistory

Lược đồ: OrderStatusHistory(HistoryID, OrderID, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | HistoryID | UUID | NOT NULL | Mã lịch sử trạng thái | PK |
| 2 | OrderID | UUID | NOT NULL | Đơn hàng liên quan | FK → Order.OrderID |
| 3 | OldStatus | VARCHAR(30) | Trạng thái / NULL | Trạng thái trước | NULL với bản ghi khởi tạo |
| 4 | NewStatus | VARCHAR(30) | Miền trạng thái Order | Trạng thái mới | NOT NULL |
| 5 | ChangedBy | UUID | UUID / NULL | Tác nhân thay đổi | FK → User.UserID; ON DELETE SET NULL; NULL = hệ thống |
| 6 | Reason | TEXT | Nội dung / NULL | Lý do thay đổi | Có thể NULL tùy nghiệp vụ |
| 7 | ChangedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm thay đổi | NOT NULL |

> **Bảng 5.13. Mô tả bảng OrderStatusHistory.**

#### 5.2.14. Bảng Payment

Lược đồ: Payment(PaymentID, OrderID, TransactionCode, Method, Amount, Status, CreatedAt, PaidAt, Note)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | PaymentID | UUID | NOT NULL | Mã thanh toán | PK |
| 2 | OrderID | UUID | NOT NULL | Đơn hàng được thanh toán | FK → Order.OrderID |
| 3 | TransactionCode | VARCHAR(100) | Chuỗi / NULL | Mã giao dịch | UNIQUE khi có giá trị; partial unique index |
| 4 | Method | VARCHAR(20) | {COD, ONLINE} | Phương thức thanh toán | NOT NULL |
| 5 | Amount | NUMERIC(15,2) | > 0 | Số tiền thanh toán | = Order.TotalAmount trong MVP |
| 6 | Status | VARCHAR(20) | {PENDING, SUCCESS, FAILED} | Trạng thái thanh toán | NOT NULL |
| 7 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 8 | PaidAt | TIMESTAMPTZ | Thời gian / NULL | Thời điểm thanh toán thành công | Bắt buộc khi Status = SUCCESS |
| 9 | Note | TEXT | Nội dung / NULL | Ghi chú giao dịch mô phỏng | Có thể NULL |

> **Bảng 5.14. Mô tả bảng Payment.**

#### 5.2.15. Bảng Shipment

Lược đồ: Shipment(ShipmentID, OrderID, CarrierName, TrackingCode, Status, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | ShipmentID | UUID | NOT NULL | Mã vận chuyển | PK |
| 2 | OrderID | UUID | NOT NULL | Đơn hàng liên quan | FK → Order.OrderID; UNIQUE |
| 3 | CarrierName | VARCHAR(150) | Chuỗi / NULL | Đơn vị vận chuyển mô phỏng |  |
| 4 | TrackingCode | VARCHAR(100) | Chuỗi / NULL | Mã vận đơn | UNIQUE khi có giá trị |
| 5 | Status | VARCHAR(30) | {PENDING, HANDED_OVER, SHIPPING, DELIVERED, FAILED} | Trạng thái vận chuyển | NOT NULL |
| 6 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật gần nhất | Hệ thống quản lý |

> **Bảng 5.15. Mô tả bảng Shipment.**

#### 5.2.16. Bảng Voucher

Lược đồ: Voucher(VoucherID, Code, VoucherName, Scope, ShopID, DiscountType, DiscountValue, MaxDiscount, MinOrderValue, Quantity, StartAt, EndAt, Status, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | VoucherID | UUID | NOT NULL | Mã định danh voucher | PK |
| 2 | Code | VARCHAR(50) | Chuỗi không rỗng | Mã voucher | UNIQUE, NOT NULL |
| 3 | VoucherName | VARCHAR(150) | Chuỗi không rỗng | Tên chương trình | NOT NULL |
| 4 | Scope | VARCHAR(20) | {PLATFORM, SHOP} | Phạm vi áp dụng | NOT NULL |
| 5 | ShopID | UUID | UUID / NULL | Shop sở hữu voucher | FK → Shop.ShopID; NULL với PLATFORM |
| 6 | DiscountType | VARCHAR(20) | {PERCENT, FIXED} | Kiểu giảm giá | NOT NULL |
| 7 | DiscountValue | NUMERIC(15,2) | > 0; PERCENT <= 100 | Giá trị giảm | CHECK |
| 8 | MaxDiscount | NUMERIC(15,2) | >= 0 / NULL | Mức giảm tối đa | Có thể NULL |
| 9 | MinOrderValue | NUMERIC(15,2) | >= 0 | Giá trị đơn tối thiểu |  |
| 10 | Quantity | INTEGER | >= 0 | Số lượt phát hành còn lại |  |
| 11 | StartAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm bắt đầu | NOT NULL |
| 12 | EndAt | TIMESTAMPTZ | EndAt > StartAt | Thời điểm kết thúc | NOT NULL |
| 13 | Status | VARCHAR(20) | {ACTIVE, INACTIVE} | Trạng thái voucher | NOT NULL |
| 14 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 15 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.16. Mô tả bảng Voucher.**

#### 5.2.17. Bảng VoucherUsage

Lược đồ: VoucherUsage(UsageID, VoucherID, OrderID, BuyerID, DiscountAmount, UsedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | UsageID | UUID | NOT NULL | Mã lượt dùng voucher | PK |
| 2 | VoucherID | UUID | NOT NULL | Voucher được sử dụng | FK → Voucher.VoucherID |
| 3 | OrderID | UUID | NOT NULL | Đơn áp dụng voucher | FK → Order.OrderID; UNIQUE |
| 4 | BuyerID | UUID | NOT NULL | Người sử dụng | FK → User.UserID |
| 5 | DiscountAmount | NUMERIC(15,2) | >= 0 | Số tiền giảm thực tế | Phải = Order.DiscountAmount trong transaction tạo đơn |
| 6 | UsedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm sử dụng | NOT NULL |

> **Bảng 5.17. Mô tả bảng VoucherUsage.**

#### 5.2.18. Bảng Review

Lược đồ: Review(ReviewID, BuyerID, ProductID, OrderItemID, Rating, Content, Status, CreatedAt, UpdatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | ReviewID | UUID | NOT NULL | Mã đánh giá | PK |
| 2 | BuyerID | UUID | NOT NULL | Người mua đánh giá | FK → User.UserID |
| 3 | ProductID | UUID | NOT NULL | Sản phẩm được đánh giá | FK → Product.ProductID |
| 4 | OrderItemID | UUID | NOT NULL | Dòng đơn làm căn cứ đánh giá | FK → OrderItem.OrderItemID; UNIQUE |
| 5 | Rating | SMALLINT | {1,2,3,4,5} | Số sao đánh giá | CHECK 1–5 |
| 6 | Content | TEXT | Nội dung / NULL | Nhận xét của Buyer | Có thể NULL |
| 7 | Status | VARCHAR(20) | {VISIBLE, HIDDEN} | Trạng thái hiển thị | NOT NULL |
| 8 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 9 | UpdatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

> **Bảng 5.18. Mô tả bảng Review.**

Lưu ý: điều kiện Order.Status = COMPLETED chỉ được kiểm tra tại THỜI ĐIỂM TẠO Review. Nếu sau đó Admin can thiệp đổi trạng thái đơn theo QLDH-A, các Review đã tồn tại không bị xóa hoặc vô hiệu hóa hồi tố; đây là hành vi được chấp nhận trong phạm vi MVP.

#### 5.2.19. Bảng ReviewImage

Lược đồ: ReviewImage(ReviewImageID, ReviewID, ImageURL, SortOrder)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | ReviewImageID | UUID | NOT NULL | Mã ảnh đánh giá | PK |
| 2 | ReviewID | UUID | NOT NULL | Đánh giá sở hữu ảnh | FK → Review.ReviewID |
| 3 | ImageURL | TEXT | URL hợp lệ | Đường dẫn ảnh | Lưu file trên Supabase Storage |
| 4 | SortOrder | INTEGER | >= 0 | Thứ tự hiển thị |  |

> **Bảng 5.19. Mô tả bảng ReviewImage.**

#### 5.2.20. Bảng Notification

Lược đồ: Notification(NotificationID, RecipientID, Type, Title, Content, IsRead, CreatedAt, ReadAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | NotificationID | UUID | NOT NULL | Mã thông báo | PK |
| 2 | RecipientID | UUID | NOT NULL | Người nhận thông báo | FK → User.UserID |
| 3 | Type | VARCHAR(30) | {ORDER, PAYMENT, SHIPPING, VIOLATION, SYSTEM} | Loại thông báo | NOT NULL |
| 4 | Title | VARCHAR(255) | Chuỗi không rỗng | Tiêu đề | NOT NULL |
| 5 | Content | TEXT | Nội dung không rỗng | Nội dung thông báo | NOT NULL |
| 6 | IsRead | BOOLEAN | {TRUE, FALSE} | Đã đọc hay chưa | Mặc định FALSE |
| 7 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| 8 | ReadAt | TIMESTAMPTZ | Thời gian / NULL | Thời điểm đọc | Bắt buộc khi IsRead = TRUE |

> **Bảng 5.20. Mô tả bảng Notification.**

#### 5.2.21. Bảng ModerationRecord

Lược đồ: ModerationRecord(ModerationID, TargetType, TargetID, Reason, Action, AdminID, CreatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | ModerationID | UUID | NOT NULL | Mã bản ghi kiểm duyệt | PK |
| 2 | TargetType | VARCHAR(30) | {USER, SHOP, PRODUCT, REVIEW, ORDER, VOUCHER, ...} | Loại đối tượng kiểm duyệt | Polymorphic |
| 3 | TargetID | UUID | NOT NULL | Mã đối tượng tương ứng | Không có FK vật lý; Service kiểm tra tồn tại |
| 4 | Reason | TEXT | Nội dung hợp lệ | Lý do xử lý | NOT NULL |
| 5 | Action | VARCHAR(50) | {HIDE, LOCK, UNLOCK, RESTORE, WARNING, ...} | Hành động xử lý | NOT NULL |
| 6 | AdminID | UUID | NOT NULL | Admin thực hiện | FK → User.UserID |
| 7 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm xử lý | Hệ thống quản lý |

> **Bảng 5.21. Mô tả bảng ModerationRecord.**

#### 5.2.22. Bảng AdminLog

Lược đồ: AdminLog(LogID, AdminID, Action, TargetType, TargetID, Reason, CreatedAt)

| STT | Thuộc tính | Kiểu | Miền giá trị | Ý nghĩa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 1 | LogID | UUID | NOT NULL | Mã nhật ký | PK |
| 2 | AdminID | UUID | NOT NULL | Admin thực hiện | FK → User.UserID |
| 3 | Action | VARCHAR(100) | Chuỗi hợp lệ | Tên thao tác quản trị | NOT NULL |
| 4 | TargetType | VARCHAR(30) | Loại đối tượng | Loại đối tượng bị tác động | Polymorphic |
| 5 | TargetID | UUID | UUID / NULL | Mã đối tượng | NULL với thao tác toàn hệ thống |
| 6 | Reason | TEXT | Nội dung / NULL | Lý do hoặc ghi chú | Bắt buộc với thao tác có quy định lý do |
| 7 | CreatedAt | TIMESTAMPTZ | Thời gian hợp lệ | Thời điểm ghi log | Dữ liệu audit được lưu để truy vết |

> **Bảng 5.22. Mô tả bảng AdminLog.**

### 5.3. Sơ đồ quan hệ dữ liệu

Các quan hệ chính của hệ thống:

- auth.users 1:1 User.

- User 1:0..1 UserProfile.

- User 1:N Address.

- User 1:0..1 Shop trong MVP.

- User 1:1 Cart trong MVP.

- User 1:N Order với vai trò Buyer.

- User 1:N Review.

- User 1:N Notification.

- Shop 1:N Product.

- Shop 1:N Order.

- Shop 1:N Voucher.

- Category 1:N Category theo quan hệ cha-con, tối đa hai cấp trong MVP.

- Category 1:N Product.

- Product 1:N ProductImage.

- Product 1:N ProductVariant.

- Product 1:N Review.

- Cart 1:N CartItem; CartItem N:1 ProductVariant.

- Order 1:N OrderItem.

- Order 1:N OrderStatusHistory.

- Order 1:N Payment.

- Order 1:0..1 Shipment.

- Order 1:0..1 VoucherUsage.

- Voucher 1:N VoucherUsage.

- OrderItem 1:0..1 Review.

- Review 1:N ReviewImage.

> [Hình ảnh/đồ họa trong DOCX gốc - xem file nguồn]

> **Hình 5.27. Sơ đồ quan hệ dữ liệu của hệ thống thương mại điện tử.**

Ghi chú: ERD được dựng trực tiếp từ các quan hệ trên; các quan hệ polymorphic của ModerationRecord/AdminLog được biểu diễn bằng ghi chú thay vì FK vật lý.

### 5.4. Ràng buộc toàn vẹn

> [Hình ảnh/đồ họa trong DOCX gốc - xem file nguồn]

> **Hình 5.28. Phân quyền và phạm vi truy cập dữ liệu.**

#### 5.4.1. Ràng buộc khóa chính

| Mã số | Mô tả ràng buộc | Thành phần liên quan | Ghi chú |
| --- | --- | --- | --- |
| RB-KC01 | Mỗi bảng User, UserProfile, Address, Shop, Category, Product, ProductImage, ProductVariant, Cart, CartItem, Order, OrderItem, OrderStatusHistory, Payment, Shipment, Voucher, VoucherUsage, Review, ReviewImage, Notification, ModerationRecord và AdminLog phải có khóa chính duy nhất và không NULL. | UserProfile, ProductVariant, ProductImage, OrderStatusHistory, ModerationRecord, VoucherUsage, ReviewImage, Notification, AdminLog, CartItem, OrderItem, Payment, Shipment, Voucher, Review, Address, Category, Product, Order, Shop, Cart, User | Database: PRIMARY KEY |
| RB-KC02 | UserProfile.UserID vừa là PK vừa là FK → User.UserID để bảo đảm quan hệ 1:0..1. | UserProfile, User | Database: PRIMARY KEY |

> **Bảng 5.23. Ràng buộc khóa chính.**

#### 5.4.2. Ràng buộc khóa ngoại

| Mã số | Mô tả ràng buộc | Thành phần liên quan | Ghi chú |
| --- | --- | --- | --- |
| RB-KN01 | User.UserID tham chiếu auth.users.id. | User | Database: FOREIGN KEY |
| RB-KN02 | Address.UserID → User.UserID. | Address, User | Database: FOREIGN KEY |
| RB-KN03 | Shop.OwnerID → User.UserID. | Shop, User | Database: FOREIGN KEY |
| RB-KN04 | Category.ParentCategoryID → Category.CategoryID, cho phép NULL. | Category | Database: FOREIGN KEY |
| RB-KN05 | Product.ShopID → Shop.ShopID; Product.CategoryID → Category.CategoryID. | Category, Product, Shop | Database: FOREIGN KEY |
| RB-KN06 | ProductImage.ProductID → Product.ProductID. | ProductImage, Product | Database: FOREIGN KEY |
| RB-KN07 | ProductVariant.ProductID → Product.ProductID. | ProductVariant, Product | Database: FOREIGN KEY |
| RB-KN08 | Cart.BuyerID → User.UserID. | Cart, User | Database: FOREIGN KEY |
| RB-KN09 | CartItem.CartID → Cart.CartID; CartItem.VariantID → ProductVariant.VariantID. | ProductVariant, CartItem, Product, Cart | Database: FOREIGN KEY |
| RB-KN10 | Order.BuyerID → User.UserID; Order.ShopID → Shop.ShopID. | Order, Shop, User | Database: FOREIGN KEY |
| RB-KN11 | OrderItem.OrderID → Order.OrderID; ProductID → Product.ProductID; VariantID → ProductVariant.VariantID. | ProductVariant, OrderItem, Product, Order | Database: FOREIGN KEY |
| RB-KN12 | OrderStatusHistory.OrderID → Order.OrderID; ChangedBy → User.UserID và cho phép NULL. | OrderStatusHistory, Order, User | Database: FOREIGN KEY |
| RB-KN13 | Payment.OrderID → Order.OrderID. | Payment, Order | Database: FOREIGN KEY |
| RB-KN14 | Shipment.OrderID → Order.OrderID. | Shipment, Order | Database: FOREIGN KEY |
| RB-KN15 | Voucher.ShopID → Shop.ShopID và cho phép NULL. | Voucher, Shop | Database: FOREIGN KEY |
| RB-KN16 | VoucherUsage.VoucherID → Voucher.VoucherID; OrderID → Order.OrderID; BuyerID → User.UserID. | VoucherUsage, Voucher, Order, User | Database: FOREIGN KEY |
| RB-KN17 | Review.BuyerID → User.UserID; ProductID → Product.ProductID; OrderItemID → OrderItem.OrderItemID. | OrderItem, Review, Product, Order, User | Database: FOREIGN KEY |
| RB-KN18 | ReviewImage.ReviewID → Review.ReviewID. | ReviewImage, Review | Database: FOREIGN KEY |
| RB-KN19 | Notification.RecipientID → User.UserID. | Notification, User | Database: FOREIGN KEY |
| RB-KN20 | ModerationRecord.AdminID và AdminLog.AdminID → User.UserID, NOT NULL. TargetID của cả hai bảng có thể NULL khi thao tác không gắn với một đối tượng cụ thể (ví dụ hành động toàn hệ thống); khi có giá trị, tính hợp lệ được kiểm tra tại Service theo TargetType tương ứng. Không khai báo FK vật lý cho ModerationRecord.TargetID/AdminLog.TargetID vì chúng tham chiếu động theo TargetType. | ModerationRecord, AdminLog, User | Database: FOREIGN KEY |

> **Bảng 5.24. Ràng buộc khóa ngoại.**

#### 5.4.3. Ràng buộc miền giá trị

| Mã số | Mô tả ràng buộc | Thành phần liên quan | Ghi chú |
| --- | --- | --- | --- |
| RB-MG01 | User.Role ∈ {BUYER, SELLER, ADMIN}. | User | Database CHECK hoặc Service validation |
| RB-MG02 | User.Status ∈ {ACTIVE, LOCKED}. | User | Database CHECK hoặc Service validation |
| RB-MG03 | ProductVariant.Price > 0. | ProductVariant, Product | Database CHECK hoặc Service validation |
| RB-MG04 | ProductVariant.StockQuantity >= 0. | ProductVariant, Product | Database CHECK hoặc Service validation |
| RB-MG05 | CartItem.Quantity >= 1. | CartItem, Cart | Database CHECK hoặc Service validation |
| RB-MG06 | OrderItem.UnitPrice > 0; OrderItem.Quantity >= 1; OrderItem.LineTotal >= 0. | OrderItem, Order | Database CHECK hoặc Service validation |
| RB-MG07 | Order.Subtotal, DiscountAmount, ShippingFee, TotalAmount >= 0. | Order | Database CHECK hoặc Service validation |
| RB-MG08 | Review.Rating ∈ {1,2,3,4,5}. | Review | Database CHECK hoặc Service validation |
| RB-MG09 | Voucher.Quantity >= 0; DiscountValue > 0; MinOrderValue >= 0; MaxDiscount >= 0 nếu có. | Voucher, Order | Database CHECK hoặc Service validation |
| RB-MG10 | Payment.Amount > 0. | Payment | Database CHECK hoặc Service validation |
| RB-MG11 | ProductImage.SortOrder và ReviewImage.SortOrder >= 0. | ProductImage, ReviewImage, Review, Product, Order | Database CHECK hoặc Service validation |
| RB-MG12 | Các trường trạng thái chỉ nhận giá trị thuộc miền trạng thái đã định nghĩa cho User, Shop, Category, Product, ProductVariant, Order, Payment, Shipment, Voucher và Review. | ProductVariant, Payment, Shipment, Voucher, Review, Category, Product, Order, Shop, User | Database CHECK hoặc Service validation |

> **Bảng 5.25. Ràng buộc miền giá trị.**

#### 5.4.4. Ràng buộc liên thuộc tính

| Mã số | Mô tả ràng buộc | Thành phần liên quan | Ghi chú |
| --- | --- | --- | --- |
| RB-LTT01 | OrderItem.LineTotal = OrderItem.UnitPrice × OrderItem.Quantity. | OrderItem, Order | CHECK hoặc Service/transaction |
| RB-LTT02 | Order.TotalAmount = Order.Subtotal + Order.ShippingFee - Order.DiscountAmount và Order.TotalAmount >= 0. | Order | CHECK hoặc Service/transaction |
| RB-LTT03 | Voucher.StartAt < Voucher.EndAt. | Voucher | CHECK hoặc Service/transaction |
| RB-LTT04 | Nếu Voucher.DiscountType = PERCENT thì 0 < DiscountValue <= 100. | Voucher | CHECK hoặc Service/transaction |
| RB-LTT05 | Nếu Voucher.Scope = PLATFORM thì ShopID IS NULL; nếu Voucher.Scope = SHOP thì ShopID IS NOT NULL. | Voucher, Shop | CHECK hoặc Service/transaction |
| RB-LTT06 | Nếu Payment.Status = SUCCESS thì PaidAt IS NOT NULL. | Payment | CHECK hoặc Service/transaction |
| RB-LTT07 | Nếu Notification.IsRead = TRUE thì ReadAt IS NOT NULL. | Notification | CHECK hoặc Service/transaction |
| RB-LTT08 | Khi Order.Status = CANCELLED, nghiệp vụ phải ghi CancelReason theo quy định hủy. | Order | CHECK hoặc Service/transaction |

> **Bảng 5.26. Ràng buộc liên thuộc tính.**

Tầm ảnh hưởng

| Mã RB | Quan hệ | Thêm | Xóa | Sửa |
| --- | --- | --- | --- | --- |
| RB-LTT01 | OrderItem, Order | + | – | + |
| RB-LTT02 | Order | + | – | + |
| RB-LTT03 | Voucher | + | – | + |
| RB-LTT04 | Voucher | + | – | + |
| RB-LTT05 | Voucher, Shop | + | – | + |
| RB-LTT06 | Payment | + | – | + |
| RB-LTT07 | Notification | + | – | + |
| RB-LTT08 | Order | + | – | + |

> **Bảng 5.27. Tầm ảnh hưởng của ràng buộc liên thuộc tính.**

#### 5.4.5. Ràng buộc liên bộ

| Mã số | Mô tả ràng buộc | Thành phần liên quan | Ghi chú |
| --- | --- | --- | --- |
| RB-LB01 | User.Email duy nhất trong hệ thống nghiệp vụ. | User | UNIQUE hoặc Service |
| RB-LB02 | Shop.OwnerID UNIQUE trong MVP: một tài khoản sở hữu tối đa một Shop. Đây là giả định thiết kế MVP, không phải yêu cầu gốc. | Shop | UNIQUE hoặc Service |
| RB-LB03 | Cart.BuyerID UNIQUE: một Buyer có tối đa một Cart. | Cart | UNIQUE hoặc Service |
| RB-LB04 | UNIQUE(CartID, VariantID): một biến thể chỉ xuất hiện một dòng trong cùng Cart. | Cart | UNIQUE hoặc Service |
| RB-LB05 | Mỗi User có tối đa một Address IsDefault = TRUE. | Address, User | UNIQUE hoặc Service |
| RB-LB06 | Voucher.Code UNIQUE. | Voucher | UNIQUE hoặc Service |
| RB-LB07 | VoucherUsage.OrderID UNIQUE: một Order sử dụng tối đa một voucher. | VoucherUsage, Voucher, Order | UNIQUE hoặc Service |
| RB-LB08 | Shipment.OrderID UNIQUE: một Order có tối đa một Shipment trong MVP. | Shipment, Order | UNIQUE hoặc Service |
| RB-LB09 | Review.OrderItemID UNIQUE: một OrderItem được đánh giá tối đa một lần trong MVP. | OrderItem, Review, Order | UNIQUE hoặc Service |
| RB-LB10 | Mỗi Order có tối đa một Payment có Status = SUCCESS. | Payment, Order | UNIQUE hoặc Service |
| RB-LB11 | SKU duy nhất trong phạm vi Shop. Vì ShopID không nằm trực tiếp trong ProductVariant, Service kiểm tra qua ProductVariant → Product → Shop. | ProductVariant, Product, Shop | UNIQUE hoặc Service |

> **Bảng 5.28. Ràng buộc liên bộ.**

Tầm ảnh hưởng

| Mã RB | Quan hệ | Thêm | Xóa | Sửa |
| --- | --- | --- | --- | --- |
| RB-LB01 | User | + | – | + |
| RB-LB02 | Shop | + | – | + |
| RB-LB03 | Cart | + | – | + |
| RB-LB04 | Cart | + | – | + |
| RB-LB05 | Address, User | + | – | + |
| RB-LB06 | Voucher | + | – | + |
| RB-LB07 | VoucherUsage, Voucher, Order | + | – | + |
| RB-LB08 | Shipment, Order | + | – | + |
| RB-LB09 | OrderItem, Review, Order | + | – | + |
| RB-LB10 | Payment, Order | + | – | + |
| RB-LB11 | ProductVariant, Product, Shop | + | – | + |

> **Bảng 5.29. Tầm ảnh hưởng của ràng buộc liên bộ.**

#### 5.4.6. Ràng buộc liên quan hệ

| Mã số | Mô tả ràng buộc | Thành phần liên quan | Ghi chú |
| --- | --- | --- | --- |
| RB-LQH01 | Order.Subtotal = tổng OrderItem.LineTotal của Order. | OrderItem, Order | Service/transaction |
| RB-LQH02 | Order.TotalAmount = Order.Subtotal + Order.ShippingFee - Order.DiscountAmount. | Order | Service/transaction |
| RB-LQH03 | Nếu Order có VoucherUsage thì VoucherUsage.DiscountAmount = Order.DiscountAmount. Nếu không có VoucherUsage thì Order.DiscountAmount = 0. | VoucherUsage, Voucher, Order | Service/transaction |
| RB-LQH04 | Trong MVP, mỗi Payment của Order thanh toán 100% giá trị đơn: Payment.Amount = Order.TotalAmount. Ràng buộc này cần thay đổi nếu hệ thống mở rộng sang thanh toán từng phần, trả góp hoặc split payment. | Payment, Order | Service/transaction |
| RB-LQH05 | Review chỉ được tạo khi Review.BuyerID = Order.BuyerID của Order chứa OrderItem tương ứng, Review.ProductID phù hợp với OrderItem.ProductID và Order.Status = COMPLETED tại thời điểm tạo Review. Lưu ý cho RB-LQH05: điều kiện COMPLETED chỉ kiểm tra khi tạo Review. Nếu sau đó Admin can thiệp trạng thái đơn theo QLDH-A, Review đã tồn tại không bị xóa hoặc vô hiệu hóa hồi tố trong MVP. | OrderItem, Review, Product, Order | Service/transaction |
| RB-LQH06 | ProductVariant.StockQuantity không được âm sau khi tạo đơn. Số lượng đặt phải <= tồn kho tại thời điểm transaction xác nhận đơn. | ProductVariant, Product | Service/transaction |
| RB-LQH07 | Seller chỉ được cập nhật Product, ProductVariant, Voucher và Order thuộc Shop do mình sở hữu. | ProductVariant, Voucher, Product, Order, Shop | Service/transaction |
| RB-LQH08 | Doanh thu Seller/Admin chỉ được tổng hợp từ các Order thuộc trạng thái hợp lệ/COMPLETED theo quy định báo cáo. | Order | Service/transaction |

> **Bảng 5.30. Ràng buộc liên quan hệ.**

Tầm ảnh hưởng

| Mã RB | Quan hệ | Thêm | Xóa | Sửa |
| --- | --- | --- | --- | --- |
| RB-LQH01 | OrderItem, Order | + | – | + |
| RB-LQH02 | Order | + | – | + |
| RB-LQH03 | VoucherUsage, Voucher, Order | + | – | + |
| RB-LQH04 | Payment, Order | + | – | + |
| RB-LQH05 | OrderItem, Review, Product, Order | + | – | + |
| RB-LQH06 | ProductVariant, Product | + | – | + |
| RB-LQH07 | ProductVariant, Voucher, Product, Order, Shop | + | – | + |
| RB-LQH08 | Order | + | – | + |

> **Bảng 5.31. Tầm ảnh hưởng của ràng buộc liên quan hệ.**

#### 5.4.7. Phân chia ràng buộc giữa Database và Service

Các ràng buộc có thể biểu diễn trực tiếp bằng PK, FK, UNIQUE, CHECK hoặc index được thực thi tại PostgreSQL. Các ràng buộc phụ thuộc nhiều quan hệ, quyền sở hữu, trạng thái hoặc logic nghiệp vụ được kiểm tra tại tầng Service.

Database enforce:

- PK của 22 bảng.

- FK bình thường giữa các bảng.

- UNIQUE Email, Voucher.Code, Cart.BuyerID, Shop.OwnerID trong MVP, VoucherUsage.OrderID, Shipment.OrderID, Review.OrderItemID.

- CHECK Price > 0, StockQuantity >= 0, Rating 1–5, Quantity >= 1 và các miền trạng thái.

- Partial unique index cho một địa chỉ mặc định trên mỗi User.

- Partial unique index cho tối đa một Payment SUCCESS trên mỗi Order.

- Partial unique index cho Payment.TransactionCode khi TransactionCode IS NOT NULL.

Service/transaction enforce:

- Category tối đa hai cấp.

- SKU duy nhất trong phạm vi Shop.

- Tính hợp lệ của ModerationRecord/AdminLog TargetType + TargetID.

- Seller/Buyer chỉ thao tác dữ liệu thuộc quyền sở hữu.

- Chuyển trạng thái Order theo state transition hợp lệ.

- - Order.CancelReason bắt buộc phải có giá trị khi Order.Status chuyển sang CANCELLED (RB-LTT08).

- Điều kiện voucher về thời gian, phạm vi, lượt sử dụng và giá trị đơn.

- Điều kiện tạo Review từ Order đã mua và COMPLETED.

- Kiểm tra giá, tồn kho và trạng thái ProductVariant khi checkout/tạo đơn.

- Order.TotalAmount = Subtotal + ShippingFee - DiscountAmount.

- VoucherUsage.DiscountAmount = Order.DiscountAmount.

Ghi chú về dữ liệu tài chính của Order:

Subtotal, DiscountAmount, ShippingFee và TotalAmount được tính và chốt một lần tại thời điểm tạo Order. OrderItem không hỗ trợ UPDATE nghiệp vụ sau khi Order đã tồn tại. Vì vậy không dùng trigger để liên tục tái tính các giá trị này ở CSDL; tính đúng đắn được kiểm tra một lần trong transaction tạo Order và các trường tài chính được coi là bất biến sau đó.

#### 5.4.8. Một số ràng buộc PostgreSQL tiêu biểu

FK Supabase Auth:

user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT

Mỗi User tối đa một địa chỉ mặc định:

CREATE UNIQUE INDEX one_default_address_per_user

ON address(user_id)

WHERE is_default = TRUE;

Mỗi Order tối đa một Payment SUCCESS:

CREATE UNIQUE INDEX one_success_payment_per_order

ON payment(order_id)

WHERE status = 'SUCCESS';

Mã giao dịch Payment duy nhất khi có giá trị:

-- Mã giao dịch thanh toán chỉ cần unique khi có giá trị (COD không có)

CREATE UNIQUE INDEX uq_payment_transaction_code

ON payment(transaction_code)

WHERE transaction_code IS NOT NULL;

-- Mã vận đơn chỉ cần unique khi đã phát sinh

CREATE UNIQUE INDEX uq_shipment_tracking_code

ON shipment(tracking_code)

WHERE tracking_code IS NOT NULL;

Mỗi Order tối đa một VoucherUsage:

ALTER TABLE voucher_usage

ADD CONSTRAINT uq_voucher_usage_order UNIQUE(order_id);

> [Hình ảnh/đồ họa trong DOCX gốc - xem file nguồn]

> **Hình 5.29. Vòng đời và chuyển trạng thái đơn hàng.**

#### 5.4.9. Transaction tạo đơn

> [Hình ảnh/đồ họa trong DOCX gốc - xem file nguồn]

> **Hình 5.30. Quy trình transaction tạo đơn.**

Quá trình tạo Order phải thực hiện trong một transaction để bảo đảm yêu cầu nhất quán dữ liệu:

1. Kiểm tra ProductVariant còn hoạt động.

2. Kiểm tra giá và tồn kho hiện tại.

3. Kiểm tra voucher nếu có.

4. Tính Subtotal, DiscountAmount, ShippingFee và TotalAmount.

5. Tạo Order theo từng Shop.

6. Tạo OrderItem và lưu snapshot tên/biến thể/giá.

7. Tạo VoucherUsage nếu áp dụng voucher.

8. Trừ/giữ tồn kho tương ứng.

9. Tạo OrderStatusHistory ban đầu.

10. Tạo Payment ban đầu theo phương thức đã chọn.

11. Tạo Notification cho Buyer/Seller.

12. COMMIT nếu toàn bộ bước thành công; nếu một bước lỗi phải ROLLBACK toàn bộ.

Transaction tránh các trạng thái không nhất quán như có Order nhưng thiếu OrderItem, đã trừ tồn kho nhưng tạo Order thất bại, hoặc VoucherUsage không khớp DiscountAmount.

#### 5.4.10. Chỉ mục tra cứu đề xuất

Để đáp ứng yêu cầu tìm kiếm/lọc và mục tiêu hiệu năng của đồ án, đề xuất index trên các trường thường truy vấn:

- User.Email.

- Product.ProductName, Product.ShopID, Product.CategoryID.

- ProductVariant.SKU.

- Order.BuyerID, Order.ShopID, Order.Status, Order.CreatedAt.

- Payment.OrderID.

- Shipment.OrderID, Shipment.TrackingCode.

- Voucher.Code.

- Review.ProductID, Review.Rating.

- Notification.RecipientID, Notification.IsRead.

- AdminLog.AdminID, AdminLog.CreatedAt.

#### 5.4.11. Lưu trữ media

CSDL PostgreSQL chỉ lưu URL/metadata của file. Avatar, logo shop, ảnh sản phẩm và ảnh đánh giá được lưu trong Supabase Storage thông qua các trường AvatarURL, LogoURL và ImageURL. Không lưu binary image trực tiếp trong các bảng nghiệp vụ.

#### 5.4.12. Đối chiếu với các quy định nghiệp vụ QD01–QD20

- QD01 → User.Email UNIQUE.

- QD02 → Supabase Auth quản lý mật khẩu; không lưu plaintext trong CSDL nghiệp vụ.

- QD03 → User.Status và kiểm tra tại Auth/Service.

- QD04 → Shop.OwnerID và kiểm tra ownership tại Service/RBAC.

- QD05 → ProductVariant.Price > 0.

- QD06 → ProductVariant.StockQuantity >= 0.

- QD07 → kiểm tra tồn kho trong transaction tạo đơn.

- QD08 → OrderItem.UnitPrice/ProductNameSnapshot/VariantSnapshot.

- QD09 → Voucher + VoucherUsage + kiểm tra điều kiện tại Service.

- QD10 → Order.TotalAmount >= 0.

- QD11 → state transition + OrderStatusHistory.

- QD12 → Buyer hủy Order theo trạng thái cho phép và lưu CancelReason.

- QD13 → Seller chỉ xử lý Order thuộc Shop của mình.

- QD14 → Review liên kết OrderItem và kiểm tra Order COMPLETED tại thời điểm tạo.

- QD15 → Review.Rating từ 1 đến 5.

- QD16 → Product/Shop/User dùng Status, hạn chế xóa vật lý dữ liệu đã phát sinh giao dịch.

- QD17 → ModerationRecord.Reason/AdminLog.Reason.

- QD18 → Payment không lưu thông tin thẻ ngân hàng thật.

- QD19 → báo cáo doanh thu chỉ tổng hợp Order hợp lệ/COMPLETED.

- QD20 → AdminLog lưu thao tác quản trị quan trọng.

Với các ràng buộc trên, toàn bộ QD01–QD20 đều có cấu trúc dữ liệu hoặc cơ chế kiểm soát tương ứng trong Schema Freeze v1.

## 6. CÁC LUỒNG NGHIỆP VỤ TRỌNG TÂM CẦN ƯU TIÊN KHI PHÁT TRIỂN

### 6.1. Luồng mua hàng

Xem sản phẩm → Chọn biến thể → Thêm giỏ → Chọn sản phẩm → Checkout → Địa chỉ → Voucher → Thanh toán → Xác nhận → Tạo đơn

### 6.2. Luồng xử lý đơn

Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đang giao → Hoàn thành

### 6.3. Luồng quản lý sản phẩm

Tạo sản phẩm → Nhập thông tin → Tạo biến thể → Nhập giá/tồn → Đăng bán → Cập nhật → Ngừng bán

### 6.4. Luồng đánh giá

Đơn hoàn thành → Buyer chọn sản phẩm → Chấm 1-5 sao → Viết nhận xét → Gửi đánh giá → Hiển thị

### 6.5. Luồng xử lý vi phạm

Admin phát hiện/nhận báo cáo → Xem đối tượng → Xác minh → Ghi lý do → Ẩn/khóa → Lưu lịch sử

## 7. ĐỀ XUẤT PHẠM VI MVP CHO ĐỒ ÁN MÔN HỌC

Để tránh phạm vi quá lớn, nhóm nên hoàn thành chắc chắn các module sau trước:

- Authentication + phân quyền.

- Buyer xem/tìm/lọc sản phẩm.

- Seller quản lý shop và sản phẩm.

- Giỏ hàng.

- Checkout và tạo đơn.

- Seller xử lý đơn.

- Buyer theo dõi đơn.

- Thanh toán COD + online mô phỏng.

- Voucher cơ bản.

- Đánh giá sản phẩm.

- Admin quản lý user/shop/category/product.

- Báo cáo cơ bản.

Các chức năng chat realtime, yêu thích, hoàn trả/hoàn tiền nâng cao, gợi ý AI, livestream, ví điện tử thật nên để ở phần mở rộng nếu còn thời gian.

## 8. KẾT LUẬN

Hệ thống thương mại điện tử trong đồ án được xác định là một sàn thương mại điện tử đa người bán với bốn nhóm quyền chính: Guest, Buyer, Seller và Admin. Trọng tâm của phần mềm là quản lý chính xác vòng đời sản phẩm và đơn hàng, đảm bảo phân quyền dữ liệu giữa các shop, kiểm soát tồn kho, tính toán giá trị đơn/voucher, theo dõi trạng thái thanh toán và vận chuyển và cung cấp báo cáo phù hợp cho người bán và quản trị viên.

Tài liệu này có thể được sử dụng làm đầu vào cho các bước tiếp theo của môn Công nghệ phần mềm như: đặc tả use case, sơ đồ use case, activity diagram, sequence diagram, thiết kế cơ sở dữ liệu, thiết kế giao diện, lập kế hoạch sprint và kiểm th

## 9. TECH STACK ĐỀ XUẤT

Bảng dưới đây tổng hợp công nghệ được sử dụng để triển khai hệ thống thương mại điện tử đa người bán.

| Tầng / Thành phần | Công nghệ | Vai trò trong hệ thống |
| --- | --- | --- |
| Ngôn ngữ | TypeScript | Ngôn ngữ chính cho frontend và backend |
| Frontend | Next.js + React | Xây dựng Storefront, Buyer, Seller Center và Admin Portal |
| UI / Styling | Tailwind CSS + shadcn/ui + Lucide | Thiết kế giao diện responsive, component dùng lại và icon |
| Form / Validation | React Hook Form + Zod | Xử lý biểu mẫu và kiểm tra dữ liệu ở client/server |
| Backend | Node.js + Payload CMS | Cung cấp REST API, xử lý nghiệp vụ, validation, phân quyền/RBAC và luồng checkout/order |
| Authentication | Supabase Auth | Đăng ký, đăng nhập, quản lý phiên và xác thực người dùng |
| Database | Supabase PostgreSQL | Lưu dữ liệu nghiệp vụ: shop, product, cart, order, voucher, review... |
| Authorization | Supabase RLS + Server-side RBAC | Giới hạn truy cập theo Buyer, Seller, Admin và quyền sở hữu dữ liệu |
| File Storage | Supabase Storage | Lưu avatar, logo shop, ảnh sản phẩm và ảnh đánh giá |
| CMS | Payload CMS | Quản lý banner, campaign, trang nội dung, FAQ và nội dung marketing |
| Testing | Vitest + Playwright | Unit test, integration test và end-to-end test |
| Deployment / CI | Vercel + GitHub + GitHub Actions | Deploy ứng dụng, quản lý source code và CI/CD |

---

Bản đầy đủ dạng gốc: [`Nhom04_ThietKeDuLieu.docx`](../../Nhom04_ThietKeDuLieu.docx).
