# Tiến độ — Người 4: Seller, Shop và giao hàng

Phạm vi: onboarding/trạng thái Shop, hồ sơ và địa chỉ lấy hàng, sản phẩm/tồn/voucher, đơn bán, chuyển trạng thái chuẩn bị → giao vận chuyển → hoàn tất/hủy; thử Shop không ACTIVE và truy cập chéo Shop. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), Seller và [order workflow](../architecture/rules/order-workflow-transactions.md).

## Tóm tắt

- Trạng thái: Đã xác minh
- Cập nhật gần nhất: 2026-10-01
- Luồng đã hoàn tất: 7 / 7
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Trở ngại/quyết định cần hỗ trợ: Không có. Toàn bộ các luồng Onboarding Shop, CRUD Sản phẩm, Upload Media Storage, State Machine đơn hàng và Chặn chéo Shop đã pass 100% test spec.

## Nhật ký kiểm thử và lỗi

### [TC-SEL-01] Onboarding Shop & Trạng thái Shop PENDING (Shop Gating)
- Trạng thái: Đã xác minh
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER (`seller-pending@dino-e2e.test` / Shop PENDING)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & RB-LB02
- Điều kiện ban đầu: Tài khoản Seller vừa hoàn tất onboarding, Shop ở trạng thái `PENDING`.
- Các bước thực hiện:
  1. Đăng nhập tài khoản Seller có Shop `PENDING`.
  2. Truy cập màn hình Seller Dashboard `/seller`.
  3. Thử tạo sản phẩm hoặc xử lý đơn hàng khi Shop chưa được duyệt.
- Kết quả mong đợi:
  - Hệ thống hiển thị thông báo trạng thái Shop đang chờ Admin phê duyệt.
  - Chặn các hành động seller business writes (tạo sản phẩm, xử lý đơn) cho đến khi Shop được Admin duyệt sang `ACTIVE`.
- Kết quả thực tế: Hoạt động hoàn toàn chính xác theo thiết kế.
- Bằng chứng: `frontend/test/seller-onboarding-gating.spec.ts` (Onboarding gating suite).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-02] Quản lý Sản phẩm, SKU & Tồn kho (Product CRUD & Inventory Validation)
- Trạng thái: Đã xác minh
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER (`seller-active@dino-e2e.test` / Shop ACTIVE)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & QD04, QD05, QD06
- Điều kiện ban đầu: Shop ở trạng thái `ACTIVE`.
- Các bước thực hiện:
  1. Vào trang `/seller/products/new`.
  2. Thử tạo sản phẩm với giá $\le 0$, tên $< 3$ ký tự, hoặc thiếu SKU $\rightarrow$ Kiểm tra validation.
  3. Nhập đầy đủ thông tin: Tên sản phẩm, Danh mục, Biến thể SKU, Giá bán $> 0$, Tồn kho $\ge 0$, Mô tả $\rightarrow$ Bấm Lưu sản phẩm.
  4. Sửa thông tin sản phẩm và cập nhật tồn kho.
- Kết quả mong đợi:
  - Form validation bắt lỗi chuẩn xác (Giá $> 0$, Tồn kho $\ge 0$, SKU duy nhất trong Shop).
  - Tạo sản phẩm mới thành công, hiển thị trong danh sách sản phẩm của Shop.
- Kết quả thực tế: Đạt 100% tiêu chí nghiệp vụ.
- Bằng chứng: `frontend/test/seller-create-product.spec.ts`, `frontend/test/catalog-product-create.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-03] Tải lên Hình ảnh Sản phẩm qua Supabase Storage (Media Upload)
- Trạng thái: Đã xác minh
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER (`seller-active@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & Ticket B-101, B-104
- Điều kiện ban đầu: File ảnh hợp lệ (JPG, PNG, WebP $\le 5\text{MB}$).
- Các bước thực hiện:
  1. Chọn file ảnh sản phẩm trong form tạo sản phẩm.
  2. Thử chọn file sai định dạng (PDF/TXT) hoặc file quá 5MB $\rightarrow$ Kiểm tra chặn.
  3. Upload file hợp lệ $\rightarrow$ Kiểm tra presigned URL, upload Storage và gắn URL vào sản phẩm (`ATTACHED`).
- Kết quả mong đợi:
  - Chặn đúng file sai định dạng và quá dung lượng.
  - Upload ảnh thành công lên bucket `product-media` với public URL hợp lệ.
