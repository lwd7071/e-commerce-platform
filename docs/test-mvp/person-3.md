# Tiến độ — Người 3: Buyer mua hàng

Phạm vi: khám phá sản phẩm → giỏ → checkout → đơn mua → hủy/nhận hàng → đánh giá và thông báo. Bao gồm giá/tồn/voucher, idempotency, nhiều Shop, snapshot địa chỉ/giá và quyền sở hữu. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), Buyer và [order workflow](../architecture/rules/order-workflow-transactions.md).

## Tóm tắt

- Trạng thái: Đã xác minh
- Cập nhật gần nhất: 2026-10-01
- Luồng đã hoàn tất: 8 / 8
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Trở ngại/quyết định cần hỗ trợ: Không có. Toàn bộ luồng Giỏ hàng, Checkout Đa Shop, Idempotency, Quản lý đơn và Đánh giá sản phẩm đã pass 100% test spec và xác minh trên browser.

## Nhật ký kiểm thử và lỗi

### [TC-BUY-01] Khám phá Sản phẩm & Thêm vào Giỏ hàng (Catalog & Stock Check)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com / buyer@dino-demo.test)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD05, QD06
- Điều kiện ban đầu: Có sản phẩm đang `ACTIVE` với số lượng tồn kho `stock = 25`.
- Các bước thực hiện:
  1. Người mua xem danh mục, chọn sản phẩm và xem chi tiết.
  2. Chọn phân loại biến thể, chọn số lượng 1 $\rightarrow$ Bấm "Thêm vào giỏ hàng".
  3. Thử tăng số lượng vượt quá tồn kho khả dụng $\rightarrow$ Kiểm tra hệ thống chặn.
- Kết quả mong đợi:
  - Thêm vào giỏ thành công với số lượng hợp lệ $\ge 1$.
  - Chặn thêm số lượng vượt tồn kho hoặc nhập số lượng âm/không hợp lệ.
- Kết quả thực tế: Hoạt động chính xác theo thiết kế.
- Bằng chứng: `frontend/test/cart-checkout.spec.ts`, `frontend/test/catalog-search-filters.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-BUY-02] Quản lý Giỏ hàng Đa Shop (Cart Management)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & RB-LB03
- Điều kiện ban đầu: Giỏ hàng chứa sản phẩm của nhiều Shop khác nhau.
- Các bước thực hiện:
  1. Vào trang `/cart`.
  2. Kiểm tra phân nhóm sản phẩm theo từng Shop.
  3. Thao tác tăng/giảm số lượng món hàng, xóa 1 món khỏi giỏ.
  4. Tích chọn toàn bộ hoặc một số món để chuẩn bị thanh toán.
- Kết quả mong đợi:
  - Giỏ hàng phân nhóm rõ ràng theo từng Shop sở hữu.
  - Cập nhật số lượng và tổng tiền giỏ hàng realtime chính xác.
- Kết quả thực tế: Đạt 100% yêu cầu.
- Bằng chứng: `frontend/test/cart-checkout.spec.ts` (Cart suite).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-BUY-03] Checkout Đa Shop & Tách Đơn Hàng (Multi-Shop Splitting & Voucher)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD08, QD09, QD10
- Điều kiện ban đầu: Giỏ hàng chọn 2 sản phẩm thuộc 2 Shop khác nhau, có voucher giảm giá.
- Các bước thực hiện:
  1. Vào màn hình `/checkout`.
  2. Chọn địa chỉ giao hàng của Buyer.
  3. Áp dụng mã giảm giá (Shop Voucher / Platform Voucher).
  4. Tiến hành đặt hàng.
- Kết quả mong đợi:
  - Hệ thống tự động tách thành 2 Order riêng biệt tương ứng với 2 Shop.
  - Tính toán số tiền giảm giá và tổng tiền thanh toán chính xác.
  - Chỉ xóa các món hàng đã được chọn mua khỏi giỏ (selective cleanup).
- Kết quả thực tế: Hoạt động hoàn hảo.
- Bằng chứng: `frontend/test/cart-checkout.spec.ts` (Checkout multi-shop suites), `backend/test/platform/order-routes.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-BUY-04] Idempotency Key & Snapshot Đơn hàng (Idempotency & Snapshot)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com)
- Quy tắc tham chiếu: role-business-rules.md # Mục 1, 3 & QD07, QD08
- Điều kiện ban đầu: Form checkout hợp lệ.
- Các bước thực hiện:
  1. Bấm nút "Đặt hàng" liên tiếp 2 lần với cùng một Idempotency Key.
  2. Sau khi đơn tạo thành công, thử sửa hoặc xóa địa chỉ nhận hàng trong Sổ địa chỉ cá nhân.
- Kết quả mong đợi:
  - Hệ thống chỉ tạo đúng 1 đơn hàng (không bị double charge/duplicate order).
  - Đơn hàng lưu cứng thông tin người nhận, địa chỉ nhận hàng và giá tại thời điểm đặt (Snapshot). Sửa sổ địa chỉ sau đó không ảnh hưởng đơn cũ.
