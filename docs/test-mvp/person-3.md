# Tiến độ — Người 3: Catalog, Quản lý Sản phẩm Người bán & Chat AI/Live Chat

Phạm vi: Quản lý danh mục & sản phẩm Catalog công khai → Chi tiết sản phẩm & Đánh giá thực tế → Quản lý sản phẩm Người bán (Tạo/Sửa sản phẩm, biến thể, giá bán, tồn kho, khóa đồng bộ Shop chống trùng SKU) → Bật/tắt hiển thị sản phẩm → Chat Hybrid Buyer-Seller kết hợp Trợ lý AI và Live Chat (Short-polling 4s, Handoff, Hiện diện Online/Offline). Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md) (Mục 3, 4) và [04-chat-ai-live-chat.md](../feature/04-chat-ai-live-chat.md).

## Tóm tắt

- Trạng thái: Đã xác minh
- Cập nhật gần nhất: 2026-10-03
- Luồng đã hoàn tất: 8 / 8 luồng
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Lỗi đã phát hiện và đã sửa dứt điểm:
  1. *[Lỗi Cao — Concurrency SKU per Shop (RB-LB11)]* Trong `updateSellerProduct`, transaction chỉ khóa product đang sửa (`SELECT ... FROM products WHERE product_id = $1 FOR UPDATE`) mà không khóa Shop, dẫn tới nguy cơ 2 request sửa 2 sản phẩm khác nhau trong cùng Shop có thể cùng vượt qua kiểm tra và lưu SKU trùng nhau. Đã khắc phục triệt để bằng cách bổ sung khóa hàng gian hàng `SELECT shop_id FROM shops WHERE shop_id = $1 FOR UPDATE` ngay đầu transaction cập nhật, đồng bộ hóa 100% với luồng tạo sản phẩm.
  2. *[Lỗi Thấp — Variant Price Validation (QD05)]* Luồng tạo sản phẩm chỉ kiểm tra `Number(price) > 0`, khiến các giá trị như `0.001` (bị làm tròn thành 0.00 ở DB) hoặc ký pháp khoa học `1e-5` có thể lọt qua validation gây lỗi DB constraint. Đã đồng bộ với luồng cập nhật, áp dụng regex định dạng thập phân `decimal = /^\d+(\.\d{1,2})?$/` và `Number(price) > 0` để trả về lỗi validation 422 chuẩn mực.
  3. *[Lỗi Vừa — Shop Online/Offline Presence API & Chat Integration]* Trạng thái Shop Online/Offline trước đó chỉ nằm trong state cục bộ của Seller Inbox, chưa lưu qua API và phía Buyer không nhận diện được. Đã xây dựng trọn vẹn API `GET/PUT /api/v1/chat/shops/:shopId/presence`, migration bảng `shop_chat_presence` có bật RLS, đồng bộ trạng thái sang Buyer ChatWidget và kích hoạt bot tự động phản hồi thông báo offline khi Shop vắng mặt.
  4. *[Tài liệu & Bằng chứng — RLS và Integration Test]* Chuẩn hóa báo cáo: Migration bật RLS và `REVOKE ALL` từ public/anon để bảo vệ dữ liệu ở mức DB; toàn bộ chính sách Access Control phân quyền được thực thi và kiểm thử tự động tại tầng Application Service Guard (`assertConversationAccess`).
- Trở ngại/quyết định cần hỗ trợ: Không có. Toàn bộ 8 luồng Người 3 đã pass 100% quality gates (16 backend chat tests + 41 catalog tests + 7 frontend chat vitest tests, 0 lint warnings).

## Nhật ký kiểm thử và lỗi

### [TC-CAT-01] Quản lý & Khám phá Danh mục Catalog (RB-KN04 & Cursor Pagination)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: GUEST / BUYER / SELLER
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & RB-KN04
- Điều kiện ban đầu: CSDL có cây danh mục sản phẩm (cấp 1 và cấp 2).
- Các bước thực hiện:
  1. Người dùng truy cập danh sách danh mục `GET /api/v1/categories`.
  2. Kiểm tra cây danh mục tuân thủ tối đa 2 cấp (không có cấp 3, chống chu trình cha-con).
  3. Duyệt danh sách sản phẩm `GET /api/v1/products` với các bộ lọc: `category_id`, khoảng giá `min_price`/`max_price`, `shop_tier` và phân trang cursor.
