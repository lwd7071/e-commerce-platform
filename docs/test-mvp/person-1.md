# Tiến độ — Người 1: Guest và xác thực

Phạm vi: luồng Guest, đăng ký/đăng nhập/đăng xuất, điều hướng trở lại, tài khoản LOCKED và chặn protected API. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), phần Guest và nguyên tắc chung.

## Tóm tắt

- Trạng thái: Đã xác minh
- Cập nhật gần nhất: 2026-10-02
- Luồng đã hoàn tất: 10 / 10
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Lỗi đã khắc phục:
  1. Thiếu endpoint `POST /admin/finance/escrow/reconcile` trong OpenAPI (OAS-05) làm fail test đối soát route. Đã bổ sung đầy đủ vào `openapi-spec.ts`.
  2. Các trường trong `openapi-spec.ts` dùng `nullable: true` không chuẩn OpenAPI 3.1. Đã chuyển toàn bộ sang `type: ['string', 'null']` và `type: ['object', 'null']`.
- Trở ngại/quyết định cần hỗ trợ: Không có. Toàn bộ các luồng Catalog công khai, Đăng ký, Đăng nhập điều hướng returnTo, Đăng xuất, Chặn Private API, Khóa tài khoản LOCKED, Xử lý trùng email (QD01), Chặn token giả mạo (AUTH-02), Đọc Review công khai, Redaction bảo mật (QD02) và hợp đồng OpenAPI 3.1 đều hoạt động chuẩn xác 100%.

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

---

### [TC-GST-07] Đăng ký trùng Email bị từ chối (`409 USER_EMAIL_CONFLICT`)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST
- Quy tắc tham chiếu: role-business-rules.md # Mục 2 & QD01 / RB-LB01
- Điều kiện ban đầu: Email `test-duplicate@example.com` đã tồn tại trong database hệ thống.
- Các bước thực hiện:
  1. Gửi request đăng ký tài khoản mới với email đã tồn tại.
  2. Kiểm tra phản hồi từ backend database và error translation middleware.
- Kết quả mong đợi:
  - Database unique constraint vi phạm được bắt tại middleware và dịch thành mã lỗi `409 USER_EMAIL_CONFLICT`.
  - Không tạo tài khoản trùng, không để lộ tên constraint thô của database ra client.
- Kết quả thực tế: Trả về HTTP 409 với error code `USER_EMAIL_CONFLICT` và thông báo "Email already exists".
- Bằng chứng: `backend/test/platform/error-handling.spec.ts` (Case 1: maps unique violation 23505 to 409 USER_EMAIL_CONFLICT).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-08] Chặn Token giả mạo, sai định dạng hoặc không tồn tại User (`401 AUTH_INVALID_TOKEN`)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST gửi token không hợp lệ
- Quy tắc tham chiếu: role-business-rules.md # Mục 2 & Auth/RBAC/RLS # Xác minh request
- Điều kiện ban đầu: Gửi request tới protected API kèm Authorization Bearer token giả mạo, rỗng hoặc token trỏ tới User không tồn tại.
- Các bước thực hiện:
  1. Gửi GET request tới `/api/v1/protected` với header `Authorization: Bearer invalid-malformed-token`.
  2. Gửi GET request tới `/api/v1/protected` với header `Authorization: Bearer stub-token-non-existent-user`.
- Kết quả mong đợi:
  - Auth Middleware phát hiện token không hợp lệ và từ chối với `401 AUTH_INVALID_TOKEN`.
  - Không cho phép truy cập tài nguyên được bảo vệ.
- Kết quả thực tế: Middleware trả về chuẩn xác HTTP 401 `AUTH_INVALID_TOKEN` kèm message mô tả lỗi.
- Bằng chứng: `backend/test/platform/auth-middleware.spec.ts` ([AUTH-02] returns 401 AUTH_INVALID_TOKEN when token format is invalid or decode fails / user not found).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-09] Guest xem Đánh giá công khai của sản phẩm (Public Reviews Read Scope)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST (không mang JWT token)
- Quy tắc tham chiếu: role-business-rules.md # Mục 2 & Auth/RBAC/RLS # Public Read
- Điều kiện ban đầu: Sản phẩm đã có các đánh giá công khai (status `VISIBLE`).
- Các bước thực hiện:
  1. Gửi GET request đến `/api/v1/products/:product_id/reviews` mà không đính kèm Bearer token.
  2. Kiểm tra response trả về danh sách đánh giá và thông tin tóm tắt rating (average, count).
- Kết quả mong đợi:
  - Trả về HTTP 200 kèm danh sách review công khai và rating summary mà không yêu cầu đăng nhập.
  - Ngược lại nếu Guest cố gửi `POST /api/v1/order-items/:id/review` sẽ bị chặn với `401 AUTH_REQUIRED`.
- Kết quả thực tế: Endpoint public trả về đầy đủ đánh giá (HTTP 200, count: 2, average: 4.5); endpoint tạo review chặn đúng phân quyền.
- Bằng chứng: `backend/test/platform/review-notification-runtime.spec.ts` (GET /api/v1/products/:product_id/reviews: returns public reviews and rating summary).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-GST-10] Bảo mật thông tin nhạy cảm & Redaction mật khẩu (Security Redaction)
- Trạng thái: Đã xác minh
- Người thực hiện: Nông Văn Cường (Người 1)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST / Hệ thống xác thực
- Quy tắc tham chiếu: role-business-rules.md # Mục 1 & QD02 / error-observability.md
- Điều kiện ban đầu: Xử lý request xác thực và các lỗi crash hệ thống.
- Các bước thực hiện:
  1. Kiểm tra đối tượng user trả về từ Auth Repository xem có chứa mật khẩu plaintext hay không.
  2. Ghi log hệ thống chứa các trường nhạy cảm (`password`, `token`, `secret`, `connection string`).
  3. Kiểm tra response lỗi 500 khi server gặp sự cố crash.
- Kết quả mong đợi:
  - Đối tượng User tuyệt đối không chứa password plaintext (QD02).
  - Platform Logger tự động redact các khóa nhạy cảm `[REDACTED]`.
  - Error handler không để lộ stack trace thô hay database connection string ra client.
- Kết quả thực tế: Hoàn toàn đảm bảo chuẩn bảo mật, các test redaction và auth repository đều pass.
- Bằng chứng: `backend/test/platform/security-redaction.spec.ts` ([REDACT-01..05]) và `backend/test/platform/auth-middleware.spec.ts` ([AUTH-07 / QD02]).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.


