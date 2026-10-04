# Tiến độ — Người 2: Buyer hồ sơ và địa chỉ

Phạm vi: hồ sơ cá nhân Buyer; tạo/xem/sửa/xóa địa chỉ nhận hàng; đặt địa chỉ mặc định; xác minh owner và quy tắc địa chỉ mặc định. Tham chiếu [role-business-rules.md](../architecture/role-business-rules.md), Buyer và ranh giới dữ liệu.

## Tóm tắt

- Trạng thái: Đã chẩn đoán, sửa lỗi & xác minh lại
- Cập nhật gần nhất: 2026-10-01
- Luồng đã hoàn tất: 10 / 10
- Lỗi mở: Blocker 0 · Cao 0 · Vừa 0 · Thấp 0
- Lỗi đã khắc phục: 3 lỗi (1 Cao: Seller Shop PENDING bị chặn xem/sửa hồ sơ cá nhân; 1 Vừa: Địa chỉ không validate regex SĐT; 1 Vừa: Xóa địa chỉ default không fallback đôn địa chỉ còn lại).
- Trở ngại/quyết định cần hỗ trợ: Đã khắc phục triệt để toàn bộ 3 lỗi phát hiện qua `/diagnose` và bổ sung regression tests khóa chặt hành vi. Toàn bộ 10 luồng Hồ sơ cá nhân, Avatar upload, CRUD địa chỉ, Địa chỉ mặc định nguyên tử (RB-LB05), Quyền sở hữu chống enumeration, RBAC, Chặn trường lạ (Mass Assignment), Giữ dữ liệu form khi lỗi và Xử lý trạng thái missing profile đều hoạt động chuẩn xác 100%.

## Nhật ký kiểm thử và lỗi

### [TC-ADR-01] Xem và sửa thông tin Hồ sơ cá nhân (UserProfile Read & Update)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (`buyer@dino.vn`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 1, Mục 3 & RB-KC02
- Điều kiện ban đầu: Buyer đã đăng nhập hệ thống, truy cập màn hình `/profile`.
- Các bước thực hiện:
  1. Gửi GET request tới `/api/v1/profile` để tải thông tin hồ sơ.
  2. Nhập họ tên mới, số điện thoại mới và bấm "Lưu thay đổi" (gửi `PATCH /api/v1/profile`).
  3. Thử can thiệp đổi `email` hoặc `role` qua payload request.
- Kết quả mong đợi:
  - Thông tin họ tên và số điện thoại được cập nhật thành công trong database (upsert `app_user_profiles`).
  - Trường `email` và `role` ở trạng thái chỉ đọc (read-only), backend không cho phép client tự thay đổi.
  - Khi lưu lỗi, UI giữ nguyên giá trị người dùng vừa nhập và hiển thị thông báo lỗi rõ ràng.
- Kết quả thực tế: Hoạt động hoàn toàn chuẩn xác.
- Bằng chứng: `frontend/test/profile-screen.spec.tsx`, `backend/test/modules/buyer/services/address-profile.service.spec.ts` (ProfileService Tests).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-02] Tải lên ảnh đại diện qua Media Asset Service (Avatar Upload)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER
- Quy tắc tham chiếu: role-business-rules.md # Mục 1, Mục 3 & Media Service Policy
- Điều kiện ban đầu: Mở trang `/profile`, đã có token phiên đăng nhập.
- Các bước thực hiện:
  1. Bấm nút "Tải ảnh đại diện", chọn file ảnh hợp lệ (JPG/PNG/WebP, dung lượng $\le 5\text{MB}$).
  2. Frontend gửi file lên Media API để nhận `mediaId`.
  3. Gọi cập nhật avatar thông qua `buyerApi.updateAvatar(mediaId)`.
  4. Kiểm tra URL ảnh hiển thị trên giao diện.
- Kết quả mong đợi:
  - Ảnh được upload thành công lên storage, nhận `mediaId` và cập nhật `avatar_url` trong hồ sơ.
  - Giao diện render ảnh đại diện mới theo URL trả về từ server.