- Kết quả mong đợi: Trả về danh sách danh mục chuẩn và sản phẩm phân trang chính xác; từ chối cursor không hợp lệ bằng 422.
- Kết quả thực tế: Hoạt động chính xác theo thiết kế.
- Bằng chứng: `backend/test/modules/catalog/catalog-hardening.spec.ts` (Section 5 & 6).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-CAT-02] Chi tiết Sản phẩm & Đánh giá Thực tế (Product Detail & Real Reviews)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: GUEST / BUYER
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & C-205, B-105
- Điều kiện ban đầu: Sản phẩm tồn tại kèm danh sách biến thể, gallery ảnh và đánh giá từ người mua trước.
- Các bước thực hiện:
  1. Mở trang chi tiết sản phẩm `GET /api/v1/products/:id` hoặc giao diện `ProductDetailScreen`.
  2. Kiểm tra hiển thị gallery ảnh với `next/image` alt text chuẩn SEO.
  3. Kiểm tra aggregate rating và danh sách bình luận được truy vấn trực tiếp từ `reviewRepository` (hiển thị empty state khi chưa có đánh giá, không fallback 5 sao giả).
- Kết quả mong đợi: Hiển thị đầy đủ thông tin sản phẩm, biến thể, hình ảnh và đánh giá thực tế.
- Kết quả thực tế: Đạt 100% yêu cầu.
- Bằng chứng: `frontend/src/features/catalog/product-detail-screen.tsx`, `backend/test/platform/t1-route-contracts.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-01] Người bán Tạo Sản phẩm & Biến thể (QD05, QD06, RB-LB11)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: SELLER (shop owner hợp lệ)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & QD05, QD06, RB-LB11
- Điều kiện ban đầu: Shop người bán đang ở trạng thái `ACTIVE`.
- Các bước thực hiện:
  1. Người bán gửi `POST /api/v1/products` với thông tin tên, mô tả, danh mục, mảng variants (SKU, giá bán, tồn kho).
  2. Thử nhập giá bán không hợp lệ (`0`, `-5000`, `0.001`, `1e-5`, chữ `abc`) $\rightarrow$ Kiểm tra chặn bằng 422 VALIDATION_FAILED (QD05).
  3. Thử nhập tồn kho âm hoặc số thập phân (`-1`, `2.5`) $\rightarrow$ Kiểm tra chặn bằng 422 STOCK_INVALID (QD06).
  4. Thử gửi 2 biến thể trùng SKU trong cùng payload $\rightarrow$ Kiểm tra chặn bằng 409 SKU_CONFLICT (RB-LB11).
- Kết quả mong đợi: Chỉ chấp nhận biến thể có giá thập phân dương tối đa 2 chữ số, tồn kho nguyên không âm, và SKU duy nhất.
- Kết quả thực tế: Đã sửa dứt điểm và kiểm tra tự động thành công.
- Bằng chứng: `backend/src/modules/catalog/services/pg-catalog-http.service.ts` (lines 170-192), `backend/test/modules/catalog/product-variant.spec.ts`.
- Mức độ: Đã sửa (Lỗi Thấp).
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-02] Cập nhật Sản phẩm & Khóa Đồng bộ Shop (RB-LB11 Concurrency Fix)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: SELLER
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & RB-LB11
- Điều kiện ban đầu: Shop có ít nhất 2 sản phẩm khác nhau.
- Các bước thực hiện:
  1. Gọi `PUT /seller/products/:id` để cập nhật thông tin và biến thể.
  2. Transaction thực thi `SELECT shop_id FROM shops WHERE shop_id = $1 FOR UPDATE` để khóa hàng gian hàng.
  3. Kiểm tra trường hợp 2 transaction chạy đồng thời cập nhật 2 sản phẩm khác nhau trong cùng Shop: Transaction thứ 2 bắt buộc phải chờ transaction thứ nhất hoàn tất, ngăn chặn triệt để tình huống cùng pass kiểm tra và lưu trùng SKU trong Shop.
- Kết quả mong đợi: Đảm bảo tính tuần tự hóa (serialization) và bất biến duy nhất của SKU trong phạm vi từng Shop.
- Kết quả thực tế: Đã thêm khóa đồng bộ Shop và chạy kiểm thử thành công.
- Bằng chứng: `backend/src/modules/catalog/services/pg-catalog-http.service.ts` (lines 548-555).
- Mức độ: Đã sửa (Lỗi Cao).
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-03] Bật/Tắt Hiển thị Sản phẩm (QD16 & Shop Ownership Guard)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: SELLER
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & QD16, QD04
- Điều kiện ban đầu: Sản phẩm thuộc sở hữu của Shop đang đăng nhập.
- Các bước thực hiện:
  1. Người bán nhấn nút Ẩn/Hiện trên màn hình `SellerProductsScreen` hoặc gọi `PATCH /api/v1/seller/products/:id/status`.
  2. Chuyển đổi trạng thái giữa `ACTIVE` và `INACTIVE`.
  3. Thử dùng tài khoản Seller khác cố tình đổi trạng thái sản phẩm $\rightarrow$ Kiểm tra chặn 403 RESOURCE_FORBIDDEN.
- Kết quả mong đợi: Trạng thái sản phẩm được cập nhật an toàn; chặn triệt để truy cập chéo gian hàng.
- Kết quả thực tế: Hoạt động chính xác theo thiết kế.
- Bằng chứng: `frontend/e2e/seller-product-flow.spec.ts`, `backend/test/platform/t1-route-contracts.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-CHT-01] Trợ lý AI Sản phẩm Tự động (Grounded Assistant & Whitelist Permissions)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: BUYER
- Quy tắc tham chiếu: 04-chat-ai-live-chat.md & Feature 4
- Điều kiện ban đầu: Khách mở ChatWidget từ trang chi tiết sản phẩm.
- Các bước thực hiện:
  1. Khách hỏi về số lượng tồn kho của biến thể $\rightarrow$ Bot tra cứu kho thời gian thực và phản hồi chính xác số lượng.
  2. Khách hỏi về giá $\rightarrow$ Bot báo khoảng giá min-max chính xác từ CSDL.
  3. Khách hỏi thông tin không có trong mô tả hoặc Seller tắt cờ quyền `allow_stock` $\rightarrow$ Bot từ chối suy đoán (Anti-hallucination) và mời kết nối Người bán.
  4. Mọi câu trả lời của bot đều gắn nhãn rõ ràng `[Trả lời tự động từ Bot]`.