- Kết quả thực tế: Hoạt động hoàn toàn chuẩn xác.
- Bằng chứng: `frontend/test/media-upload.spec.ts`, `frontend/test/file-upload-policy.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-04] Quản lý Mã giảm giá của Shop (Shop Vouchers)
- Trạng thái: Đã xác minh
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & RB-LB11
- Điều kiện ban đầu: Shop `ACTIVE`.
- Các bước thực hiện:
  1. Tạo voucher của Shop: Mã code, loại giảm giá (% hoặc số tiền), giá trị đơn tối thiểu, số lượng.
  2. Kiểm tra voucher chỉ áp dụng cho sản phẩm thuộc đúng Shop sở hữu (`scope = 'SHOP'`).
- Kết quả mong đợi: Tạo voucher thành công, kiểm tra scope và hạn sử dụng đúng quy định.
- Kết quả thực tế: Đạt 100% yêu cầu.
- Bằng chứng: `frontend/test/buyer-voucher-adapters.spec.ts` (Shop scope suites).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-05] State Machine Xử lý Đơn hàng & Vận chuyển (Order Fulfillment Lifecycle)
- Trạng thái: Đã xác minh
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER (`seller-active@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & Order Workflow Transactions
- Điều kiện ban đầu: Có đơn hàng mới ở trạng thái `PENDING_CONFIRMATION` thuộc Shop của Seller.
- Các bước thực hiện:
  1. **Bước 1 (Xác nhận)**: Seller bấm "Xác nhận đơn" $\rightarrow$ Đơn chuyển sang `PROCESSING` (hoặc `CONFIRMED`).
  2. **Bước 2 (Chuẩn bị hàng)**: Seller đóng gói, bấm "Chuẩn bị xong" $\rightarrow$ Đơn chuyển `PREPARING`.
  3. **Bước 3 (Giao cho ĐVVC)**: Bấm "Giao cho ĐVVC" $\rightarrow$ Đơn chuyển sang `SHIPPING`.
  4. **Bước 4 (Hoàn tất)**: Đơn giao thành công $\rightarrow$ Chuyển `COMPLETED`.
  5. Thử chuyển trạng thái sai bước (nhảy cóc từ PENDING sang SHIPPING) $\rightarrow$ Kiểm tra chặn `409 ORDER_INVALID_TRANSITION`.
- Kết quả mong đợi:
  - Các bước chuyển trạng thái tuân thủ nghiêm ngặt State Machine.
  - Chặn mọi thao tác chuyển trạng thái không hợp lệ.
- Kết quả thực tế: Đạt 100% tiêu chí State Machine chuẩn.
- Bằng chứng: `frontend/test/seller-orders.spec.ts`, `backend/test/platform/order-routes.spec.ts` (POST /orders/:id/confirm & transition suites).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-06] Hủy đơn từ phía Seller kèm lý do & Hoàn tồn kho (Order Cancellation)
- Trạng thái: Đã xác minh
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & QD11, QD13
- Điều kiện ban đầu: Có đơn hàng cần hủy do hết hàng hoặc sự cố.
- Các bước thực hiện:
  1. Seller bấm "Hủy đơn hàng".
  2. Thử để trống lý do hủy $\rightarrow$ Kiểm tra chặn `422 REASON_REQUIRED`.
  3. Nhập lý do hợp lệ và xác nhận hủy.
- Kết quả mong đợi:
  - Đơn chuyển sang `CANCELLED`.
  - Tự động kích hoạt restock handler hoàn lại số lượng tồn kho đúng 1 lần duy nhất trong transaction.
- Kết quả thực tế: Hoàn toàn chính xác theo Rule QD13.
- Bằng chứng: `backend/test/platform/order-routes.spec.ts` (POST /orders/:id/cancel cancels order and triggers restock handler).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-SEL-07] Chặn truy cập chéo Shop & Chặn Shop khác can thiệp (Cross-Shop Isolation)
- Trạng thái: Đã xác minh
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER (Shop 1 vs Shop 2)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4, 6 & RBAC Middleware
- Điều kiện ban đầu: Có 2 Shop khác nhau trên sàn.
- Các bước thực hiện:
  1. Seller Shop 1 cố tình gọi API xác nhận/chuyển trạng thái đơn hàng của Shop 2.
  2. Seller Shop 1 cố tình sửa sản phẩm hoặc cài đặt của Shop 2.
- Kết quả mong đợi: Backend chặn ngay lập tức và trả về mã lỗi `403 RESOURCE_FORBIDDEN` (hoặc `404 RESOURCE_NOT_FOUND` chống quét tài nguyên).
- Kết quả thực tế: Đạt 100% tiêu chuẩn bảo mật dữ liệu giữa các Shop.
- Bằng chứng: `backend/test/platform/order-routes.spec.ts` (POST /orders/:id/confirm: seller of different shop receives 403 RESOURCE_FORBIDDEN), `backend/test/platform/rbac-middleware.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

