# Business Rules

## 1. Cách sử dụng

Nội dung nghiệp vụ gốc nằm trong [`../../spec/schema-freeze-v1.md`](../../spec/schema-freeze-v1.md). File này ánh xạ từng QD và RBTV sang thời điểm kiểm tra, tầng thực thi, error code và loại test. Khi mô tả khác nhau, Schema Freeze và CR Approved có ưu tiên cao hơn.

## 2. QD01-QD20

| Rule | Thời điểm | Tầng thực thi | Error code | Test bắt buộc |
|---|---|---|---|---|
| QD01 Email/tên đăng nhập duy nhất | Tạo/đồng bộ User | Service + UNIQUE | `USER_EMAIL_CONFLICT` | Hai request dùng cùng email; race concurrent |
| QD02 Không lưu mật khẩu plaintext | Đăng ký/đăng nhập | Supabase Auth | `AUTH_CONFIGURATION_ERROR` | Không có cột password; log không chứa password |
| QD03 User bị khóa không làm nghiệp vụ đăng nhập | Mọi protected request | Auth middleware | `USER_LOCKED` | JWT còn hạn nhưng User `LOCKED` vẫn bị chặn |
| QD04 Seller chỉ quản lý Shop/sản phẩm sở hữu | Mọi seller command | Service ownership | `RESOURCE_FORBIDDEN` | Seller A không đọc/ghi dữ liệu riêng của Seller B |
| QD05 Giá sản phẩm > 0 | Tạo/sửa variant | Service + CHECK | `VALIDATION_FAILED` | 0, số âm, decimal hợp lệ |
| QD06 Tồn kho >= 0 | Sửa tồn/tạo Order | Service + CHECK | `STOCK_INVALID` | Update âm và concurrent decrement |
| QD07 Số lượng đặt không vượt tồn | Transaction tạo Order | Service transaction | `INVENTORY_INSUFFICIENT` | Hai checkout cạnh tranh không làm tồn âm |
| QD08 Giá Order là snapshot | Tạo OrderItem | Service transaction | `ORDER_SNAPSHOT_INVALID` | Đổi giá variant không đổi Order cũ |
| QD09 Voucher phải hợp lệ | Checkout/tạo Order | Voucher service | `VOUCHER_NOT_APPLICABLE` | Hết hạn, hết lượt, sai Shop, không đủ min order |
| QD10 Tổng thanh toán không âm | Tạo Order | Service + CHECK | `ORDER_TOTAL_INVALID` | Discount lớn hơn tổng; công thức decimal |
| QD11 Chuyển trạng thái theo luồng | Mọi transition | Order service | `ORDER_INVALID_TRANSITION` | Mỗi cạnh hợp lệ và transition bị cấm |
| QD12 Buyer chỉ hủy khi cho phép | Cancel command | Order service | `ORDER_CANCELLATION_NOT_ALLOWED` | Buyer hủy pending; không hủy shipping/completed |
| QD13 Seller chỉ xử lý Order của Shop mình | Seller order command | Ownership service | `RESOURCE_FORBIDDEN` | Seller chéo Shop bị chặn |
| QD14 Chỉ Buyer đã mua Order completed được review | Tạo Review | Review service | `REVIEW_NOT_ELIGIBLE` | Sai Buyer/Product/OrderItem, chưa completed |
| QD15 Rating từ 1 đến 5 | Tạo/sửa Review | Service + CHECK | `VALIDATION_FAILED` | 0, 6, số không nguyên |
| QD16 Không xóa vật lý dữ liệu giao dịch | Delete/deactivate | Service + FK/RESTRICT | `RESOURCE_DELETE_NOT_ALLOWED` | Product/Shop/User có giao dịch chỉ đổi status |
| QD17 Khóa/ẩn phải có lý do | Moderation command | Service | `REASON_REQUIRED` | Chuỗi rỗng/whitespace bị từ chối |
| QD18 Không lưu dữ liệu thẻ thật | Payment request/log/storage | API + security policy | `PAYMENT_DATA_NOT_ALLOWED` | Payload chứa PAN/CVV bị từ chối; log redaction |
| QD19 Doanh thu chỉ tính Order hợp lệ/completed | Reporting query | Reporting service | `REPORT_FILTER_INVALID` | Không tính cancelled/failed/pending |
| QD20 Admin action quan trọng phải có log | Admin transaction | Service + append log | `AUDIT_WRITE_FAILED` | Action và AdminLog commit/rollback cùng nhau |

## 3. Phân bổ RBTV

### RB-KC

