# Tiến độ — Người 3: Buyer mua hàng

Phạm vi: khám phá sản phẩm → giỏ → checkout → đơn mua → hủy/nhận hàng → đánh giá và thông báo. Bao gồm giá/tồn/voucher, idempotency, nhiều Shop, snapshot địa chỉ/giá và quyền sở hữu. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), Buyer và [order workflow](../architecture/rules/order-workflow-transactions.md).

## Tóm tắt

- Trạng thái: Đã xác minh
- Cập nhật gần nhất: 2026-10-01
- Luồng đã hoàn tất: 8 / 8
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Trở ngại/quyết định cần hỗ trợ: Không có. Toàn bộ 8 luồng nghiệp vụ mua hàng của Buyer (Khám phá SP, Giỏ hàng, Voucher, Idempotency Checkout, Checkout Đa Shop & Snapshot, Theo dõi & Hủy đơn, Xác nhận Nhận hàng, Đánh giá OrderItem) đã được xác minh đạt chuẩn nghiệp vụ 100% với 63/63 tests FE và 619/619 tests BE pass.

## Nhật ký kiểm thử và lỗi

### [TC-BUY-01] Khám phá & Lựa chọn Sản phẩm Catalog (Product Discovery & Variant Selection)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`) / Guest
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD05, QD06, RB-LB04
- Điều kiện ban đầu: Các sản phẩm có trạng thái `ACTIVE` thuộc các Shop `ACTIVE` được hiển thị công khai trên sàn.
- Các bước thực hiện:
  1. Truy cập trang chủ `/` hoặc trang danh mục `/products`.
  2. Lọc sản phẩm theo danh mục, khoảng giá, sắp xếp giá/ngày tạo, và tìm kiếm từ khóa với debounce 300ms.
  3. Chọn sản phẩm để vào trang chi tiết `/products/:id`.
  4. Lựa chọn các biến thể kích thước/màu sắc; kiểm tra giá bán và tình trạng tồn kho thay đổi tương ứng.
  5. Chọn số lượng hợp lệ $\ge 1$ và bấm "Thêm vào giỏ hàng".
- Kết quả mong đợi:
  - Bộ lọc hoạt động mượt mà, đồng bộ query string lên URL (`?category_id=...&sort=...`).
  - Biến thể hiển thị đúng giá (> 0đ theo QD05) và tồn kho thực tế (QD06).
  - Thêm vào giỏ thành công với toast thông báo trực quan; nếu chưa đăng nhập thì chuyển hướng đăng nhập bảo toàn `returnTo`.