- Kết quả thực tế: Upload thành công, avatar render chuẩn URL từ storage.
- Bằng chứng: `frontend/test/profile-screen.spec.tsx` (uploads an avatar through media_id and renders the server URL).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-03] Tạo địa chỉ nhận hàng & Tự động gán mặc định (Create Address & Auto Default)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & RB-LB05
- Điều kiện ban đầu: Buyer chưa có địa chỉ nhận hàng nào trong hệ thống.
- Các bước thực hiện:
  1. Gửi POST request tới `/api/v1/addresses` với thông tin địa chỉ đầu tiên (người nhận, SĐT, địa chỉ chi tiết).
  2. Tạo tiếp các địa chỉ tiếp theo (đến địa chỉ thứ 10).
  3. Thử tạo địa chỉ thứ 11 $\rightarrow$ Kiểm tra giới hạn số lượng.
- Kết quả mong đợi:
  - Địa chỉ đầu tiên được tạo tự động gán `isDefault = true` theo UX heuristic.
  - Khi số lượng địa chỉ đạt 10, request tạo địa chỉ thứ 11 bị từ chối với lỗi `VALIDATION_FAILED` (tối đa 10 địa chỉ/User).
- Kết quả thực tế: Hoàn toàn chính xác, địa chỉ đầu tiên tự thành mặc định, giới hạn 10 địa chỉ được thực thi nghiêm ngặt.
- Bằng chứng: `backend/test/modules/buyer/services/address-profile.service.spec.ts` (createAddress: tự động đặt isDefault=true cho địa chỉ đầu tiên; ném VALIDATION_FAILED khi quá 10 địa chỉ).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-04] Đặt địa chỉ mặc định duy nhất và chuyển đổi nguyên tử (Single Default & Concurrency RB-LB05)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER (đã có địa chỉ A là default và địa chỉ B không default)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & RB-LB05
- Điều kiện ban đầu: User có địa chỉ A (`isDefault: true`), B (`isDefault: false`).
- Các bước thực hiện:
  1. Gửi request `PATCH /api/v1/addresses/:id_B/default`.
  2. Kiểm tra trạng thái của cả 2 địa chỉ trong database.
  3. Thử gửi 2 request đặt default đồng thời (concurrent transactions).
  4. Thử gọi lại trên địa chỉ vốn đã là default $\rightarrow$ Kiểm tra tính idempotent.
- Kết quả mong đợi:
  - Địa chỉ B chuyển sang `isDefault: true`, địa chỉ A tự động chuyển sang `isDefault: false` trong cùng 1 database transaction.
  - Toàn bộ thời điểm chỉ duy nhất 1 địa chỉ có `isDefault = true` (bảo đảm bởi Partial Unique Index `idx_addresses_user_default`).
  - Gọi lại trên địa chỉ đã default giữ nguyên `isDefault = true`.
- Kết quả thực tế: Chuyển đổi trạng thái nguyên tử, chống race condition hoàn hảo trên PostgreSQL thật.
- Bằng chứng: `backend/test/modules/buyer/address.spec.ts`, `backend/tests/db/address-runtime.integration.test.ts` (serializes concurrent default changes so exactly one address remains default).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-05] Cập nhật và Xóa địa chỉ nhận hàng (Update & Delete Address)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER
- Quy tắc tham chiếu: role-business-rules.md # Mục 1, 3 & Schema Freeze (Snapshot)
- Điều kiện ban đầu: Buyer có địa chỉ trong danh bạ và đã từng đặt đơn hàng sử dụng địa chỉ này.
- Các bước thực hiện:
  1. Gửi PUT/PATCH cập nhật tên người nhận và số điện thoại của địa chỉ.
  2. Gửi DELETE request tới `/api/v1/addresses/:id` để xóa địa chỉ.
  3. Kiểm tra đơn hàng cũ đã đặt xem snapshot địa chỉ giao hàng (`Order.delivery_address`) có bị ảnh hưởng không.
- Kết quả mong đợi:
  - Cập nhật thành công thông tin địa chỉ (HTTP 200).
  - Xóa địa chỉ thành công (HTTP 204).
  - Đơn hàng cũ vẫn giữ nguyên bản lưu snapshot địa chỉ giao hàng đầy đủ không bị thay đổi hay lỗi khóa ngoại.
