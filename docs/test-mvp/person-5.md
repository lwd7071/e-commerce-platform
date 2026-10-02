# Tiến độ — Người 5: Admin và hồi quy

Phạm vi: duyệt/khóa/mở Shop, khóa/mở User, category/kiểm duyệt, can thiệp Order bằng command; kiểm tra role, target, lý do, audit/log. Điều phối hồi quy các lỗi Blocker/Cao đã sửa. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), Admin và ranh giới dữ liệu.

## Tóm tắt

- Trạng thái: Đã xác minh
- Cập nhật gần nhất: 2026-10-01
- Luồng đã hoàn tất: 8 / 8
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 1 (Góp ý nhãn KPI)
- Lỗi đã khắc phục: 1 lỗi tiềm ẩn (ApiAdminRepository thiếu default reason khi unlockUser/unlockShop gây lỗi 422 trên backend)
- Trở ngại/quyết định cần hỗ trợ: Không có. Hệ thống Admin đã được xác minh toàn diện qua cả test tự động và kiểm chứng giao diện thực tế.

## Nhật ký kiểm thử và lỗi

### [TC-ADM-01] Duyệt, Khóa và Mở khóa Shop (Shop Moderation)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: ADMIN (admin@dino.vn), Shop `00000000-0000-0000-0000-000000000002`
- Quy tắc tham chiếu: role-business-rules.md # Mục 5 & QD17, QD20
- Điều kiện ban đầu: Shop tồn tại ở trạng thái PENDING hoặc ACTIVE trong hệ thống.
- Các bước thực hiện:
  1. Admin gửi POST `/api/v1/admin/shops/:id/approve` đối với Shop PENDING $\rightarrow$ Shop chuyển `ACTIVE`.
  2. Admin gửi POST `/api/v1/admin/shops/:id/lock` với lý do "Bán hàng giả không rõ xuất xứ" $\rightarrow$ Shop chuyển `LOCKED`.
  3. Admin gửi POST `/api/v1/admin/shops/:id/lock` không kèm `reason` $\rightarrow$ Kiểm tra từ chối.
  4. Admin gửi POST `/api/v1/admin/shops/:id/unlock` $\rightarrow$ Shop chuyển về `ACTIVE`.
- Kết quả mong đợi:
  - Khóa/Duyệt Shop thành công khi có đủ lý do.
  - Bắt buộc phải có lý do khi khóa (`422 REASON_REQUIRED`).
  - Ghi nhận Audit Log tương ứng trong cùng transaction.
- Kết quả thực tế: Hoạt động chính xác theo thiết kế. Đã pass các ca test trong `backend/test/platform/admin-routes.spec.ts` và `frontend/test/admin.spec.ts`.
- Bằng chứng: `frontend/test/admin.spec.ts` (Shop & Product Moderation suites), `backend/test/platform/admin-routes.spec.ts` (Cycle 4.3 & 4.4).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100% tự động (Node test & Vitest).

---

### [TC-ADM-02] Khóa và Mở khóa Người dùng kèm Audit Log (User Moderation & RBAC)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: ADMIN (admin@dino.vn), Target User: `usr_002` (BUYER), `usr_005` (ADMIN)
- Quy tắc tham chiếu: role-business-rules.md # Mục 5 & RB-LTT08
- Điều kiện ban đầu: User `usr_002` đang `ACTIVE`.
- Các bước thực hiện:
  1. Admin thực hiện khóa tài khoản `usr_002` với lý do "Spam liên tục trong đánh giá sản phẩm".
  2. Admin thực hiện khóa với lý do rỗng hoặc chỉ có khoảng trắng.
  3. Admin thử khóa tài khoản của Quản trị viên `usr_005`.
  4. Admin thực hiện mở khóa cho `usr_002`.
- Kết quả mong đợi:
  - Khóa thành công khi có lý do hợp lệ $\rightarrow$ Trạng thái `LOCKED`.
  - Từ chối khóa khi thiếu lý do (báo lỗi *"Lý do khóa tài khoản là bắt buộc"* / `422 REASON_REQUIRED`).
  - Từ chối khóa tài khoản Admin (báo lỗi *"Không thể khóa tài khoản quản trị viên"*).
  - Mở khóa thành công về `ACTIVE`.
  - Mọi hành động được ghi vào `admin_logs`.