- Kết quả thực tế: Hoạt động chính xác 100%.
- Bằng chứng: `frontend/test/catalog-product-create.spec.ts`, `frontend/test/catalog-search-filters.spec.ts`, `frontend/test/catalog-pagination.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).

---

### [TC-BUY-02] Quản lý Giỏ hàng Cá nhân & Kiểm soát Số lượng (Cart Item & Quantity Boundary)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & RB-LB03 (1 Cart/Buyer), RB-LB04, RB-MG05
- Điều kiện ban đầu: Buyer đã đăng nhập, giỏ hàng đã có ít nhất 1 sản phẩm.
- Các bước thực hiện:
  1. Mở trang Giỏ hàng `/cart`.
  2. Điều chỉnh tăng/giảm số lượng từng dòng sản phẩm.
  3. Thử nhập số lượng $\le 0$ hoặc vượt quá tồn kho khả dụng của biến thể.
  4. Chọn hoặc bỏ chọn (checkbox) các sản phẩm để chuẩn bị thanh toán.
  5. Xóa sản phẩm khỏi giỏ hàng.
- Kết quả mong đợi:
  - Mỗi Buyer có duy nhất 1 Cart cô lập (RB-LB03); không xem hoặc sửa được giỏ của Buyer khác.
  - Số lượng cập nhật tức thì, chặn cập nhật số lượng $\le 0$ hoặc vượt tồn kho (RB-LB04).
  - Tự động tính toán lại tạm tính (subtotal) theo các sản phẩm được chọn mua.
- Kết quả thực tế: Đạt 100% tiêu chí nghiệp vụ.
- Bằng chứng: `frontend/test/api-cart-repo.spec.ts` (5/5 tests PASS), `Cart & CartItem Domain Tests` trong test suite Node.js backend.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).

---

### [TC-BUY-03] Áp dụng Mã giảm giá Voucher Hợp lệ & Kiểm soát Ranh giới (Voucher Validation & Scope)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD09, RB-LTT03, RB-LTT04, RB-LTT05, RB-MG09
- Điều kiện ban đầu: Có sẵn các mã voucher hệ thống (PLATFORM) và voucher theo gian hàng (SHOP).
- Các bước thực hiện:
  1. Tại bước thanh toán `/checkout`, nhập mã voucher.
  2. Thử nghiệm mã hết hạn hoặc chưa đến ngày bắt đầu (RB-LTT03).
  3. Thử nghiệm voucher có giá trị đơn hàng nhỏ hơn `min_order_value` (QD09).
  4. Thử nghiệm voucher scope `SHOP` áp dụng cho đơn hàng không chứa sản phẩm của Shop đó (RB-LTT05).
  5. Áp dụng voucher hợp lệ: kiểm tra tính toán tiền giảm theo `PERCENT` (có chặn `max_discount`) và `FIXED` (không vượt quá tổng giá trị đơn hàng theo RB-MG09).
- Kết quả mong đợi:
  - Hệ thống từ chối các mã không hợp lệ và hiển thị thông báo lỗi rõ ràng.
  - Voucher hợp lệ được áp dụng chính xác, khấu trừ tiền giảm vào tổng thanh toán.
- Kết quả thực tế: Hoàn toàn chính xác, đáp ứng triệt để các invariants toán học.
- Bằng chứng: `frontend/test/buyer-voucher-adapters.spec.ts` (16/16 tests PASS), `Voucher Domain Tests` backend (22 tests PASS).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).

---

### [TC-BUY-04] Đặt hàng An toàn với Idempotency Key (Checkout Idempotency & Duplicate Prevention)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD07, QD10, F-104
- Điều kiện ban đầu: Giỏ hàng có sản phẩm hợp lệ, đã chọn địa chỉ nhận hàng.
- Các bước thực hiện:
  1. Tại trang `/checkout`, tạo request đặt hàng kèm header `Idempotency-Key` (UUIDv4).
  2. Mô phỏng người dùng double-click nút "Đặt hàng" hoặc mạng chập chờn gửi lại request thứ hai với cùng `Idempotency-Key`.
  3. Kiểm tra phản hồi từ backend và số lượng đơn hàng được tạo trong cơ sở dữ liệu.
  4. Kiểm tra tồn kho sản phẩm bị trừ.
- Kết quả mong đợi:
  - Backend nhận diện `Idempotency-Key` trùng lặp, trả về cùng kết quả đơn hàng đã tạo của request đầu tiên.
  - Tồn kho chỉ bị trừ đúng một lần (QD07), không tạo ra 2 đơn hàng trùng lặp (F-104).
- Kết quả thực tế: Cơ chế Idempotency hoạt động hoàn hảo cả ở tầng Frontend Repository và Backend Database Transaction.
- Bằng chứng: `frontend/test/idempotency-lifecycle.spec.ts` (4/4 tests PASS), `frontend/test/api-checkout-repo.spec.ts` (7/7 tests PASS).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).

---

### [TC-BUY-05] Checkout Đa Shop & Snapshot Giao dịch (Multi-Shop Checkout & Order Partitioning)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD08, QD10, RB-LB03
- Điều kiện ban đầu: Giỏ hàng chứa sản phẩm từ 2 Shop khác nhau (`Shop A` và `Shop B`).
- Các bước thực hiện:
  1. Tiến hành checkout toàn bộ giỏ hàng đa Shop.
  2. Gửi request `POST /checkout` với danh sách items thuộc nhiều Shop.
  3. Kiểm tra kết quả đơn hàng trả về và kiểm tra database.
  4. Thay đổi thông tin địa chỉ trong sổ địa chỉ cá nhân (`/profile`) và giá sản phẩm của Seller.
  5. Đối chiếu lại đơn hàng vừa tạo.
- Kết quả mong đợi:
  - Hệ thống tự động phân tách thành 2 `Order` độc lập, mỗi đơn mang đúng `shop_id` của từng người bán (QD10).
  - Snapshot địa chỉ giao hàng (`delivery_address`) và giá (`unit_price`) được cố định bất biến trong Order; các chỉnh sửa địa chỉ/giá sau này không làm thay đổi thông tin đơn hàng đã chốt (QD08).
- Kết quả thực tế: Đạt 100% tiêu chí nghiệp vụ Schema Freeze v1.
- Bằng chứng: `frontend/test/cart-checkout.spec.ts` (14/14 tests PASS), `backend/tests/db/checkout-e2e-runtime.integration.test.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).

---

