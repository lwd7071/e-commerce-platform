# Rà soát báo cáo thiết kế giao diện — phần đầu đến hết mục 2

- Người phụ trách phần rà soát: Nông Văn Cường.
- Ngày đối chiếu: 04/10/2026.
- Tài liệu: [Nhom04_ThietKeGiaoDien_chinh_sua](https://docs.google.com/document/d/12v9DQasEBFDaPg1HI5qLnAMmONor26ZnsuasEZrc26o/edit).
- Baseline: `dev` và `origin/dev` cùng commit `790a65e299e69c9036654d1a0c24646f74238850` — `docs(test-mvp): add second test round plan`. Đã fetch và kiểm tra checkout sạch trước khi rà soát.
- Phạm vi: bìa, mục lục, lời giới thiệu, chương 1 và toàn bộ chương 2; không rà soát chương 3 trở đi.

## Kết quả chung

Tài liệu có thể giữ làm nền tảng yêu cầu và thiết kế, nhưng cần cập nhật các mô tả MVP cũ và phân biệt yêu cầu dự kiến với hành vi đã có trong code. Hiện không đủ cơ sở để coi toàn bộ các biểu mẫu/chức năng liệt kê là đã triển khai hoặc đã nghiệm thu.

Các điểm cần ưu tiên sửa là thanh toán PayOS, địa chỉ và báo phí vận chuyển, trạng thái đơn hàng, phạm vi báo cáo vi phạm, chức năng mua lại và các phần mở rộng đang thiếu trong yêu cầu. Không suy ra một chức năng đã chạy thực tế chỉ từ việc có route hoặc service.

## Các nội dung cần chỉnh

| Vị trí trong tài liệu | Nội dung cần chỉnh | Đề xuất |
| --- | --- | --- |
| Lời giới thiệu: phạm vi và ngoài phạm vi; 1.1.7; 2.1.6; 2.3 | Chỉ mô tả thanh toán online mô phỏng hoặc không kết nối thật. Runtime đã gắn API PayOS tạo liên kết và xử lý webhook. | Ghi COD và tích hợp PayOS ở mức code/API; phân biệt môi trường/cấu hình thanh toán. Chưa khẳng định giao dịch thực tế đã được nghiệm thu nếu chưa có bằng chứng test. |
| Lời giới thiệu; 1.1.8; 2.1.7 | Mô tả vận chuyển chỉ có phí cố định/mô phỏng, bỏ sót báo phí GHTK. | Phân biệt báo phí GHTK hoặc mock với luồng giao hàng vẫn mô phỏng. Không ghi đã tạo vận đơn thật, đồng bộ trạng thái hãng hoặc theo dõi vị trí realtime. |
| 1.2.1; các biểu mẫu địa chỉ; 2.1.4; 2.1.7 | Địa chỉ bắt buộc tỉnh/quận/phường không khớp luồng địa chỉ mới đã duyệt. | Địa chỉ mới dùng danh mục tỉnh/phường hai cấp và địa chỉ chi tiết; dữ liệu quận cũ phục vụ tương thích lịch sử. Bổ sung địa chỉ lấy hàng của Shop, trọng lượng sản phẩm và báo phí theo từng Shop. |
| 1.1.6 và bảng trạng thái trong mục 2 | Chuỗi trạng thái dùng `PENDING`; `DELIVERY_FAILED` chỉ được mô tả là mở rộng. | Dùng đúng mã `PENDING_CONFIRMATION → CONFIRMED → PREPARING → SHIPPING → COMPLETED`; bổ sung nhánh hủy hợp lệ và `SHIPPING → DELIVERY_FAILED`. Không cho chuyển tùy ý. |
| 2.1.1; QD01 | Đăng ký/đăng nhập email hoặc username; ghi chú chỉ đăng ký Buyer. | Luồng auth live dùng email/Supabase. Onboarding hỗ trợ BUYER hoặc SELLER, Seller tạo Shop `PENDING`; không mô tả username là định danh đăng nhập đã có. |
| Luồng Seller; 2.1.9; 2.1.15; quy định Shop | Thiếu bước duyệt Shop mới. | Bổ sung Shop chờ duyệt và các thao tác Admin theo contract hiện hành; đăng ký Seller không đồng nghĩa Shop được hoạt động ngay. |
| 2.1.2 | Danh sách bộ lọc có Shop và điểm đánh giá; sắp xếp bán chạy. | API catalog hiện nhận category/search/min_price/max_price/sort/limit/cursor/shop_tier. Bộ lọc Shop, rating hoặc sort bán chạy phải ghi dự kiến nếu chưa có API/UI tương ứng. Bổ sung lọc hạng Shop. |
| 2.1.4 | Ghi đơn “có thể” tách theo Shop. | Ghi checkout nhóm các sản phẩm được chọn theo Shop, tạo đơn và báo phí riêng theo Shop; giá/phí/tồn kho phải do backend kiểm tra lại. |
| 2.1.5 | “Mua lại” dễ được hiểu là thêm lại sản phẩm của đơn cũ vào giỏ. | Nút hiện tại chỉ dẫn tới `/products`; ghi đúng hành vi này hoặc đánh dấu mua lại tự động là chưa triển khai. |
| 2.1.8; 2.1.17 | Sửa/xóa đánh giá của Buyer và báo cáo vi phạm dễ bị hiểu là tính năng đã có. | Runtime Buyer có tạo và đọc đánh giá; chưa thấy route sửa/xóa đánh giá riêng của Buyer trong router đã kiểm tra. CR Admin đã duyệt loại luồng người dùng gửi báo cáo vi phạm khỏi MVP. Admin moderation là chức năng riêng, không phải bằng chứng đã có user report. |
| 2.1.10 | Biểu mẫu sản phẩm thiếu trọng lượng. | Thêm `weight_grams` dương vào tạo/sửa sản phẩm để báo phí; giá trị tương thích migration 200g không phải trọng lượng đã đo. |
| 1.2.3; 2.1.13; 2.1.19; QD19 | “Đơn hợp lệ” trong công thức doanh thu chưa rõ. | Định nghĩa rõ đơn `COMPLETED`, công thức tổng và mốc thời gian của từng báo cáo. CR Admin chốt GMV/top theo ngày hoàn tất, timezone `Asia/Ho_Chi_Minh`; không dùng chung một định nghĩa mơ hồ cho tất cả màn hình. |
| QD07; 2.3; 2.4 | Kiểm tra tồn tại thời điểm xác nhận và transaction chỉ mang tính khuyến nghị. | Tồn kho được kiểm tra/khóa trong checkout; cập nhật đơn, tồn, voucher và dữ liệu liên quan cần transaction theo luồng thực tế. Các thao tác Admin nhạy cảm phải có reason và audit nguyên tử. |
| 2.3.1 | Ma trận quyền gom nhiều thao tác trong cùng dòng. | Tách Buyer tạo review, Admin moderation review; Seller quản lý Shop sở hữu, Admin duyệt/khóa/đổi tier. Có quyền truy cập không thay thế kiểm tra ownership/status ở backend. |
| Lời giới thiệu; 2.4 | Chat/thanh toán thật được mô tả hoàn toàn là khả năng mở rộng trong tương lai. | Đã có module Chat và PayOS; cập nhật trạng thái từng phần. Chưa ghi Shop online/offline, realtime, tự động thông báo hay hiệu quả giảm 70% nếu chưa có code và bằng chứng đo. |
| Bìa; mục lục; tiêu đề và biểu mẫu chương 2 | Có hai khối bìa; thiếu tiêu đề tương ứng 2.1.1, 2.1.4, 2.1.12, 2.1.13, 2.1.19 trong nội dung export; tiêu đề “người dùn” bị tách chữ `g`. | Kiểm tra có chủ ý dùng bìa ngoài/bìa trong hay không; bổ sung heading thật, thống nhất numbering và cập nhật mục lục. Khi xuất Markdown, danh sách cột trong ô biểu mẫu cần dùng dấu phẩy hoặc escape `\|` để bảng không vỡ. |

Các chức năng nằm trong bảng khảo sát nhu cầu vẫn có thể giữ dưới dạng yêu cầu dự kiến. Chỉ cần gắn nhãn rõ; không nên xóa nhu cầu chỉ vì chưa có code. Riêng phạm vi đã bị CR Approved loại trừ cần cập nhật cho thống nhất.

## Nội dung có thể dùng để sửa trực tiếp

### Phạm vi thanh toán và vận chuyển

> Hệ thống hỗ trợ thanh toán COD và có tích hợp PayOS để tạo liên kết thanh toán, tiếp nhận webhook và cập nhật dữ liệu thanh toán/đơn hàng. Việc nghiệm thu giao dịch thực tế phụ thuộc cấu hình môi trường và kết quả kiểm thử. Vận chuyển hỗ trợ danh mục tỉnh/phường, trọng lượng sản phẩm và báo phí theo từng Shop bằng GHTK hoặc provider mock; luồng bàn giao và giao hàng hiện mô phỏng, chưa đồng nghĩa tích hợp tạo vận đơn hoặc đồng bộ trạng thái hãng vận chuyển thực tế.

### Luồng tài khoản và Shop

> Người dùng đăng ký bằng email qua Supabase Auth và hoàn tất onboarding với vai trò Buyer hoặc Seller. Seller mới có Shop ở trạng thái chờ duyệt; quyền vận hành phụ thuộc trạng thái Shop và kiểm tra ownership. Admin thực hiện các thao tác quản trị được cấp quyền, có lý do và nhật ký theo quy định của từng thao tác.

### Quy định đơn hàng

> Đơn hàng sử dụng state machine với các mã PENDING_CONFIRMATION, CONFIRMED, PREPARING, SHIPPING, COMPLETED, CANCELLED và DELIVERY_FAILED. Chỉ các chuyển trạng thái hợp lệ mới được phép; Buyer, Seller và Admin có điều kiện thao tác riêng. Việc hoàn tất đơn cần tuân thủ điều kiện Shipment và reason theo contract hiện hành; không suy ra Seller có quyền tự hoàn tất đơn.

### Bổ sung nhóm yêu cầu phân hạng và điểm

> Hệ thống quản lý hạng Shop STANDARD/PREFERRED/MALL, huy hiệu và bộ lọc hạng trong catalog; Admin có thể đổi hạng kèm lý do. Code có bộ đánh giá Shop theo tiêu chí và endpoint Admin kích hoạt đánh giá; không mặc định coi đây là job chạy định kỳ. Catalog có thứ tự ưu tiên hạng trong nhánh sắp xếp mặc định. Buyer có hạng STANDARD/VIP, tổng chi tiêu, DinoPoint và lịch sử ledger; khi đơn hoàn tất hợp lệ, hệ thống ghi nhận chi tiêu/điểm và cập nhật hạng trong transaction, chống thưởng trùng. API hiện công bố ngưỡng VIP 5.000.000 đồng, không phải 50.000.000 đồng. Đổi thưởng và thu hồi điểm cần ghi riêng là phần chưa triển khai/đợi chốt nếu chưa có contract và code tương ứng.

### Bổ sung các nhóm yêu cầu mở rộng

> Thêm nhóm yêu cầu riêng cho ví Seller/escrow/PayOS, Chat AI và hand-off Seller, Flash Sale và Tiering & Loyalty. Mỗi nhóm cần nêu tác nhân, chức năng, quy tắc, dữ liệu đầu vào/đầu ra và trạng thái thực hiện. Owner của từng feature xác nhận chi tiết nghiệp vụ và nghiệm thu; sự tồn tại của module không chứng minh đã hoàn thành mọi yêu cầu mở rộng.

## Nguồn đối chiếu code và quyết định đã duyệt

Các liên kết dưới đây cố định theo commit đã rà soát, thuận tiện gửi cho nhóm:

- [Runtime wiring](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/platform/http/app.ts): PayOS, wallet, Chat, Flash Sale và loyalty được gắn vào ứng dụng.
- [Auth frontend](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/frontend/src/lib/auth/auth-context.tsx#L149) và [onboarding](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/modules/identity/services/pg-onboarding.service.ts#L103).
- [Order state machine](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/modules/order/domain/order-state-machine.ts#L5) và [checkout](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/modules/checkout/services/pg-checkout.service.ts#L132).
- [PayOS routes](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/platform/http/routes/payos-payment-routes.ts#L21).
- [CR Shipping Approved](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/docs/spec/changes/CR-SHIPPING-01-ghtk-fee-and-simulated-fulfillment.md): địa chỉ hai cấp, quote, trọng lượng và giao hàng mô phỏng.
- [Catalog allowlist](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/platform/http/routes/t1-routes.ts#L107) và [thứ tự catalog](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/modules/catalog/repositories/pg-catalog.repository.ts#L425).
- [Nút Mua lại](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/frontend/src/features/orders/order-card.tsx#L205) và [Buyer review routes](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/platform/http/routes/buyer-routes.ts#L373).
- [CR Admin Approved](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/docs/spec/changes/CR-ADMIN-01-admin-portal-completion.md): phạm vi moderation, báo cáo, audit, thông báo nội bộ.
- [Loyalty transaction](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/modules/loyalty/services/loyalty.service.ts#L68), [ngưỡng VIP](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/modules/loyalty/services/loyalty.service.ts#L129), [Shop evaluator](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/modules/shop/services/shop-tier-evaluation.service.ts), [Admin evaluate route](https://github.com/lwd7071/e-commerce-platform/blob/790a65e299e69c9036654d1a0c24646f74238850/backend/src/platform/http/routes/admin-routes.ts#L376).

## Kiểm chứng và phần cần phối hợp

- Đã đọc bản export Markdown của Google Docs từ đầu đến hết mục 2 và đối chiếu trực tiếp source/CR tại baseline trên.
- Không chạy test, build, benchmark, migration hoặc giao dịch PayOS/GHTK thực tế trong lần review tài liệu này. Các mục tiêu tốc độ, bảo mật, tải và tương thích trình duyệt là tiêu chí nghiệm thu; chưa có kết quả đo trong lần rà soát này.
- Đã kiểm tra bridge Codex with ChatGPT bằng doctor; session hiện chưa có Project/chat được ghép với workspace. Chưa thực hiện review độc lập qua ChatGPT Web, không ghi nhận workflow chung đã hoàn tất.
- Owner Shipping xác nhận cấu hình provider và kết quả test; owner Wallet xác nhận PayOS/escrow/settle/refund; owner Chat xác nhận cập nhật tin nhắn và thông báo; owner Flash Sale xác nhận scheduler và kiểm thử. Chi tiết các feature này vượt phạm vi rà soát chương 1–2.
- Chỉ tạo file review này; chưa sửa code, Google Docs, commit/push hoặc gửi tin nhắn vào nhóm.