- Kết quả thực tế: Hoàn toàn khớp với kết quả mong đợi.
- Bằng chứng: `frontend/test/admin.spec.ts` (Ticket A-705 & RB-LTT08).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADM-03] Quản lý Cây Danh mục Sản phẩm tối đa 2 cấp (Category Management)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: ADMIN (admin@dino.vn)
- Quy tắc tham chiếu: role-business-rules.md # Mục 5 & RB-KN04
- Điều kiện ban đầu: Có danh mục gốc Root (Cấp 1) và danh mục con Subcategory (Cấp 2).
- Các bước thực hiện:
  1. Tạo Root Category `parentId = null` $\rightarrow$ Thành công.
  2. Tạo Subcategory Cấp 2 với `parentId = root.id` $\rightarrow$ Thành công.
  3. Thử tạo Subcategory Cấp 3 với `parentId = subcat.id`.
  4. Thử xóa danh mục cha khi đang có danh mục con.
  5. Bật/Tắt trạng thái danh mục giữa `ACTIVE` và `INACTIVE`.
- Kết quả mong đợi:
  - Cho phép tạo Cấp 1 và Cấp 2.
  - Từ chối tạo Cấp 3 với thông báo: *"Quy tắc RB-KN04: Danh mục chỉ được hỗ trợ tối đa 2 cấp phân cấp"*.
  - Từ chối xóa danh mục cha đang có con với thông báo: *"Không thể xóa danh mục cha đang chứa các danh mục con"*.
  - Bật/Tắt trạng thái hoạt động chính xác.
- Kết quả thực tế: Đạt 100% tiêu chí nghiệp vụ.
- Bằng chứng: `frontend/test/admin.spec.ts` (Ticket A-709 & RB-KN04).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADM-04] Báo cáo Doanh thu sàn chỉ tính đơn COMPLETED (Revenue Reporting)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: ADMIN (admin@dino.vn)
- Quy tắc tham chiếu: role-business-rules.md # Mục 5 & QD19
- Điều kiện ban đầu: Hệ thống có các đơn hàng ở các trạng thái khác nhau (`PENDING_CONFIRMATION`, `PROCESSING`, `SHIPPING`, `COMPLETED`, `CANCELLED`).
- Các bước thực hiện:
  1. Gọi hàm tính doanh thu Dashboard Admin (`getDashboardStats()`).
  2. Gọi hàm tính KPI doanh thu Shop Seller (`getSellerKPI()`).
- Kết quả mong đợi:
  - Doanh thu GMV sàn và doanh thu Shop chỉ tính tổng tiền của các đơn hàng ở trạng thái `COMPLETED`.
  - Không bao gồm các đơn đang chờ xử lý, đang giao hoặc đã hủy.
- Kết quả thực tế: Hoàn toàn chính xác theo Rule QD19.
- Bằng chứng: `frontend/test/admin.spec.ts` (Rule QD19).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADM-05] Bảo vệ Route & Chặn quyền truy cập trái phép (RBAC Guard & Route Rules)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST, BUYER, SELLER, ADMIN
- Quy tắc tham chiếu: role-business-rules.md # Mục 1 & Ticket Q-805
- Điều kiện ban đầu: Hệ thống định nghĩa các route rules cho `/admin`, `/admin/categories`, `/seller`, `/seller/orders`.
- Các bước thực hiện:
  1. Kiểm tra quyền truy cập vào `/admin` và `/admin/categories`.
  2. Kiểm tra quyền truy cập vào `/seller` và `/seller/orders`.
  3. Gửi request unauthenticated đến route yêu cầu quyền ADMIN $\rightarrow$ `401 AUTH_REQUIRED`.
  4. Gửi request từ BUYER đến route ADMIN $\rightarrow$ `403 RESOURCE_FORBIDDEN`.
- Kết quả mong đợi:
  - `/admin` và `/admin/categories` chỉ cho phép duy nhất Role `ADMIN`.
  - Bị chặn `401` nếu chưa đăng nhập và `403` nếu sai Role.
