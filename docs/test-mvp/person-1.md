# Tiến độ — Người 1: Guest và xác thực

Phạm vi: luồng Guest, đăng ký/đăng nhập/đăng xuất, điều hướng trở lại, tài khoản LOCKED và chặn protected API. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), phần Guest và nguyên tắc chung.

## Tóm tắt

- Trạng thái: Đã xác minh
- Cập nhật gần nhất: 2026-10-01
- Luồng đã hoàn tất: 6 / 6
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Trở ngại/quyết định cần hỗ trợ: Không có. Toàn bộ các luồng Catalog công khai, Đăng ký, Đăng nhập điều hướng returnTo, Đăng xuất, Chặn Private API và Khóa tài khoản LOCKED đều hoạt động chuẩn xác 100%.

## Nhật ký kiểm thử và lỗi

### [TC-GST-01] Khám phá Catalog công khai không cần đăng nhập (Public Catalog & Search)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST (chưa đăng nhập)
- Quy tắc tham chiếu: role-business-rules.md # Mục 2 & Auth/RBAC/RLS # Public Read
- Điều kiện ban đầu: Người dùng chưa đăng nhập vào hệ thống.
- Các bước thực hiện:
  1. Truy cập trang chủ `/` và trang sản phẩm `/products`.
  2. Xem danh sách sản phẩm, lọc theo danh mục Category, tìm kiếm từ khóa.
  3. Bấm vào xem chi tiết một sản phẩm `/products/[id]`.
- Kết quả mong đợi:
  - Header hiển thị nút "Đăng nhập" / "Đăng ký".
  - Trang catalog, bộ lọc và chi tiết sản phẩm hiển thị đầy đủ thông tin (HTTP 200) mà không bị ép đăng nhập.
  - Chỉ hiển thị các sản phẩm của Shop đang `ACTIVE` và sản phẩm `ACTIVE`.
- Kết quả thực tế: Hoạt động hoàn toàn chuẩn xác.
- Bằng chứng: Kiểm tra live server `http://localhost:3000/products` $\rightarrow$ HTTP 200.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-02] Đăng ký tài khoản & Validation mật khẩu (Registration & Validation)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST
- Quy tắc tham chiếu: role-business-rules.md # Mục 2 & QD01
- Điều kiện ban đầu: Mở trang `/register`.
- Các bước thực hiện:
  1. Thử đăng ký với mật khẩu ngắn $< 8$ ký tự hoặc bỏ trống trường bắt buộc $\rightarrow$ Kiểm tra validation.
  2. Thử nhập mật khẩu xác nhận không khớp $\rightarrow$ Kiểm tra thông báo lỗi.
  3. Nhập đầy đủ họ tên, email hợp lệ, mật khẩu $\ge 8$ ký tự và bấm "Đăng ký tài khoản".
- Kết quả mong đợi:
  - Form validation bắt lỗi chuẩn xác, hiển thị thông báo lỗi rõ ràng.
  - Đăng ký thành công tạo tài khoản với role mặc định là `BUYER` (hoặc `SELLER` kèm bước tạo Shop `PENDING`).
- Kết quả thực tế: Đạt 100% tiêu chí.
- Bằng chứng: `frontend/test/auth-session-hydration.spec.tsx`, `frontend/src/app/register/page.tsx`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-03] Đăng nhập & Điều hướng quay lại luồng dự định (`returnTo` Parameter)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST $\rightarrow$ BUYER (`buyer1@example.com` / `Password123@`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 2
- Điều kiện ban đầu: Guest đang xem sản phẩm hoặc trang cần đăng nhập.
- Các bước thực hiện:
  1. Từ trang sản phẩm hoặc gõ URL `/login?returnTo=%2Fproducts`.
  2. Điền thông tin đăng nhập hợp lệ và bấm "Đăng nhập".
  3. Kiểm tra URL sau khi đăng nhập thành công.
- Kết quả mong đợi:
  - Đăng nhập thành công, lưu token vào context/storage.
  - Hệ thống tự động chuyển hướng quay lại đúng trang `/products` (theo `returnTo`), header chuyển sang trạng thái đã đăng nhập kèm thông tin user.
- Kết quả thực tế: Hoạt động hoàn hảo.
- Bằng chứng: `frontend/test/route-guards.spec.ts` (sanitizeReturnTo & returnTo flow suites).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-04] Chặn Guest gọi Private/Protected API (`401 AUTH_REQUIRED`)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST (không mang JWT token)
- Quy tắc tham chiếu: role-business-rules.md # Mục 2 & RBAC Middleware
- Điều kiện ban đầu: Không có Authorization Header hoặc Bearer token không hợp lệ.
- Các bước thực hiện:
  1. Gửi GET request đến `/api/v1/profile`.
  2. Gửi GET request đến `/api/v1/admin/shops`.
  3. Gửi GET request đến `/api/v1/notifications`.
  4. Mở trực tiếp các URL `/profile`, `/orders`, `/admin` trên trình duyệt ở trạng thái Guest.
- Kết quả mong đợi:
  - Các API private từ chối và trả về mã lỗi `401 AUTH_REQUIRED`.
  - Trên trình duyệt, Guest bị chặn và chuyển hướng về `/login?returnTo=...`.
- Kết quả thực tế: Toàn bộ API private trả `401`, giao diện chặn chuyển hướng đúng quy định.
- Bằng chứng: Live HTTP test: `/api/v1/profile` $\rightarrow$ 401, `/api/v1/admin/shops` $\rightarrow$ 401, `/api/v1/notifications` $\rightarrow$ 401. `backend/test/platform/auth-middleware.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-05] Đăng xuất và Dọn dẹp Session (Logout & Storage Clearance)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: User đã đăng nhập
- Quy tắc tham chiếu: role-business-rules.md # Mục 2
- Điều kiện ban đầu: Đang trong phiên đăng nhập hợp lệ.
- Các bước thực hiện:
  1. Bấm nút "Đăng xuất" trên Header hoặc trang Profile.
  2. Kiểm tra trạng thái session, localStorage và giao diện Header.
- Kết quả mong đợi:
  - Phiên đăng nhập bị hủy (`signOut`).
  - Xóa token `access_token` và `dev_mock_user` khỏi bộ nhớ.
  - Giao diện Header lập tức trở về trạng thái Guest (hiển thị nút "Đăng nhập").
- Kết quả thực tế: Hoạt động trơn tru.
- Bằng chứng: `frontend/test/auth-session-hydration.spec.tsx` (Logout & session clear suites).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-06] Chặn tài khoản `LOCKED` gọi Protected Request (`403 USER_LOCKED`)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: User có trạng thái `status = 'LOCKED'`
- Quy tắc tham chiếu: role-business-rules.md # Mục 1, 2 & QD03
- Điều kiện ban đầu: Tài khoản đã bị Admin khóa (`LOCKED`).
- Các bước thực hiện:
  1. Gửi request có mang JWT token của tài khoản bị khóa tới các endpoint protected.
  2. Đăng nhập tài khoản bị khóa trên giao diện.
- Kết quả mong đợi:
  - Backend Auth Middleware kiểm tra trạng thái và từ chối với lỗi `403 USER_LOCKED`.
  - Frontend hủy phiên đăng nhập cục bộ và hiển thị thông báo tài khoản đã bị khóa.
- Kết quả thực tế: Hoàn toàn chính xác theo Rule QD03.
- Bằng chứng: `backend/test/platform/auth-middleware.spec.ts` ([AUTH-03 / QD03] returns 403 USER_LOCKED).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