- Kết quả mong đợi: Phản hồi chính xác dựa trên dữ liệu thật, không bịa đặt thông tin.
- Kết quả thực tế: Đạt 100% yêu cầu.
- Bằng chứng: `backend/test/platform/chat-routes.spec.ts` (BotGroundedEngine suite 9/9 tests).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-CHT-02] Live Chat & Đồng bộ Hai chiều (Short-Polling & Hand-off)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: BUYER & SELLER
- Quy tắc tham chiếu: 04-chat-ai-live-chat.md & Feature 4
- Điều kiện ban đầu: Cuộc hội thoại đang mở ở cả Buyer ChatWidget và Seller Inbox.
- Các bước thực hiện:
  1. Buyer bấm nút "Gặp Shop" $\rightarrow$ Kích hoạt `POST /chat/conversations/:id/handoff`, hội thoại chuyển sang chế độ `LIVE_AGENT`.
  2. Buyer gửi tin nhắn mới $\rightarrow$ Seller Inbox tự động cập nhật tin nhắn sau chu kỳ Short-Polling 4 giây mà không cần F5.
  3. Seller nhập và gửi phản hồi $\rightarrow$ Buyer ChatWidget tự động hiển thị phản hồi sau chu kỳ Short-Polling 4 giây.
  4. Lịch sử tin nhắn được lưu trữ an toàn trong bảng `chat_messages` với `client_message_id` chống trùng.
- Kết quả mong đợi: Tin nhắn hai chiều đồng bộ liên tục, mượt mà và không gián đoạn.
- Kết quả thực tế: Đạt 100% yêu cầu.
- Bằng chứng: `frontend/test/chat-widget.spec.tsx`, `frontend/test/seller-chat-inbox.spec.tsx`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-CHT-03] Quản lý Trạng thái Hiện diện Shop (Online/Offline Presence API)
- Trạng thái: Đã xác minh
- Người thực hiện: thangdanglk-ui (Người 3)
- Ngày cập nhật: 2026-10-03
- Role và tài khoản/dữ liệu test: SELLER & BUYER
- Quy tắc tham chiếu: 04-chat-ai-live-chat.md & Feature 4
- Điều kiện ban đầu: Seller mở màn hình `/seller/chat`.
- Các bước thực hiện:
  1. Seller bấm nút chuyển trạng thái sang `Shop Tạm Vắng (Offline)` $\rightarrow$ Frontend gọi `PUT /api/v1/chat/shops/:shopId/presence` lưu vào bảng `shop_chat_presence`.
  2. Buyer mở ChatWidget $\rightarrow$ Gọi `GET /api/v1/chat/shops/:shopId/presence`, widget hiển thị trạng thái `Người Bán (Tạm vắng)` kèm banner cảnh báo Shop ngoại tuyến.
  3. Buyer gửi tin nhắn hoặc kích hoạt Hand-off khi Shop offline $\rightarrow$ Hệ thống lập tức phản hồi tự động thông báo Shop hiện đang vắng mặt và tin nhắn đã được lưu vào hàng đợi.
- Kết quả mong đợi: Trạng thái hiện diện được lưu trữ qua API thực tế và phản hồi chính xác cho người mua khi shop offline.
- Kết quả thực tế: Đã xây dựng đầy đủ API, DB migration và tích hợp giao diện hai đầu.
- Bằng chứng: `backend/test/platform/chat-routes.spec.ts` (presence suite), `frontend/test/seller-chat-inbox.spec.tsx`.
- Mức độ: Đã sửa (Lỗi Vừa).
- Kiểm tra lại: Passed 100%.