- Kết quả thực tế: Xóa địa chỉ thành công, snapshot đơn hàng được bảo toàn độc lập tuyệt đối.
- Bằng chứng: `backend/test/platform/buyer-routes.spec.ts` (DELETE /api/v1/addresses/:id: deletes address and returns 204), `backend/tests/db/address-runtime.integration.test.ts` (allows deleting an address while an order retains its saved address snapshot).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-06] Kiểm tra quyền sở hữu & Chống rò rỉ dữ liệu (Address Ownership & Anti-Enumeration)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER 1 (`usr-buyer-1`), BUYER 2 (`usr-buyer-2`)
- Quy tắc tham chiếu: role-business-rules.md # Mục 3, Mục 6 & auth-rbac-rls.md # Mục 3
- Điều kiện ban đầu: Địa chỉ `add-other` thuộc sở hữu của Buyer 2.
- Các bước thực hiện:
  1. Buyer 1 gửi GET request tới `/api/v1/addresses/add-other`.
  2. Buyer 1 gửi PUT/PATCH sửa địa chỉ `add-other`.
  3. Buyer 1 gửi DELETE xóa địa chỉ `add-other`.
  4. Buyer 1 gửi PATCH đặt default cho `add-other`.
- Kết quả mong đợi:
  - Toàn bộ các thao tác trên bị backend từ chối với mã lỗi `404 RESOURCE_NOT_FOUND` (thay vì 403) nhằm ngăn chặn kẻ tấn công dò quét sự tồn tại của ID (Anti-Enumeration).
  - Dữ liệu địa chỉ của Buyer 2 hoàn toàn an toàn và bất khả xâm phạm.
