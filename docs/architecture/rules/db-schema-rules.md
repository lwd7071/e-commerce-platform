# Database Schema Rules

## 1. Nguồn chuẩn

[`../../spec/schema-freeze-v1.md`](../../spec/schema-freeze-v1.md) định nghĩa 22 bảng logic, cột và ràng buộc gốc. File này quy định cách triển khai vật lý trên PostgreSQL; không tự thay đổi ý nghĩa Schema Freeze.

## 2. Mapping tên bảng vật lý

| Tên logic | Tên PostgreSQL |
|---|---|
| `User` | `app_users` |
| `UserProfile` | `user_profiles` |
| `Address` | `addresses` |
| `Shop` | `shops` |
| `Category` | `categories` |
| `Product` | `products` |
| `ProductImage` | `product_images` |
| `ProductVariant` | `product_variants` |
| `Cart` | `carts` |
| `CartItem` | `cart_items` |
| `Order` | `orders` |
| `OrderItem` | `order_items` |
| `OrderStatusHistory` | `order_status_history` |
| `Payment` | `payments` |
| `Shipment` | `shipments` |
| `Voucher` | `vouchers` |
| `VoucherUsage` | `voucher_usages` |
| `Review` | `reviews` |
| `ReviewImage` | `review_images` |
| `Notification` | `notifications` |
| `ModerationRecord` | `moderation_records` |
| `AdminLog` | `admin_logs` |

- Tên bảng dùng danh từ số nhiều `snake_case`.
- `app_users` tránh xung đột với `auth.users` và từ khóa `USER`.
- `orders` tránh dùng tên `order` là từ khóa SQL.
- Tên cột chuyển cơ học từ PascalCase sang `snake_case`: `OrderID` → `order_id`, `CreatedAt` → `created_at`.

## 3. Kiểu dữ liệu và default

- PK nghiệp vụ dùng `UUID`; backend hoặc database có thể sinh UUID nhưng phải dùng một cơ chế thống nhất trong migration.
- Tiền dùng `NUMERIC(15,2)`, không dùng `REAL`, `FLOAT` hoặc JavaScript number trong phép tính quyết định.
- Thời gian dùng `TIMESTAMPTZ`; default thời điểm tạo là `now()` khi phù hợp.
- Boolean có default tường minh: `is_default`, `is_selected`, `is_read` mặc định `FALSE`.
- Status lưu `VARCHAR` kèm CHECK theo miền trong Schema Freeze v1; không dùng PostgreSQL enum trong MVP để migration trạng thái dễ kiểm soát.
- Chuỗi rỗng không thay thế `NULL`. Field optional dùng `NULL`; field bắt buộc có `NOT NULL` và validation độ dài.

## 4. Quy ước constraint

| Loại | Mẫu tên | Ví dụ |
|---|---|---|
| Primary key | `pk_<table>` | `pk_orders` |
| Foreign key | `fk_<table>__<column>` | `fk_orders__buyer_id` |
| Unique | `uq_<table>__<columns>` | `uq_cart_items__cart_id__variant_id` |
| Check | `ck_<table>__<meaning>` | `ck_product_variants__price_positive` |
| Index | `idx_<table>__<columns>` | `idx_orders__buyer_id__created_at` |

- Mọi constraint phải được đặt tên, không để PostgreSQL tự sinh tên.
- PK, FK và NOT NULL thuộc RB-KC/RB-KN phải nằm trong migration đầu tiên của bảng.
- Service validate trước để trả lỗi dễ hiểu; database constraint vẫn là hàng rào cuối.

## 5. Foreign key và xóa dữ liệu

- Mặc định dùng `ON DELETE RESTRICT` cho dữ liệu nghiệp vụ và lịch sử giao dịch.
- Không xóa vật lý `app_users`, `shops`, `products`, `orders`, `order_items`, `payments`, `shipments`, `reviews`, `moderation_records`, `admin_logs` sau khi đã tham gia giao dịch; chuyển status theo QD16.
- `ON DELETE CASCADE` chỉ được dùng cho thành phần phụ không có vòng đời độc lập như `product_images`, `review_images`, và `cart_items`, sau khi migration test xác nhận không làm mất lịch sử giao dịch.
- FK nullable chỉ dùng khi Schema Freeze cho phép, ví dụ `categories.parent_category_id`, `order_status_history.changed_by`, `vouchers.shop_id`.
- Polymorphic `target_type + target_id` của `moderation_records` và `admin_logs` không có FK vật lý; Service bắt buộc kiểm tra loại, tồn tại và quyền truy cập.
- Mọi thay đổi delete policy phải có CR vì có thể thay đổi hành vi dữ liệu lịch sử.

