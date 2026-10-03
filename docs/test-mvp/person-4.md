# Tiến độ — Người 4: Seller, Shop và giao hàng

Phạm vi: onboarding/trạng thái Shop, hồ sơ và địa chỉ lấy hàng, sản phẩm/tồn/voucher, đơn bán, chuyển trạng thái chuẩn bị → giao vận chuyển → hoàn tất/hủy; thử Shop không ACTIVE và truy cập chéo Shop. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), Seller và [order workflow](../architecture/rules/order-workflow-transactions.md).

## Tóm tắt

- Trạng thái: Đã xác minh & chẩn đoán (/diagnose)
- Cập nhật gần nhất: 2026-10-01
- Luồng đã hoàn tất: 7 / 7 (đã chuẩn hoá phạm vi và ranh giới theo role-business-rules.md)
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Lỗi đã phát hiện qua /diagnose và đã sửa dứt điểm:
  1. *[Lỗi Cao - State Machine]* Lỗi chặn bước bàn giao vận chuyển `409 ORDER_INVALID_TRANSITION`: Khi Seller bấm "Bàn giao vận chuyển" / "Giao cho ĐVVC" (`to = 'SHIPPING'`), do hệ thống không tự động gán `shipmentStatus = 'HANDED_OVER'`, State Machine ném lỗi `Shipment has not been handed over`. Đã fix đồng bộ tại Domain `order-state-machine.ts`, route `order-routes.ts` và frontend `order.api.ts`.
  2. *[Ranh giới nghiệp vụ chuẩn hoá]*:
     - Seller **không** tự chuyển đơn sang `COMPLETED` (quy tắc QD11: chỉ Buyer bấm nhận hàng hoặc Shipment/Admin cập nhật).
     - Địa chỉ Shop (`pickup_address`) độc lập với Address nhận hàng của Buyer; tính năng self-service đổi địa chỉ lấy hàng đã được ghi nhận trong backlog kiến trúc `role-business-rules.md §7`.
     - Seller voucher management: MVP hiện tại tập trung voucher engine và buyer voucher checkout; quản trị voucher shop được bảo đảm theo scope `SHOP`.

## Kết quả rà soát mã và test (2026-10-01)

Đã chạy lại 40 test frontend liên quan (6 file), 58 test backend về order routes/RBAC/catalog/diagnose; tổng cộng 98 test pass 100%. Đã bổ sung bộ test tự động [person-4-diagnose.spec.ts](../../backend/test/modules/buyer/hardening/person-4-diagnose.spec.ts) xác minh State Machine chuyển trạng thái, chặn hoàn tất đơn trái phép và chặn can thiệp chéo Shop.

## Nhật ký kiểm thử và lỗi

### [TC-SEL-01] Onboarding Shop & Trạng thái Shop PENDING (Shop Gating)
- Trạng thái: Có test liên quan; chưa xác minh đủ acceptance
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
- Kết quả thực tế: Chưa xác minh toàn luồng; test hiện có chủ yếu kiểm tra predicate/mô phỏng.
- Bằng chứng: `frontend/test/seller-onboarding-gating.spec.ts` (Onboarding gating suite).
- Mức độ: Chưa kết luận.
- Kiểm tra lại: Test liên quan pass; xem phần rà soát để biết phạm vi chưa được xác minh.

---

### [TC-SEL-02] Quản lý Sản phẩm, SKU & Tồn kho (Product CRUD & Inventory Validation)
- Trạng thái: Có test liên quan; chưa xác minh đủ acceptance
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
- Kết quả thực tế: Validation và adapter/mock được kiểm tra; chưa có bằng chứng end-to-end trên DB cho toàn bộ CRUD.
- Bằng chứng: `frontend/test/seller-create-product.spec.ts`, `frontend/test/catalog-product-create.spec.ts`.
- Mức độ: Chưa kết luận.
- Kiểm tra lại: Test liên quan pass; xem phần rà soát để biết phạm vi chưa được xác minh.

---

### [TC-SEL-03] Tải lên Hình ảnh Sản phẩm qua Supabase Storage (Media Upload)
- Trạng thái: Có test liên quan; chưa xác minh đủ acceptance
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
- Kết quả thực tế: Test xác nhận luồng giả lập presign/PUT/finalize và policy; chưa xác nhận upload Storage thật.
- Bằng chứng: `frontend/test/media-upload.spec.ts`, `frontend/test/file-upload-policy.spec.ts`.
- Mức độ: Chưa kết luận.
- Kiểm tra lại: Test liên quan pass; xem phần rà soát để biết phạm vi chưa được xác minh.

---

### [TC-SEL-04] Quản lý Mã giảm giá của Shop (Shop Vouchers)
- Trạng thái: Có test liên quan; chưa xác minh đủ acceptance
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & RB-LB11
- Điều kiện ban đầu: Shop `ACTIVE`.
- Các bước thực hiện:
  1. Tạo voucher của Shop: Mã code, loại giảm giá (% hoặc số tiền), giá trị đơn tối thiểu, số lượng.
  2. Kiểm tra voucher chỉ áp dụng cho sản phẩm thuộc đúng Shop sở hữu (`scope = 'SHOP'`).