- Kết quả thực tế: Toàn bộ các phương thức truy cập chéo đều trả về đúng 404 `RESOURCE_NOT_FOUND`.
- Bằng chứng: `backend/test/platform/buyer-routes.spec.ts` (returns 404 RESOURCE_NOT_FOUND when accessing another user address), `backend/test/modules/buyer/services/address-profile.service.spec.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-07] Phân quyền RBAC trên API `/addresses` và Giao diện (Role Gating on Addresses)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: GUEST (chưa auth), SELLER, ADMIN
- Quy tắc tham chiếu: role-business-rules.md # Mục 2, Mục 4 & auth-rbac-rls.md
- Điều kiện ban đầu: Có các tài khoản với role khác nhau.
- Các bước thực hiện:
  1. Guest (không mang token) gửi GET tới `/api/v1/addresses`.
  2. Seller hoặc Admin gửi GET tới `/api/v1/addresses`.
  3. Seller / Admin đăng nhập và vào trang `/profile` trên giao diện người dùng.
- Kết quả mong đợi:
  - Guest gọi `/api/v1/addresses` bị từ chối với `401 AUTH_REQUIRED`.
  - Non-buyer (Seller/Admin) gọi `/api/v1/addresses` bị từ chối với `403 ROLE_REQUIRED` ("Required role: BUYER").
  - Trên giao diện `/profile`, chỉ tài khoản `BUYER` mới hiển thị component quản lý sổ địa chỉ `AddressManager`. Seller/Admin không bị hiển thị lỗi 403.
- Kết quả thực tế: API chặn chuẩn xác `401` và `403`; frontend bọc điều kiện `{profile.role === 'BUYER' && <AddressManager />}` hoạt động mượt mà.
- Bằng chứng: `backend/test/platform/buyer-routes.spec.ts` (enforces RBAC: returns 401 when no auth is provided; returns 403 when non-buyer role accesses buyer routes), `frontend/src/features/profile/profile-screen.tsx`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-08] Chặn trường lạ & Chống Mass Assignment (Unknown Field Guard)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER
- Quy tắc tham chiếu: role-business-rules.md # Mục 1, 3 & Schema Freeze / DTO Validation
- Điều kiện ban đầu: Buyer có phiên đăng nhập hợp lệ.
- Các bước thực hiện:
  1. Gửi request `POST /api/v1/addresses` với payload chứa trường lạ không được phép: `id`, `user_id`, `is_admin`.
  2. Gửi request `PATCH /api/v1/profile` với payload chứa trường lạ: `role`, `email`, `status`.
- Kết quả mong đợi:
  - Backend DTO validation layer bắt chặn ngay trước khi chạm tới cơ sở dữ liệu.
  - Trả về mã lỗi `422 VALIDATION_FAILED` với message cảnh báo rõ: "Trường 'id' không được phép tồn tại (Unknown field)."
  - Ngăn chặn triệt để lỗ hổng Mass Assignment hoặc giả mạo trường định danh.
- Kết quả thực tế: Chặn thành công, ném đúng `422 VALIDATION_FAILED` kèm thông tin trường vi phạm.
- Bằng chứng: `backend/test/platform/buyer-routes.spec.ts` (rejects unknown fields before PostgreSQL for address and cart writes), `backend/src/modules/buyer/contracts/buyer.dto.ts`.
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-09] Bảo toàn dữ liệu form khi lưu hồ sơ thất bại (Form State Resiliency)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER
- Quy tắc tham chiếu: role-business-rules.md # Mục 3 & Frontend Resiliency Checklist
- Điều kiện ban đầu: Mở trang `/profile`, sửa trường "Họ và tên" thành giá trị mới (ví dụ "Tên vừa chỉnh").
- Các bước thực hiện:
  1. Bấm nút "Lưu thay đổi".
  2. Giả lập API update thất bại (mạng lỗi, server trả về 500 hoặc timeout).
  3. Quan sát phản hồi trên giao diện người dùng.
- Kết quả mong đợi:
  - Giao diện hiển thị thông báo lỗi (Toast/Alert) cho người dùng biết thao tác chưa thành công.
  - Các ô nhập liệu (Họ và tên, SĐT) giữ nguyên toàn bộ giá trị người dùng vừa gõ, không bị xóa trắng hay reset về giá trị ban đầu.
- Kết quả thực tế: Form giữ nguyên giá trị `Tên vừa chỉnh` và `0900000000`, hiển thị alert thông báo lỗi chuẩn UX.
- Bằng chứng: `frontend/test/profile-screen.spec.tsx` (keeps user-entered profile values when saving fails).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

### [TC-ADR-10] Xử lý trạng thái tài khoản mới chưa có hồ sơ (Missing Profile State)
- Trạng thái: Đã xác minh
- Người thực hiện: Thành viên 2 (Người 2)
- Ngày cập nhật: 2026-10-01
- Role và tài khoản/dữ liệu test: BUYER mới đăng ký
- Quy tắc tham chiếu: role-business-rules.md # Mục 1, 3 & UI State Handling
- Điều kiện ban đầu: Người dùng mới tạo tài khoản, chưa có bản ghi trong bảng `app_user_profiles`.
- Các bước thực hiện:
  1. Truy cập vào đường dẫn `/profile`.
  2. Frontend nhận trạng thái `status: 'missing'` từ request hook.
- Kết quả mong đợi:
  - Màn hình không bị vỡ giao diện hay treo ở màn hình loading vô tận.
  - Hiển thị khối trạng thái rõ ràng: "Chưa có hồ sơ cá nhân - Hoàn tất thông tin cơ bản để tiếp tục sử dụng tài khoản."
  - Cung cấp nút CTA điều hướng trực tiếp sang trang `/complete-profile`.
- Kết quả thực tế: Giao diện chuyển sang màn hình empty state `missing` đúng chuẩn thiết kế.
- Bằng chứng: `frontend/test/profile-screen.spec.tsx` (renders distinct loading, signed-out, missing, and API error states).
- Mức độ: Không có lỗi.
- Kiểm tra lại: Passed 100%.

---

## Lịch sử chẩn đoán và khắc phục lỗi (/diagnose)

### 1. [Lỗi Cao - RBAC Leak] Seller có Shop `PENDING` bị chặn xem/sửa Hồ sơ cá nhân (`403 SHOP_NOT_ACTIVE`)
- **Phát hiện**: Middleware `requireRole` trong `buyer-routes.ts` kiểm tra nếu caller có role `SELLER` mà `shop_status !== 'ACTIVE'` thì ném ngay `403 SHOP_NOT_ACTIVE`. Do `/profile` dùng chung guard này nên Seller mới đăng ký (Shop PENDING) bị chặn truy cập thông tin cá nhân.
- **Vi phạm**: [role-business-rules.md Mục 1, 4 và 7](../architecture/role-business-rules.md) (Hồ sơ cá nhân thuộc về User, không phụ thuộc vào trạng thái Shop).
- **Khắc phục**: Tạo riêng middleware `profileGuards(auth)` cho các route `/profile`, tách biệt hoàn toàn kiểm tra vai trò người dùng khỏi điều kiện Shop ACTIVE.
- **Xác minh**: Bổ sung test case `GET /api/v1/profile: allows SELLER with PENDING shop to view their own profile` trong `backend/test/platform/buyer-routes.spec.ts` $\rightarrow$ Passed 100%.

### 2. [Lỗi Vừa - Data Validation] Thiếu regex kiểm tra định dạng Số điện thoại khi tạo/cập nhật Địa chỉ
- **Phát hiện**: `validateCreateAddressDTO` và `validateUpdateAddressDTO` chỉ kiểm tra chuỗi không rỗng, cho phép nhập chuỗi ký tự rác (ví dụ: `"abcxyz"`) làm số điện thoại nhận hàng.
- **Vi phạm**: Tính nhất quán dữ liệu với `PATCH /profile` (yêu cầu số điện thoại chuẩn VN: `/^(?:0\d{9,10}|\+84\d{9,10})$/`).
- **Khắc phục**: Thêm hằng số `PHONE_REGEX` và bổ sung kiểm tra định dạng nghiêm ngặt trong `buyer.dto.ts`.
- **Xác minh**: Bổ sung test case `POST /api/v1/addresses: rejects invalid phone format with 422 VALIDATION_FAILED` $\rightarrow$ Passed 100%.

### 3. [Lỗi Vừa - UX Business Rule] Xóa địa chỉ Mặc định làm mất trạng thái Default của tài khoản
- **Phát hiện**: Trong `AddressService.deleteAddress`, khi xóa địa chỉ đang là `isDefault = true`, hệ thống không tự động đôn một địa chỉ còn lại lên làm default. Buyer rơi vào trạng thái có địa chỉ nhưng không có default nào.
- **Khắc phục**: Trong `deleteAddress`, nếu `address.isDefault === true`, tự động tìm các địa chỉ còn lại của user và gọi `setDefault` cho địa chỉ đầu tiên còn lại.
- **Xác minh**: Bổ sung test case `deleteAddress: khi xóa địa chỉ default thì tự động đôn địa chỉ còn lại lên làm default` trong `backend/test/modules/buyer/services/address-profile.service.spec.ts` $\rightarrow$ Passed 100%.

## Đợt 2 — kiểm thử sau merge

- **Ngày chạy:** 2026-10-04 (Asia/Saigon)
- **Commit `dev`:** `790a65e299e69c9036654d1a0c24646f74238850`
- **Môi trường:** Frontend/backend local kết nối Supabase dev/test đã được chủ dự án cho phép; `NEXT_PUBLIC_USE_MOCK=false`. Không lưu URL định danh project, thông tin đăng nhập hay secret. Cờ allowlist/reset và notification live chỉ đặt theo tiến trình.
- **Dữ liệu:** Buyer fixture `buyer@dino-e2e.test` và Buyer phụ `buyer-secondary@dino-e2e.test`. Reset fixture cuối phiên thành công, khôi phục hồ sơ địa chỉ/giỏ/voucher/tồn kho/đơn mẫu và xóa dữ liệu phát sinh của hai Buyer. Các Order ID dùng làm bằng chứng đã bị reset; chưa có Order còn sống để bàn giao Người 4.
- **Phân loại bằng chứng:** `live` = Playwright/browser gọi backend và Supabase dev/test; `PostgreSQL` = integration test với schema tạm riêng; `mock/unit` = test không chứng minh kết nối live.

| Mã | Kết quả đợt 2 | Bằng chứng / giới hạn |
|---|---|---|
| `T2-P2-01` | **Đạt (live)** | Playwright đăng nhập, sửa tên/SĐT, xác nhận email/role chỉ đọc, tải avatar và kiểm tra sau reload. |
| `T2-P2-02` | **Đạt (live)** | Tạo/sửa/xóa địa chỉ, chuyển default, dữ liệu sai trả 422; sau khi xóa địa chỉ default, địa chỉ còn lại được giữ làm default. |
| `T2-P2-03` | **Đạt (live + PostgreSQL)** | Buyer phụ thử đọc/sửa địa chỉ, giỏ, đơn và notification của Buyer chính đều bị từ chối 404; giỏ riêng không lộ item. DB tests xác nhận owner scope. |
| `T2-P2-04` | **Đạt (live)** | Số lượng và lựa chọn còn sau reload; 0/âm bị 422, vượt tồn bị 409. Phát hiện và sửa lỗi API trước đây nhận số lượng vượt tồn; regression test xác nhận giỏ không đổi khi bị từ chối. |
| `T2-P2-05` | **Đạt (live + DB đối chiếu)** | Checkout COD một Shop với `E2E-SAVE` tạo `PENDING_CONFIRMATION`; DB xác nhận subtotal 100.000, giảm 10.000, ship 25.000, tổng 115.000, snapshot địa chỉ/giá, notification và tồn giảm đúng. Order kiểm chứng đã được reset. |
| `T2-P2-06` | **Đạt (live + PostgreSQL)** | Voucher hết hạn, hết lượt, sai Shop, chưa đạt mức tối thiểu đều bị từ chối; quote phí ship thay đổi trước submit không tạo Order và không đổi giỏ/tồn. Phát hiện và sửa lỗi voucher hết hạn bị đánh giá hợp lệ. |
| `T2-P2-07` | **Đạt (PostgreSQL)** | Replay cùng idempotency key không tạo/trừ lần hai; payload khác bị từ chối; kiểm thử tranh tồn cuối không làm tồn âm. |
| `T2-P2-08` | **Đạt (PostgreSQL)** | Checkout nhiều Shop tạo Order theo Shop khi thành công; lỗi ở một Shop rollback toàn giao dịch, gồm dữ liệu và voucher. |
| `T2-P2-09` | **Đạt (live + PostgreSQL)** | Thiếu lý do hủy 422; hủy hợp lệ thành công; hủy lặp và hủy sau Seller xác nhận bị từ chối. DB concurrency xác nhận hoàn tồn đúng một lần. |
| `T2-P2-10` | **Đạt (live + PostgreSQL)** | Review sớm, rating ngoài 1–5 và sai Buyer bị từ chối; review đúng OrderItem hoàn tất tạo 201, review trùng 409. PostgreSQL kiểm tra transaction/media. |
| `T2-P2-11` | **Đạt (live)** | Buyer đọc notification, đánh dấu đã đọc và trạng thái vẫn còn sau reload. |

### Kiểm tra tự động và thay đổi fixture

- Frontend Buyer Vitest: **42/42 pass** (7 file). Fixture reset/account guard: **6/6 pass**. Voucher port unit tests: **7/7 pass**.
- Playwright live: **10/10 pass** qua đăng nhập, guest access, hồ sơ/avatar, notification, địa chỉ, ownership, checkout thành công, voucher từ chối, hủy đơn và review.
- PostgreSQL integration: **59/59 pass** (checkout runtime 5, checkout transactions 32, checkout concurrency 1, address/order scope 12, cart 4, notification/review 5). Các suite tạo schema riêng và dọn schema sau khi chạy.
- Frontend lint, typecheck, build: pass. Backend build: pass. ESLint mục tiêu cho file Buyer/fixture đã sửa: pass. Backend full typecheck còn 2 lỗi có sẵn ngoài phạm vi ở `backend/tests/db/tiering-loyalty.integration.test.ts` (dòng 518, 578: `LoyaltyService` thiếu `quote` cho `ShippingFeeProvider`). Backend full lint có 22 warning cũ ở module `flash-sale`, ngoài phạm vi Người 2.
- E2E fixture reset cuối phiên: pass; backend/frontend dev server đã dừng. Các đơn live được dùng để đối chiếu đã bị xóa trong lần reset cuối.
- Thay đổi trong đợt này: thêm fixture Buyer phụ; reset có phạm vi ID/tài khoản fixture để xóa Order, Review, notification, idempotency, avatar/review media của hai Buyer, khôi phục địa chỉ/giỏ và giữ dữ liệu ngoài fixture. Auth account collision vẫn được guard. Không xóa dữ liệu người dùng khác.

### Lỗi và việc còn lại

- Đã sửa và retest 2 lỗi thuộc Buyer: API giỏ chấp nhận số lượng vượt tồn; voucher hết hạn được đánh giá hợp lệ khi không truyền thời điểm hiện tại.
- Không còn Blocker/Cao chưa xử lý trong 11 ca. Phần kiểm thử Người 2 đã hoàn tất. Việc còn lại để khép luồng phối hợp `T2-E2E-01/02` là tạo một Order mới trong phiên liên tục và bàn giao Order ID cho Người 4; Order ID cũ đã được dọn theo yêu cầu reset cuối phiên nên không dùng tiếp được.