- Kết quả thực tế: Hoàn toàn chính xác theo thiết kế.
- Bằng chứng: `frontend/test/idempotency-lifecycle.spec.ts`, `frontend/test/cart-checkout.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-BUY-05] Theo dõi Đơn mua & Hủy đơn đúng điều kiện (Order Tracking & Cancel)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD12, QD13
- Điều kiện ban đầu: Có đơn hàng ở trạng thái `PENDING_CONFIRMATION` và đơn ở trạng thái `SHIPPING`.
- Các bước thực hiện:
  1. Vào `/orders`, lọc đơn theo từng tab trạng thái.
  2. Chọn đơn `PENDING_CONFIRMATION` $\rightarrow$ Bấm "Hủy đơn hàng" $\rightarrow$ Thử để trống lý do $\rightarrow$ Nhập lý do hợp lệ $\rightarrow$ Hủy.
  3. Chọn đơn `SHIPPING` $\rightarrow$ Kiểm tra không có nút hủy hoặc bị chặn nếu cố gọi API hủy.
- Kết quả mong đợi:
  - Hủy thành công đơn chờ xác nhận khi có lý do $\rightarrow$ Chuyển `CANCELLED`, hoàn trả số lượng tồn kho tự động.
  - Từ chối hủy khi thiếu lý do (`422 REASON_REQUIRED`).
  - Không cho phép hủy khi đơn đã được xác nhận/đang giao.
- Kết quả thực tế: Hoàn toàn chính xác.
- Bằng chứng: `frontend/test/orders.spec.ts`, `backend/test/platform/order-routes.spec.ts` (Order Cancel suites).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-BUY-06] Xác nhận Nhận hàng (Confirm Order Receipt)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & Order Workflow
- Điều kiện ban đầu: Đơn hàng ở trạng thái `SHIPPING`.
- Các bước thực hiện:
  1. Buyer bấm nút "Đã nhận được hàng" trên trang chi tiết đơn.
  2. Xác nhận nhận hàng thành công.
- Kết quả mong đợi: Đơn hàng chuyển từ `SHIPPING` sang `COMPLETED`.
- Kết quả thực tế: Chuyển trạng thái đúng và kích hoạt quyền đánh giá sản phẩm.
- Bằng chứng: `frontend/test/orders.spec.ts`, `frontend/test/e2e-order-review-lifecycle.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-BUY-07] Đánh giá Sản phẩm Đủ điều kiện (Review Flow QD14–15)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD14, QD15, RB-LB09
- Điều kiện ban đầu: Có `OrderItem` thuộc đơn hàng đã `COMPLETED`.
- Các bước thực hiện:
  1. Vào màn hình đánh giá `/orders/[id]/review`.
  2. Chọn số sao từ 1 đến 5 sao, nhập nhận xét $\ge 10$ ký tự $\rightarrow$ Gửi đánh giá.
  3. Thử gửi đánh giá thiếu số sao hoặc nhận xét $< 10$ ký tự $\rightarrow$ Bị chặn.
  4. Thử đánh giá lại món hàng đã đánh giá $\rightarrow$ Bị chặn.
  5. Thử đánh giá món hàng thuộc đơn chưa hoàn thành $\rightarrow$ Trả lỗi `422 REVIEW_NOT_ELIGIBLE`.
- Kết quả mong đợi:
  - Đánh giá thành công khi đủ điều kiện.
  - Tối đa 1 Review cho 1 OrderItem.
- Kết quả thực tế: Hoạt động hoàn toàn chuẩn xác.
- Bằng chứng: `frontend/test/review.spec.ts`, `frontend/test/review-api.spec.ts`, `backend/test/platform/review-notification-runtime.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-BUY-08] Kiểm chứng Giao diện & Responsive Mobile 360px (Plan v3.3 Verification)
- Trạng thái: Đã xác minh
- Người thực hiện: Nguyễn Trung Hải (Người 3)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (buyer1@example.com)
- Quy tắc tham chiếu: Plan v3.3 UX Polish & Handoff
- Điều kiện ban đầu: Giao diện Checkout và Giỏ hàng trên màn hình di động (360px).
- Các bước thực hiện:
  1. Mở trang `/cart` và `/checkout` ở viewport 360px.
  2. Kiểm tra hàng tiêu đề địa chỉ nhận hàng, các nút "+ Thêm mới", "Đổi địa chỉ" không bị chèn ép.
  3. Kiểm tra touch target đạt chuẩn $\ge 44\times 44\text{px}$.
- Kết quả mong đợi: Giao diện hiển thị chuẩn xác, không bị tràn màn hình, thao tác mượt mà.
- Kết quả thực tế: Đạt 100% tiêu chuẩn responsive UI/UX.
- Bằng chứng: `frontend/test/cart-checkout.spec.ts` (Plan v3.3 DOM hierarchy & responsive invariant tests).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