- Kết quả thực tế: Đạt 100% tiêu chí an toàn phân quyền.
- Bằng chứng: `frontend/test/admin.spec.ts` (Ticket Q-805), `backend/test/platform/rbac-middleware.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADM-06] Kiểm tra Hệ thống Ghi vết Kiểm toán (PostgreSQL Audit Logging)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: ADMIN (admin@dino.vn)
- Quy tắc tham chiếu: role-business-rules.md # Mục 5 & RB-KN20
- Điều kiện ban đầu: Cơ sở dữ liệu bảng `admin_logs`.
- Các bước thực hiện:
  1. Ghi log kiểm toán thao tác quản trị trong transaction context.
  2. Kiểm tra validation khi thiếu `admin_id` hoặc `action`.
  3. Kiểm tra validation khi `target_type` không thuộc enum cho phép.
  4. Kiểm tra ràng buộc cấu trúc `target_type` và `target_id` phải đi cùng nhau.
- Kết quả mong đợi:
  - Ghi log thành công và nhất quán với transaction.
  - Từ chối ghi log và báo lỗi validation `422` nếu dữ liệu vi phạm RB-KN20.
- Kết quả thực tế: Đạt 100% tiêu chí.
- Bằng chứng: `backend/test/platform/audit-logging.spec.ts` (PgAuditRepository suites).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADM-07] Kiểm chứng Giao diện Dashboard & Thống kê KPI (Manual Verification)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: ADMIN (admin@dino.vn)
- Quy tắc tham chiếu: role-business-rules.md # Mục 5 & Ticket A-704
- Điều kiện ban đầu: Đăng nhập giao diện Quản trị viên tại `/admin`.
- Các bước thực hiện:
  1. Thao tác Khóa tài khoản `seller1@dino.vn` (Dino Beauty Store) kèm lý do "bán quá đắt" $\rightarrow$ Trạng thái chuyển `Đã khóa`.
  2. Thao tác Khóa gian hàng `Dino Beauty Official` $\rightarrow$ Trạng thái chuyển `Đã khóa`.
  3. Thao tác Ẩn sản phẩm "Nước hoa nhái thương hiệu cao cấp" $\rightarrow$ Trạng thái chuyển `Đã ẩn`.
  4. Quan sát các thẻ số liệu KPI: Tổng người dùng (5), Gian hàng (3), Sản phẩm kiểm duyệt (3), Doanh thu hoàn thành (280.000 đ).
- Kết quả mong đợi:
  - Thao tác khóa/mở/ẩn hoạt động mượt mà, modal popup nhập lý do hiển thị đầy đủ và validate đúng.
  - Các số liệu phản ánh đúng tổng số đối tượng đang quản lý trên sàn.
- Kết quả thực tế:
  - Giao diện phản hồi nhanh chóng, thao tác khóa và audit log cập nhật đầy đủ.
  - **Ghi nhận UX**: Thẻ KPI đếm tổng số đối tượng quản lý (`.length`), không bị giảm khi khóa tài khoản/shop (vì đối tượng vẫn tồn tại trong hệ thống). Đề xuất cải thiện hiển thị: cập nhật nhãn *"Gian hàng hoạt động"* thành *"Tổng gian hàng"* hoặc lọc chỉ đếm `ACTIVE` để khớp nhãn.
- Bằng chứng: Ảnh chụp màn hình kiểm chứng trực tiếp trên trình duyệt tại `/admin`.
- Mức độ: Thấp (Góp ý cải thiện UX nhãn hiển thị).
- Kiểm tra lại: Đã xác minh trên browser thật.

---

### [TC-ADM-08] Can thiệp Đơn hàng qua Command & State Machine (Admin Order Operations)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 5 (/diagnose hardening)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: ADMIN (admin@dino.vn)
- Quy tắc tham chiếu: role-business-rules.md # Mục 5 & QD11, QD17, QD20
- Điều kiện ban đầu: Hệ thống có đơn hàng ở các trạng thái `PENDING_CONFIRMATION`, `SHIPPING`, `COMPLETED`.
- Các bước thực hiện:
  1. Admin gửi POST `/orders/:id/cancel` không kèm lý do (hoặc lý do rỗng) $\rightarrow$ Kiểm tra từ chối `422 REASON_REQUIRED`.
  2. Admin gửi POST `/orders/:id/cancel` có lý do hợp lệ $\rightarrow$ Hủy thành công, trạng thái chuyển `CANCELLED`, lưu `cancel_reason` và ghi log history với `changedBy = admin.user_id`.
  3. Admin gửi POST `/orders/:id/transition` không kèm lý do $\rightarrow$ Kiểm tra từ chối `422 REASON_REQUIRED`.
  4. Admin thử nhảy cóc trạng thái từ `PENDING_CONFIRMATION` sang `COMPLETED` $\rightarrow$ Kiểm tra từ chối `409 ORDER_INVALID_TRANSITION`.
  5. Admin chuyển đơn `SHIPPING` sang `COMPLETED` không có `shipment_status: 'DELIVERED'` $\rightarrow$ Kiểm tra từ chối `409 ORDER_INVALID_TRANSITION`.
  6. Admin chuyển đơn `SHIPPING` sang `COMPLETED` kèm `shipment_status: 'DELIVERED'` và lý do $\rightarrow$ Chuyển thành công sang `COMPLETED`.
- Kết quả mong đợi:
  - Mọi thao tác can thiệp đơn hàng của Admin bắt buộc phải có reason không rỗng (QD17, QD20).
  - Admin không được nhảy cóc chu trình State Machine trái phép.
  - Phải ghi nhận đầy đủ người thực hiện và lý do vào `order_status_history`.
- Kết quả thực tế: Đạt 100% tiêu chí nghiệp vụ.
- Bằng chứng: `backend/test/modules/buyer/hardening/person-5-diagnose.spec.ts` (4/4 tests passed).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100% tự động.



