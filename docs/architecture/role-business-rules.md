# Quy tắc nghiệp vụ theo vai trò — Dino MVP

> Cập nhật: 2026-10-01, đối chiếu code tại HEAD `fd353e1`. Tài liệu này là bản tra cứu theo vai trò để FE, BE và database triển khai nhất quán. Mã quy tắc và thứ tự ưu tiên vẫn theo [Architecture Rules](rules/README.md), [Business Rules QD/RB](rules/business-rules.md), [Auth/RBAC/RLS](rules/auth-rbac-rls.md) và [Schema Freeze](../spec/schema-freeze-v1.md). Bảng đối chiếu mô tả code hiện tại và acceptance còn lại; nó không thay thế kết quả chạy test.

Các thay đổi vận hành Seller ở tài liệu này thuộc [CR-SELLER-01](../spec/changes/CR-SELLER-01-full-seller-operations.md), đã được Chủ dự án duyệt ngày 2026-10-01. Phần nào chưa triển khai vẫn được ghi riêng là backlog.

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
| Tài khoản và Shop | List/detail có phân trang; duyệt/khóa/mở khóa Shop, khóa/mở khóa User bằng command chuyên biệt. Mutation yêu cầu reason, kiểm tra target/state và ghi AdminLog cùng transaction; không khóa target ADMIN (QD17, QD20). |
| Category và kiểm duyệt | Quản lý category toàn sàn; cây tối đa hai cấp (RB-KN04), ngừng bằng `INACTIVE`. Admin HIDE/RESTORE Product/Review phải có reason và ghi moderation record + AdminLog atomic; Seller không tự mở Product `HIDDEN`. |
| Order | Admin xem và can thiệp bằng command theo state machine, reason, history và audit trong transaction; không cập nhật trực tiếp trạng thái hoặc snapshot giao dịch (QD11, QD20). Hủy đơn không được hoàn tồn hai lần. |
| Voucher và campaign | Admin chỉ tạo/sửa/đổi trạng thái voucher scope `PLATFORM` (luôn `shop_id=NULL`). Campaign chọn nhóm BUYER hoặc SELLER, snapshot recipient lúc tạo và dùng idempotency để retry không gửi trùng. |
| Audit và báo cáo | Audit viewer chỉ đọc, có filter/cursor. Report GMV/top shop/top product chỉ tính Order `COMPLETED` (QD19), nhóm ngày theo `Asia/Ho_Chi_Minh`; lượt vi phạm lấy từ moderation records, không giả định có user report. |
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
| Hồ sơ chung | `GET/PATCH /profile` nhận Buyer/Seller/Admin; profile guard không phụ thuộc Shop ACTIVE. Avatar có luồng attach media riêng. | Đã tách hồ sơ cá nhân khỏi Shop status trong runtime; Seller `PENDING` vẫn sửa profile cá nhân. |
| Địa chỉ Buyer | Các route `/addresses` chỉ nhận Buyer; checkout dùng Address của Buyer. `profile-screen.tsx` chỉ render `AddressManager` khi role là Buyer. | Phân biệt đã có ở runtime; Seller cần hồ sơ Shop riêng theo CR-SELLER-01, không dùng `/addresses`. |
| Địa chỉ Shop | `GET/PATCH /seller/shop` đọc và sửa Shop theo `context.user_id → shops.owner_id`; cho sửa khi `PENDING`/`ACTIVE`, chỉ đọc khi `SUSPENDED`/`LOCKED`. | Đã triển khai API và màn `/seller/shop`. `/addresses` tiếp tục chỉ dành cho Buyer. Admin approve yêu cầu pickup address và contact phone trong transaction. |
| Dashboard Seller | `GET /seller/kpi` tự suy Shop từ auth context; doanh thu theo QD19. | Đã bỏ KPI mock/Shop ID khỏi Admin repository và nối dashboard với Seller API. Cần xác nhận báo cáo runtime trên PostgreSQL test. |
| Catalog Seller | `/seller/products` trả cursor page; `GET /seller/products/:id` trả chi tiết riêng tư gồm variant inactive; `PATCH /seller/products/:id` sửa thông tin/variant/ảnh; Seller không được tự mở Product `HIDDEN`. | Code có list/detail/edit, stock/status command riêng, media finalize và ảnh thêm/xóa. PostgreSQL image-update test và UI tests đã được thêm sau snapshot progress trước; cần ghi kết quả chạy mới. Variant add/remove integration trước đó gặp `ETIMEDOUT` và cần rerun. |
| Đơn bán | `GET /orders` phân trang theo Shop từ context; detail có `status_history`; checkout, hủy và đổi trạng thái ghi Notification trong transaction. | Runtime và integration evidence cũ đã có cho pagination/history, checkout và order. Full browser E2E Seller fulfillment tích hợp backend/DB thật vẫn chưa được ghi nhận. |
| Notification Seller | Seller đọc/đánh dấu Notification recipient của chính mình; không bắt buộc Shop ACTIVE. | Đã mở UI/runtime cho Seller và nối event đơn mới/hủy/hoàn tất. |
| Voucher Shop | `/seller/vouchers` CRUD/status tự gắn Shop; không sửa điều kiện nếu đã được dùng. | API/UI và error `VOUCHER_ALREADY_USED` đã có; PostgreSQL cross-Shop/used-voucher evidence được ghi trong log trước. Cần rerun gate sau cập nhật và xác minh trong checkout E2E thật. |
| Revenue report | `/seller/reports/revenue` lọc ngày, tự scope Shop, chỉ tính Order `COMPLETED`. | API/UI và PostgreSQL QD19/date/Shop-scope evidence đã có trong log trước. Focused UI test đã được thêm; cần ghi kết quả mới và kiểm chứng report trong full flow thật. |
| Buyer/Seller đồng vai trò | `app_users.role` chỉ chứa một giá trị; Buyer routes và Seller routes kiểm tra role riêng. | Chưa mở tính năng mua hàng bằng Seller account cho tới khi có quyết định nghiệp vụ và thay đổi quyền tương ứng. |
| Review ảnh | Review text/rating có API; media lifecycle nhận diện purpose `REVIEW`, nhưng việc attach ảnh review qua runtime/UI chưa được xác nhận hoàn chỉnh trong phạm vi Seller CR. | Xác minh luồng upload/attach Review end-to-end trước khi coi ảnh review đã hoàn tất; không coi preview là upload thật. |
| Admin | User/Shop/Category, Product/Review moderation, Orders, PLATFORM vouchers, campaigns, audit viewer và reports đã có trong code; ADMIN-00–11 được ghi DONE. | ADMIN-12 accessibility audit, ADMIN-13 browser E2E/RBAC và ADMIN-14 final gates/test DB độc lập còn mở trong [Admin progress](../progress/mvp-user-admin.md). |

**Đối chiếu Auth/RBAC:** [Auth/RBAC/RLS](rules/auth-rbac-rls.md#role-và-ownership) hiện đã tách Profile chung, sổ địa chỉ Buyer và hồ sơ/địa chỉ Shop Seller theo đúng flow MVP. Nếu phát sinh thay đổi quyền, đi theo quy trình Change Request trong [Architecture Rules](rules/README.md#quy-tắc-quản-lý-thay-đổi).
