# Quy tắc nghiệp vụ theo vai trò — Dino MVP

> Cập nhật: 2026-10-01. Tài liệu này là bản tra cứu theo vai trò để FE, BE và database triển khai nhất quán. Mã quy tắc và thứ tự ưu tiên vẫn theo [Architecture Rules](rules/README.md), [Business Rules QD/RB](rules/business-rules.md), [Auth/RBAC/RLS](rules/auth-rbac-rls.md) và [Schema Freeze](../spec/schema-freeze-v1.md). Mục **Chưa triển khai/lệch code** là backlog, không có nghĩa API tương ứng đã hoạt động.

Phần bổ sung Seller tự sửa địa chỉ lấy hàng là hướng phát triển đã thống nhất cho UX; trước khi đổi business rule/API đã khóa, cần ghi Change Request theo quy trình kiến trúc hiện hành.

## 1. Khái niệm và nguyên tắc chung

- `Guest` là người chưa đăng nhập; không phải role lưu trong database. User đã xác thực có đúng một `app_users.role` trong `BUYER | SELLER | ADMIN` và status `ACTIVE | LOCKED`. Không giả định một tài khoản có đồng thời hai role trong MVP (RB-MG01, QD03).
- `UserProfile` là hồ sơ cá nhân của chủ tài khoản: tên, số điện thoại, avatar. Cả ba role đều quản lý hồ sơ **của mình**; email và role không sửa qua Profile API.
- `Address` / `addresses` là **địa chỉ nhận hàng của Buyer** dùng khi checkout. `Shop.pickup_address` là **địa chỉ lấy hàng của cửa hàng Seller**. Hai loại địa chỉ có chủ sở hữu và mục đích khác nhau; không dùng `/addresses` để lưu địa chỉ Shop.
- `Order.delivery_address` là snapshot của địa chỉ nhận hàng tại lúc checkout. Sửa hoặc xóa Address sau đó không làm đổi Order đã tạo (quy tắc snapshot trong Schema Freeze; QD08 áp dụng riêng cho giá Order).
- Role quyết định nhóm hành động có thể thực hiện; backend còn phải kiểm tra chủ sở hữu tài nguyên và trạng thái Shop/Order/Product. FE chỉ hiển thị hành động hợp lệ, backend là nơi từ chối request không hợp lệ (QD04, QD13, RB-LQH07).
- `LOCKED` chặn mọi protected request dù phiên đăng nhập còn hiệu lực (QD03). Dữ liệu công khai vẫn chỉ hiện theo trạng thái công khai của Category, Shop, Product và Review.

## 2. Guest — chưa đăng nhập