### [TC-BUY-06] Theo dõi Đơn hàng & Quyền Hủy đơn của Buyer (Order Tracking & Buyer Cancellation)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD12, QD17, order-workflow-transactions.md
- Điều kiện ban đầu: Buyer có đơn hàng ở các trạng thái khác nhau (`PENDING_CONFIRMATION`, `CONFIRMED`, `SHIPPING`).
- Các bước thực hiện:
  1. Truy cập danh sách đơn hàng `/orders`.
  2. Kiểm tra chỉ hiển thị các đơn hàng do chính Buyer mua, không hiển thị đơn của người khác.
  3. Tại đơn hàng ở trạng thái `PENDING_CONFIRMATION`: bấm "Hủy đơn hàng", nhập lý do hủy bắt buộc (QD17) và xác nhận.
  4. Thử hủy đơn hàng đang ở trạng thái `CONFIRMED` hoặc `SHIPPING`.
- Kết quả mong đợi:
  - Đơn ở `PENDING_CONFIRMATION` hủy thành công, trạng thái chuyển sang `CANCELLED`, tồn kho sản phẩm được hoàn lại tự động đúng 1 lần (QD12).
  - Đơn ở các trạng thái sau (`CONFIRMED`, `SHIPPING`) ẩn nút Hủy hoặc bị backend từ chối với lỗi `ORDER_INVALID_STATE` (409).
- Kết quả thực tế: Hoạt động chuẩn xác theo Order State Machine.
- Bằng chứng: `frontend/test/orders.spec.ts` (7/7 tests PASS), `frontend/test/seller-orders.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).

---

### [TC-BUY-07] Xác nhận Nhận hàng Chuyển trạng thái COMPLETED (Buyer Confirm Received & Completion)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & P0-08, C-103, C-104, order-workflow-transactions.md
- Điều kiện ban đầu: Đơn hàng của Buyer đang ở trạng thái `SHIPPING` (Đang giao hàng).
- Các bước thực hiện:
  1. Vào trang `/orders`, tìm đơn hàng đang ở trạng thái `SHIPPING`.
  2. Bấm nút "Đã nhận được hàng" trên thẻ đơn hàng.
  3. Gửi request `POST /orders/:order_id/confirm-received`.
  4. Kiểm tra trạng thái đơn hàng trên giao diện và trong cơ sở dữ liệu.
- Kết quả mong đợi:
  - Đơn hàng chuyển trạng thái từ `SHIPPING` $\rightarrow$ `COMPLETED`.
  - Hiển thị toast thông báo thành công và kích hoạt nút "Viết đánh giá" (Review) cho từng sản phẩm trong đơn (QD14).
  - Chặn các đơn chưa ở trạng thái `SHIPPING` không thể xác nhận nhận hàng.
- Kết quả thực tế: Hoạt động trơn tru, khớp nối liền mạch với luồng Review.
- Bằng chứng: `frontend/test/orders.spec.ts` (case `confirmReceived chuyển đơn SHIPPING thành COMPLETED`), backend endpoint `POST /orders/:order_id/confirm-received`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).

---

### [TC-BUY-08] Đánh giá Sản phẩm Sau Mua & Chặn Đánh giá Lặp (Review Eligibility & Duplicate Prevention)
- Trạng thái: Đã xác minh
- Người thực hiện: Người 3
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & QD14, QD15, RB-LB09, RB-MG08
- Điều kiện ban đầu: Buyer có đơn hàng vừa hoàn tất (`COMPLETED`).
- Các bước thực hiện:
  1. Tại đơn hàng `COMPLETED`, bấm "Viết đánh giá" để chuyển tới `/orders/:id/review`.
  2. Kiểm tra điều kiện: chỉ đơn `COMPLETED` mới được đánh giá (QD14); đơn chưa hoàn tất hiển thị cảnh báo từ chối.
  3. Nhập số sao từ 1 đến 5 sao (QD15), nhập nhận xét (10–500 ký tự) và tùy chọn đính kèm ảnh đánh giá.
  4. Bấm "Gửi đánh giá" cho từng OrderItem.
  5. Thử gửi lại đánh giá lần thứ 2 cho cùng một `order_item_id`.
  6. Thử đăng nhập tài khoản Buyer khác để đánh giá đơn hàng này.
- Kết quả mong đợi:
  - Gửi đánh giá thành công cho từng OrderItem, cập nhật aggregate rating của sản phẩm.
  - Chặn đánh giá lặp: mỗi `order_item_id` chỉ được đánh giá tối đa 1 lần (RB-LB09), nếu đã đánh giá thì hiển thị nội dung cũ và khóa form.
  - Chặn Buyer khác đánh giá chéo đơn không thuộc quyền sở hữu (403 `REVIEW_NOT_ELIGIBLE`).
- Kết quả thực tế: Đạt 100% tiêu chí nghiệp vụ, tích hợp chuẩn xác theo live API contract.
- Bằng chứng: `frontend/test/review.spec.ts` (7/7 tests PASS), `frontend/test/review-api.spec.ts` (2/2 tests PASS), `frontend/test/e2e-order-review-lifecycle.spec.ts` (1/1 test PASS).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed (2026-10-01).