## 6. UNIQUE và partial unique index bắt buộc

- `app_users.email` unique.
- `shops.owner_id` unique trong MVP.
- `carts.buyer_id` unique.
- `(cart_id, variant_id)` unique trong `cart_items`.
- `vouchers.code` unique.
- `voucher_usages.order_id` unique.
- `shipments.order_id` unique.
- `reviews.order_item_id` unique.
- Một địa chỉ mặc định trên mỗi User:

```sql
CREATE UNIQUE INDEX uq_addresses__one_default_per_user
ON addresses(user_id)
WHERE is_default = TRUE;
```

- Một Payment `SUCCESS` trên mỗi Order:

```sql
CREATE UNIQUE INDEX uq_payments__one_success_per_order
ON payments(order_id)
WHERE status = 'SUCCESS';
```

- `payments.transaction_code` unique khi khác NULL.
- `shipments.tracking_code` unique khi khác NULL.
- SKU duy nhất trong phạm vi Shop được Service enforce qua `product_variants → products → shops`; thay đổi schema để enforce trực tiếp cần CR.

## 7. CHECK bắt buộc

- Các status chỉ nhận miền được định nghĩa trong Schema Freeze v1.
- `product_variants.price > 0` và `stock_quantity >= 0`.
- `cart_items.quantity >= 1`.
- `order_items.unit_price > 0`, `quantity >= 1`, `line_total >= 0`.
- Các trường tiền của Order không âm và `total_amount = subtotal + shipping_fee - discount_amount`.
- `reviews.rating BETWEEN 1 AND 5`.
- Voucher có quantity không âm, giá trị giảm dương, min/max không âm, `start_at < end_at`.
- Voucher `PERCENT` có `discount_value > 0 AND discount_value <= 100`.
- Voucher `PLATFORM` phải có `shop_id IS NULL`; Voucher `SHOP` phải có `shop_id IS NOT NULL`.
- Payment `SUCCESS` phải có `paid_at IS NOT NULL`.
- Notification đã đọc phải có `read_at IS NOT NULL`.
- `order_items.line_total = unit_price * quantity`.

Các CHECK không thể diễn đạt an toàn hoặc phụ thuộc nhiều bảng vẫn do Service/transaction enforce.

## 8. Index phục vụ truy vấn

- `app_users(email)`.
- `products(product_name)`, `products(shop_id)`, `products(category_id)`.
- `product_variants(sku)`; cân nhắc trigram/full-text index cho tìm kiếm sau khi đo query thực tế.
- `orders(buyer_id, created_at DESC)`, `orders(shop_id, created_at DESC)`, `orders(status, created_at DESC)`.
- `payments(order_id)`.
- `shipments(order_id)` và partial unique tracking code.
- `vouchers(code)`.
- `reviews(product_id, created_at DESC)` và `reviews(product_id, rating)`.
- `notifications(recipient_id, is_read, created_at DESC)`.
- `admin_logs(admin_id, created_at DESC)`.

Không tạo index theo cảm tính ngoài danh sách trên; index mới phải gắn với query cụ thể và được kiểm tra bằng `EXPLAIN`.

## 9. Transaction và tính bất biến

- Transaction boundary nằm ở Service, không nằm rải rác trong repository.
- Khi tạo Order phải khóa hoặc cập nhật tồn kho nguyên tử theo [`order-workflow-transactions.md`](order-workflow-transactions.md).
- `order_items` và các trường `subtotal`, `discount_amount`, `shipping_fee`, `total_amount` của Order không được UPDATE qua nghiệp vụ thông thường.
- Không dùng trigger để tái tính các snapshot/tổng tiền sau khi Order đã tồn tại.
- Audit và lịch sử trạng thái chỉ append; không UPDATE hoặc DELETE qua API thông thường.

## 10. Migration

- Migration chỉ tiến về trước và có tên `YYYYMMDDHHMM_<mo_ta_ngan>.sql`.
- Không sửa migration đã chạy ở môi trường dùng chung; tạo migration mới để sửa.
- Migration schema phải đi cùng test constraint/index và CR Approved nếu thay đổi Schema Freeze.
- Thay đổi phá vỡ compatibility theo thứ tự expand → backfill → switch → contract.
- Không đưa secret, dữ liệu production hoặc service-role key vào migration.
- Rollback data-destructive không được tự động giả định an toàn; phải có backup/restore plan.