| Rule | Thời điểm | Owner | Lỗi/Test |
|---|---|---|---|
| RB-KC01 | DDL và mọi INSERT | Database | PK của đủ 22 bảng; duplicate/null bị từ chối |
| RB-KC02 | DDL và tạo UserProfile | Database | `UserProfile.UserID` vừa PK vừa FK; test quan hệ 1:0..1 |

### RB-KN

| Rule | Quan hệ | Owner | Lỗi/Test |
|---|---|---|---|
| RB-KN01 | User → `auth.users` | Database/Auth sync | User không có Auth subject bị từ chối |
| RB-KN02 | Address → User | Database | Orphan Address bị từ chối |
| RB-KN03 | Shop → User | Database | Orphan Shop bị từ chối |
| RB-KN04 | Category → parent Category | Database + Service depth | Parent không tồn tại và cấp thứ ba bị từ chối |
| RB-KN05 | Product → Shop, Category | Database | Orphan Product bị từ chối |
| RB-KN06 | ProductImage → Product | Database | Orphan image bị từ chối |
| RB-KN07 | ProductVariant → Product | Database | Orphan variant bị từ chối |
| RB-KN08 | Cart → User | Database | Orphan Cart bị từ chối |
| RB-KN09 | CartItem → Cart, Variant | Database | Orphan item bị từ chối |
| RB-KN10 | Order → Buyer, Shop | Database | Orphan Order bị từ chối |
| RB-KN11 | OrderItem → Order, Product, Variant | Database | Orphan snapshot row bị từ chối |
| RB-KN12 | History → Order, ChangedBy | Database | Order bắt buộc; ChangedBy nullable hợp lệ |
| RB-KN13 | Payment → Order | Database | Orphan Payment bị từ chối |
| RB-KN14 | Shipment → Order | Database | Orphan Shipment bị từ chối |
| RB-KN15 | Voucher → Shop khi có | Database + Service scope | PLATFORM/SHOP consistency test |
| RB-KN16 | VoucherUsage → Voucher, Order, Buyer | Database | Orphan usage bị từ chối |
| RB-KN17 | Review → Buyer, Product, OrderItem | Database + Review service | FK và eligibility test |
| RB-KN18 | ReviewImage → Review | Database | Orphan image bị từ chối |
| RB-KN19 | Notification → Recipient | Database | Orphan notification bị từ chối |
| RB-KN20 | Moderation/AdminLog → Admin; polymorphic target | Database + Service | Admin FK; target type/id tồn tại hoặc NULL đúng rule |

FK violation do client gây ra được chuyển thành `RESOURCE_NOT_FOUND` hoặc domain error phù hợp; không trả tên constraint thô.

### RB-MG

| Rule | Owner | Error code | Test chính |
|---|---|---|---|
| RB-MG01 Role hợp lệ | Database + identity service | `VALIDATION_FAILED` | Chỉ BUYER/SELLER/ADMIN |
| RB-MG02 User status hợp lệ | Database | `VALIDATION_FAILED` | ACTIVE/LOCKED |
| RB-MG03 Price > 0 | Database + catalog service | `VALIDATION_FAILED` | 0/âm bị chặn |
| RB-MG04 Stock >= 0 | Database + transaction | `STOCK_INVALID` | Không decrement âm |
| RB-MG05 Cart quantity >= 1 | Database + cart service | `VALIDATION_FAILED` | 0/âm bị chặn |
| RB-MG06 OrderItem numeric domains | Database + order service | `ORDER_SNAPSHOT_INVALID` | Giá, lượng và line total |
| RB-MG07 Order money >= 0 | Database + order service | `ORDER_TOTAL_INVALID` | Mọi trường tiền |
| RB-MG08 Rating 1-5 | Database + review service | `VALIDATION_FAILED` | Boundary 1/5 và ngoài miền |
| RB-MG09 Voucher numeric domains | Database + voucher service | `VALIDATION_FAILED` | Quantity/value/min/max |
| RB-MG10 Payment amount > 0 | Database + payment service | `PAYMENT_AMOUNT_INVALID` | 0/âm và mismatch Order |
| RB-MG11 Image sort order >= 0 | Database + media service | `VALIDATION_FAILED` | Số âm bị chặn |
| RB-MG12 Status domains | Database + domain services | `VALIDATION_FAILED` | Mỗi bảng chỉ nhận status đã khóa |

### RB-LTT

