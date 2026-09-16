# Authentication RBAC and RLS

## 1. Nguồn định danh

- Supabase Auth là nguồn định danh duy nhất.
- `auth.users.id` ánh xạ 1:1 tới `app_users.user_id`.
- JWT `sub` là ID người dùng; Payload không chấp nhận `user_id` do client gửi để thay thế `sub`.
- Role và status trong `app_users` là nguồn quyền chuẩn. Payload phải tải chúng sau khi xác minh JWT; không tin role do client gửi và không coi custom claim lâu hạn là nguồn duy nhất.
- Guest là request chưa xác thực, không phải record hoặc role trong database.

## 2. Xác minh request

Mọi protected request phải:

1. Đọc bearer token từ header.
2. Xác minh chữ ký theo JWKS, issuer, audience và expiration.
3. Lấy `sub` và kiểm tra UUID hợp lệ.
4. Tải `app_users` theo `sub`.
5. Trả `401 AUTH_INVALID_TOKEN` nếu token không hợp lệ hoặc không ánh xạ được User.
6. Trả `403 USER_LOCKED` nếu `status = LOCKED`.
7. Dựng `RequestContext` bất biến gồm `request_id`, `user_id`, `role`; với Seller, tải `shop_id` từ ownership.

Không log access token, refresh token hoặc Authorization header.

## 3. Role và ownership

| Hành vi | Guest | Buyer | Seller | Admin |
|---|---:|---:|---:|---:|
| Xem nội dung công khai | ✓ | ✓ | ✓ | ✓ |
| Quản lý hồ sơ/địa chỉ của mình |  | ✓ | ✓ | ✓ |
| Quản lý giỏ và checkout |  | ✓ |  |  |
| Xem/hủy Order mua của mình |  | ✓ |  | ✓ |
| Tạo Review đủ điều kiện |  | ✓ |  | Kiểm duyệt |
| Tạo/quản lý Shop |  |  | Shop sở hữu | Kiểm soát |
| Quản lý Product/Variant |  |  | Shop sở hữu | Kiểm duyệt |
| Xử lý Order bán |  |  | Shop sở hữu | Can thiệp có audit |
| Quản lý voucher Shop |  |  | Shop sở hữu | ✓ |
| Quản lý category toàn sàn |  |  |  | ✓ |
| Quản lý User/Shop/vi phạm |  |  |  | ✓ |
| Báo cáo |  | Cá nhân khi có | Shop sở hữu | Toàn hệ thống |

- Role chỉ là điều kiện đầu tiên; resource ownership luôn phải được kiểm tra riêng.
- Seller ownership đi theo `app_users.user_id → shops.owner_id`.
- Buyer ownership đi theo `orders.buyer_id`, `addresses.user_id`, `carts.buyer_id`, `notifications.recipient_id`.
- Resource riêng tư không thuộc người gọi nên trả `404 RESOURCE_NOT_FOUND` khi cần tránh tiết lộ tồn tại; hành vi quản trị bị cấm rõ ràng có thể trả `403 RESOURCE_FORBIDDEN`.

## 4. Quy tắc theo nhóm dữ liệu

### Public read

- Chỉ Category/Shop/Product/ProductVariant/Review ở trạng thái công khai được trả cho Guest.
- Query public phải filter status ở backend; không dựa vào UI ẩn dữ liệu.

### Buyer private data

- Buyer chỉ truy cập Address, Cart, CartItem, Order, OrderItem, Payment, Shipment, VoucherUsage, Review và Notification thuộc chính mình.
- Khi tạo Review, backend suy ra BuyerID từ `RequestContext`, không nhận BuyerID tùy ý.

### Seller private data

- Seller chỉ thao tác Product, ProductImage, ProductVariant, Voucher, Order và Shipment thuộc Shop sở hữu.
- `shop_id` trong body không đủ chứng minh ownership; backend phải join/lookup từ User.
- Seller không được đọc dữ liệu Buyer ngoài phần cần thiết để thực hiện Order thuộc Shop.

### Admin

- Admin có thể đọc dữ liệu cần thiết cho quản trị nhưng mọi write nhạy cảm phải qua command chuyên biệt.
- Khóa, mở khóa, ẩn, khôi phục và can thiệp Order phải ghi reason khi rule yêu cầu và tạo AdminLog.
- Không tạo endpoint “admin update any column”.

## 5. RLS policy

Frontend không truy cập trực tiếp bảng nghiệp vụ. RLS vẫn phải bật theo nguyên tắc defense-in-depth:

- `anon` và `authenticated` mặc định không có quyền trực tiếp trên 22 bảng nghiệp vụ.
- Không tạo policy CRUD rộng kiểu `USING (true)` cho bảng private.
- Backend dùng credential chỉ tồn tại phía server; service-role key không được đưa vào `NEXT_PUBLIC_*`, bundle frontend, log hoặc error response.
- Nếu tương lai cho phép direct Supabase access, phải có CR Approved, policy từng bảng và bộ RLS test riêng trước khi mở quyền.
- Payload vẫn phải RBAC/ownership đầy đủ kể cả khi kết nối DB bằng role có thể bypass RLS.

## 6. Storage

- Bucket public chỉ dành cho asset thực sự công khai và không nhạy cảm.
- Upload private hoặc write phải được Payload authorize trước.
- Signed URL có TTL ngắn và chỉ cấp cho object người dùng có quyền truy cập.
- Object path phải do backend tạo theo domain/user/shop; không dùng filename từ client làm path tin cậy.
- Validate MIME, kích thước và extension; không tin `Content-Type` client đơn lẻ.
- Khi database transaction thất bại sau upload, phải có cleanup job hoặc quy trình xóa object mồ côi.

## 7. Khóa tài khoản và thu hồi quyền

- `User.Status = LOCKED` được kiểm tra trên mọi protected request, không chờ JWT hết hạn.
- Thay đổi role/status có hiệu lực ở request tiếp theo vì backend đọc database.
- Refresh token/session có thể bị thu hồi qua Supabase khi khóa tài khoản, nhưng database check vẫn là hàng rào bắt buộc.
- Seller bị khóa Shop không được tạo/sửa Product, Voucher hoặc xử lý Order mới ngoài hành vi được Admin cho phép rõ ràng.

## 8. Security acceptance tests

- Thiếu/hỏng/hết hạn token → `401`.
- Token hợp lệ nhưng User bị khóa → `403 USER_LOCKED`.
- Buyer A không đọc Address/Order/Notification của Buyer B.
- Seller A không thao tác Product/Order/Voucher của Seller B.
- Guest không truy cập endpoint private.
- Admin action nhạy cảm thiếu reason bị từ chối và không ghi thay đổi.
- Không có service-role key trong frontend build hoặc response.
- Direct query bằng `anon`/`authenticated` không đọc được bảng nghiệp vụ.