| Được làm | Không được làm | Điều kiện/nguồn |
|---|---|---|
| Xem catalog, chi tiết sản phẩm, category và review công khai | Đọc/sửa hồ sơ, địa chỉ, giỏ hàng, đơn hàng, thông báo hoặc dữ liệu quản trị | Backend lọc trạng thái công khai; [Auth/RBAC/RLS](rules/auth-rbac-rls.md#public-read) |
| Mở đăng ký, đăng nhập | Tạo đơn, đánh giá, mở Shop hoặc dùng API private khi chưa có phiên | Protected API yêu cầu JWT hợp lệ |

Guest bấm hành động private được đưa tới đăng nhập và quay lại luồng phù hợp; UI không được biến lỗi `401` thành dữ liệu demo.

## 3. Buyer — mua hàng

| Nghiệp vụ | Quy tắc |
|---|---|
| Hồ sơ | Xem/sửa tên, số điện thoại và avatar của chính mình. Email/role chỉ đọc. |
| Địa chỉ nhận hàng | Tạo, xem, sửa, xóa và đặt mặc định Address của chính mình; tối đa một địa chỉ mặc định (RB-LB05). Checkout phải dùng Address thuộc Buyer hiện tại. |
| Giỏ hàng và checkout | Quản lý Cart của mình; số lượng dương, hàng/Shop hợp lệ, không vượt tồn. Checkout lấy giá/tồn/voucher hiện hành ở backend, dùng idempotency key; nhiều Shop tạo nhiều Order, mỗi Order thuộc một Shop (QD05–QD10, RB-LB03–04). |
| Đơn mua | Chỉ xem Order mình mua. Buyer chỉ hủy ở `PENDING_CONFIRMATION` với lý do; có thể xác nhận đã nhận hàng khi Order ở `SHIPPING` và điều kiện giao hàng hợp lệ (QD12, [order workflow](rules/order-workflow-transactions.md)). |
| Đánh giá | Chỉ đánh giá OrderItem đã mua của Order `COMPLETED`; rating 1–5 và tối đa một Review/OrderItem (QD14–15, RB-LB09). |
| Thông báo | Chỉ đọc/đánh dấu đã đọc Notification của chính mình; `is_read` và `read_at` cập nhật cùng nhau (RB-LTT07). |

Buyer không có quyền sửa Shop/Product, xử lý đơn bán hoặc truy cập Admin. Address của Buyer không phải địa chỉ lấy hàng của Shop.

## 4. Seller — vận hành Shop sở hữu

| Nghiệp vụ | Quy tắc |
|---|---|
| Hồ sơ cá nhân | Quản lý UserProfile và avatar của chính mình như các role đã đăng nhập. |
| Mở Shop | Onboarding Seller tạo tối đa một Shop/User ở trạng thái `PENDING`; Admin duyệt mới thành `ACTIVE` (RB-LB02). Role `SELLER` không tự chứng minh Shop đã được duyệt. |
| Địa chỉ Shop | Địa chỉ phục vụ lấy hàng thuộc `shops.pickup_address` của Shop sở hữu. UI Seller phải gọi luồng Shop, không render “Địa chỉ giao hàng” của Buyer hoặc gọi `/addresses`. Không chép địa chỉ này sang Address của Buyer. |
| Sản phẩm, tồn kho, voucher Shop | Chỉ quản lý dữ liệu của Shop sở hữu khi Shop đủ điều kiện hoạt động; giá > 0, tồn kho >= 0, SKU duy nhất trong Shop; không thao tác Shop khác (QD04–06, RB-LB11, RB-LQH07). |
| Đơn bán và giao hàng | Chỉ xem/xử lý Order của Shop mình. Chuyển trạng thái theo state machine; hủy phải có lý do và hoàn tồn đúng một lần theo chính sách. Seller không sửa snapshot địa chỉ nhận hàng, giá hoặc người mua trong Order (QD11, QD13, [order workflow](rules/order-workflow-transactions.md)). |
| Báo cáo | Dữ liệu chỉ thuộc Shop sở hữu; doanh thu chỉ tính Order hợp lệ ở trạng thái `COMPLETED` (QD19). |

Shop `PENDING`, `SUSPENDED` hoặc `LOCKED` không được thực hiện seller business writes như tạo/sửa Product hay xử lý Order; cần thông báo trạng thái và hướng xử lý phù hợp. Các thao tác hồ sơ cá nhân phải tách khỏi guard Shop ACTIVE; Seller `PENDING` cần hoàn thiện được hồ sơ Shop, bao gồm địa chỉ lấy hàng, qua luồng riêng có kiểm tra owner. Seller không mặc nhiên có quyền Buyer: MVP hiện dùng một role/tài khoản. Nếu muốn Seller cũng mua hàng, phải quyết định rõ mô hình đa vai trò và cập nhật RBAC/API trước khi hiển thị giỏ hoặc địa chỉ nhận hàng cho Seller.

## 5. Admin — quản trị sàn

| Nghiệp vụ | Quy tắc |
|---|---|
| Tài khoản và Shop | Xem danh sách phục vụ quản trị, duyệt/khóa/mở khóa Shop, khóa/mở khóa User bằng command chuyên biệt. Hành động nhạy cảm phải kiểm tra target, lý do khi cần và ghi AdminLog trong cùng transaction (QD17, QD20). |
| Category và kiểm duyệt | Quản lý category toàn sàn; cây category tối đa hai cấp (RB-KN04). Ẩn/khôi phục nội dung phải qua quyền và audit tương ứng; không dùng quyền Seller để sửa Shop tùy ý. |
| Order | Chỉ can thiệp bằng command có kiểm tra trạng thái, lý do/history/audit; không cập nhật trực tiếp cột trạng thái hoặc snapshot giao dịch (QD11, QD20). |
| Hồ sơ cá nhân | Sửa UserProfile và avatar của chính Admin; không đồng nghĩa được sửa hồ sơ người khác bằng Profile API. |

Admin không có quyền tổng quát “update bất kỳ bảng/cột”. Admin Portal là giao diện quản trị; nếu cần thực hiện hành động thay Seller hoặc Buyer, phải có API quản trị riêng với kiểm tra và audit. Không suy quyền chỉ từ việc FE cho mở một trang Seller.

## 6. Ranh giới dữ liệu và trạng thái cần giữ

| Dữ liệu | Chủ sở hữu/điều kiện truy cập | Quy tắc bất biến |
|---|---|---|
| UserProfile/avatar | User hiện tại | Không tin `user_id` do client gửi để sửa người khác. |
| Buyer Address | `addresses.user_id` | API Buyer-only trong MVP; một default/User; checkout dùng đúng Address của Buyer. |
| Shop và địa chỉ lấy hàng | `shops.owner_id`; Admin dùng command quản trị | Một Shop/User; `pickup_address` không thay cho Address giao hàng. |
| Cart/Order mua/Review/Notification | Buyer sở hữu | Không lộ dữ liệu Buyer khác; Review cần Order completed. |
| Product/Order bán/Voucher Shop | Shop Seller sở hữu | Không cho cross-shop read/write; kiểm tra trạng thái Shop và đối tượng. |
| Order sau checkout | Buyer + một Shop; Admin có quyền xem theo nhiệm vụ | Giữ snapshot người nhận, địa chỉ, giá và OrderItems; đổi trạng thái qua state machine. |

Khi một tài nguyên private không thuộc người gọi, backend có thể trả `404 RESOURCE_NOT_FOUND` để tránh tiết lộ sự tồn tại; sai role rõ ràng trả `403`. FE không gọi API của role khác rồi hiển thị raw error cho người dùng.

## 7. Đối chiếu code và việc cần làm tiếp

| Mục | Hiện trạng code 2026-10-01 | Việc cần làm |
|---|---|---|
| Hồ sơ chung | `GET/PATCH /profile` khai báo Buyer/Seller/Admin, nhưng guard hiện còn chặn Seller có Shop chưa ACTIVE; avatar có luồng attach media riêng. | Giữ hồ sơ cá nhân dùng chung và tách profile guard khỏi điều kiện Shop ACTIVE; Shop `PENDING` vẫn phải sửa được hồ sơ của mình. |
| Địa chỉ Buyer | Các route `/addresses` chỉ nhận Buyer; checkout dùng Address của Buyer. | Chỉ render `AddressManager` cho Buyer. Hiện [`profile-screen.tsx`](../../frontend/src/features/profile/profile-screen.tsx) render component này cho mọi role, nên Seller gặp `Required role: BUYER`. |
| Địa chỉ Shop | Bảng `shops` có `pickup_address`; onboarding Seller chỉ nhận `shop_name` và tạo Shop `PENDING`. Chưa thấy Seller self-service route để sửa `pickup_address`. | Thiết kế API có ownership check và UI hồ sơ Shop để Seller nhập/sửa địa chỉ lấy hàng. Không gọi `/addresses` cho việc này. |
| Buyer/Seller đồng vai trò | `app_users.role` chỉ chứa một giá trị; Buyer routes và Seller routes kiểm tra role riêng. | Chưa mở tính năng mua hàng bằng Seller account cho tới khi có quyết định nghiệp vụ và thay đổi quyền tương ứng. |
| Review ảnh | Review text/rating có API; media runtime hiện từ chối purpose `REVIEW`, UI ảnh còn data URL/progress giả. | Hoàn thiện Review media riêng; không coi preview là upload thật. |
| Admin | Có routes quản lý User/Shop/Category; các acceptance về audit, RBAC và UI còn được theo dõi trong [implementation plan](../frontend-spec/08-implementation-plan.md). | Hoàn tất từng command và bằng chứng quyền theo rule tương ứng; không mở quyền ghi tùy ý. |

**Điểm cần đồng bộ trong tài liệu cũ:** [Auth/RBAC/RLS](rules/auth-rbac-rls.md#role-và-ownership) đang gộp “hồ sơ/địa chỉ của mình” cho Buyer, Seller và Admin. Với flow MVP hiện tại, Profile là chung, còn `/addresses` là địa chỉ nhận hàng của Buyer; Seller dùng `Shop.pickup_address`. Khi sửa rule đã Approved, đi theo quy trình Change Request trong [Architecture Rules](rules/README.md#quy-tắc-quản-lý-thay-đổi).