| Rule | Owner | Error code | Test chính |
|---|---|---|---|
| RB-LTT01 LineTotal = UnitPrice × Quantity | Database + Order service | `ORDER_TOTAL_INVALID` | Decimal multiplication |
| RB-LTT02 TotalAmount formula | Database + Order service | `ORDER_TOTAL_INVALID` | Có/không voucher, shipping fee |
| RB-LTT03 Voucher StartAt < EndAt | Database + Voucher service | `VALIDATION_FAILED` | Equal/reversed time |
| RB-LTT04 Percent trong `(0,100]` | Database + Voucher service | `VALIDATION_FAILED` | 0, 100, >100 |
| RB-LTT05 Scope quyết định ShopID | Database + Voucher service | `VALIDATION_FAILED` | PLATFORM/SHOP matrix |
| RB-LTT06 Payment SUCCESS cần PaidAt | Database + Payment service | `PAYMENT_STATE_INVALID` | Success thiếu timestamp |
| RB-LTT07 IsRead cần ReadAt | Database + Notification service | `VALIDATION_FAILED` | Mark read atomically |
| RB-LTT08 CANCELLED cần reason | Order service | `REASON_REQUIRED` | Empty/whitespace reason |

### RB-LB

| Rule | Owner | Error code | Test chính |
|---|---|---|---|
| RB-LB01 Email unique | Database + identity service | `USER_EMAIL_CONFLICT` | Concurrent registration |
| RB-LB02 Một Shop/User | Database + shop service | `SHOP_ALREADY_EXISTS` | Concurrent create |
| RB-LB03 Một Cart/Buyer | Database + cart service | `CART_CONFLICT` | Get-or-create concurrent |
| RB-LB04 Một Variant/dòng Cart | Database + cart service | `CART_ITEM_CONFLICT` | Add trùng chuyển thành tăng quantity có kiểm soát |
| RB-LB05 Một default Address/User | Partial unique index + service | `DEFAULT_ADDRESS_CONFLICT` | Hai update concurrent |
| RB-LB06 Voucher code unique | Database + voucher service | `VOUCHER_CODE_CONFLICT` | Case normalization được thống nhất |
| RB-LB07 Một VoucherUsage/Order | Database + transaction | `VOUCHER_ALREADY_APPLIED` | Retry không tạo usage thứ hai |
| RB-LB08 Một Shipment/Order | Database + shipment service | `SHIPMENT_ALREADY_EXISTS` | Concurrent create |
| RB-LB09 Một Review/OrderItem | Database + review service | `REVIEW_ALREADY_EXISTS` | Concurrent review |
| RB-LB10 Một Payment SUCCESS/Order | Partial unique index + payment service | `PAYMENT_ALREADY_COMPLETED` | Callback trùng/concurrent |
| RB-LB11 SKU unique trong Shop | Catalog service transaction | `SKU_CONFLICT` | Hai Product cùng Shop; Shop khác được phép |

### RB-LQH

| Rule | Thời điểm | Owner | Error code/Test |
|---|---|---|---|
| RB-LQH01 Subtotal bằng tổng LineTotal | Tạo Order | Order transaction | `ORDER_TOTAL_INVALID`; nhiều dòng |
| RB-LQH02 Total formula | Tạo Order | Order transaction | `ORDER_TOTAL_INVALID`; decimal exact |
| RB-LQH03 VoucherUsage khớp DiscountAmount | Tạo Order | Order/Voucher transaction | `VOUCHER_DISCOUNT_MISMATCH`; rollback |
| RB-LQH04 Payment bằng toàn bộ TotalAmount | Tạo/retry Payment | Payment service | `PAYMENT_AMOUNT_INVALID`; không partial |
| RB-LQH05 Review eligibility | Tạo Review | Review service transaction | `REVIEW_NOT_ELIGIBLE`; không hồi tố |
| RB-LQH06 Stock không âm | Tạo Order | Order transaction | `INVENTORY_INSUFFICIENT`; concurrency |
| RB-LQH07 Seller ownership | Mọi seller write | Authorization service | `RESOURCE_FORBIDDEN`; cross-shop |
| RB-LQH08 Revenue từ Order hợp lệ/completed | Chạy report | Reporting service | Không tính trạng thái khác |

## 4. Nguyên tắc lỗi và test

- Validation lặp ở client không thay thế Service/DB validation.
- Mỗi domain error trong bảng trên phải tồn tại trong [`error-observability.md`](error-observability.md).
- Mỗi rule phải có ít nhất một positive test và một negative test.
- Rule liên quan concurrency phải có integration test chạy hai transaction đồng thời.
- Rule thay đổi chỉ được cập nhật sau CR Approved và phải cập nhật [`testing-quality-gates.md`](testing-quality-gates.md).