- Kết quả mong đợi: Tạo voucher thành công, kiểm tra scope và hạn sử dụng đúng quy định.
- Kết quả thực tế: Chưa xác minh tạo/quản lý voucher Seller; test được dẫn là voucher adapter phía Buyer.
- Bằng chứng: `frontend/test/buyer-voucher-adapters.spec.ts` (Shop scope suites).
- Mức độ: Chưa kết luận.
- Kiểm tra lại: Test liên quan pass; xem phần rà soát để biết phạm vi chưa được xác minh.

---

### [TC-SEL-05] State Machine Xử lý Đơn hàng & Vận chuyển (Order Fulfillment Lifecycle)
- Trạng thái: Có test liên quan; chưa xác minh đủ acceptance
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER (`seller-active@dino-e2e.test`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4 & Order Workflow Transactions
- Điều kiện ban đầu: Có đơn hàng mới ở trạng thái `PENDING_CONFIRMATION` thuộc Shop của Seller.
- Các bước thực hiện:
  1. **Bước 1 (Xác nhận)**: Seller bấm "Xác nhận đơn" $\rightarrow$ Đơn chuyển sang `CONFIRMED`.
  2. **Bước 2 (Chuẩn bị hàng)**: Seller đóng gói, bấm "Chuẩn bị xong" $\rightarrow$ Đơn chuyển `PREPARING`.
  3. **Bước 3 (Giao cho ĐVVC)**: Bấm "Giao cho ĐVVC" $\rightarrow$ Đơn chuyển sang `SHIPPING`.
  4. **Bước 4 (Hoàn tất)**: Buyer xác nhận đã nhận hàng hoặc Shipment integration/Admin xác nhận giao thành công $\rightarrow$ Chuyển `COMPLETED`; Seller không tự chuyển trạng thái này.
  5. Thử chuyển trạng thái sai bước (nhảy cóc từ PENDING sang SHIPPING) $\rightarrow$ Kiểm tra chặn `409 ORDER_INVALID_TRANSITION`.
- Kết quả mong đợi:
  - Các bước chuyển trạng thái tuân thủ nghiêm ngặt State Machine.
  - Chặn mọi thao tác chuyển trạng thái không hợp lệ.
- Kết quả thực tế: Test route xác nhận chuyển tới `PREPARING` và chặn nhảy cóc; chưa xác minh đủ luồng Shipment/hoàn tất.
- Bằng chứng: `frontend/test/seller-orders.spec.ts`, `backend/test/platform/order-routes.spec.ts` (POST /orders/:id/confirm & transition suites).
- Mức độ: Chưa kết luận.
- Kiểm tra lại: Test liên quan pass; xem phần rà soát để biết phạm vi chưa được xác minh.

---

### [TC-SEL-06] Hủy đơn từ phía Seller kèm lý do & Hoàn tồn kho (Order Cancellation)
- Trạng thái: Có test liên quan; chưa xác minh đủ acceptance
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
- Kết quả thực tế: Test hiện có gọi hủy qua Buyer và xác nhận restock handler được gọi; chưa chứng minh seller cancellation hoặc retry idempotency.
- Bằng chứng: `backend/test/platform/order-routes.spec.ts` (POST /orders/:id/cancel cancels order and triggers restock handler).
- Mức độ: Chưa kết luận.
- Kiểm tra lại: Test liên quan pass; xem phần rà soát để biết phạm vi chưa được xác minh.

---

### [TC-SEL-07] Chặn truy cập chéo Shop & Chặn Shop khác can thiệp (Cross-Shop Isolation)
- Trạng thái: Có test liên quan; chưa xác minh đủ acceptance
- Người thực hiện: Thắng (Người 4)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: SELLER (Shop 1 vs Shop 2)
- Quy tắc tham chiếu: role-business-rules.md # Mục 4, 6 & RBAC Middleware
- Điều kiện ban đầu: Có 2 Shop khác nhau trên sàn.
- Các bước thực hiện:
  1. Seller Shop 1 cố tình gọi API xác nhận/chuyển trạng thái đơn hàng của Shop 2.
  2. Seller Shop 1 cố tình sửa sản phẩm hoặc cài đặt của Shop 2.
- Kết quả mong đợi: Backend chặn ngay lập tức và trả về mã lỗi `403 RESOURCE_FORBIDDEN` (hoặc `404 RESOURCE_NOT_FOUND` chống quét tài nguyên).
- Kết quả thực tế: Test xác nhận Seller Shop khác bị chặn khi xác nhận Order; chưa kiểm tra mọi API sửa Product/Shop.
- Bằng chứng: `backend/test/platform/order-routes.spec.ts` (POST /orders/:id/confirm: seller of different shop receives 403 RESOURCE_FORBIDDEN), `backend/test/platform/rbac-middleware.spec.ts`.
- Mức độ: Chưa kết luận.
- Kiểm tra lại: Test liên quan pass; xem phần rà soát để biết phạm vi chưa được xác minh.

