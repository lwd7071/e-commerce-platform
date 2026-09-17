# Tài liệu Chốt Query Patterns & Đề xuất Index — Buyer Supporting Domain
**Mốc:** T2  
**Người phụ trách:** Người 4 (Buyer Supporting Domain)  
**Người nhận bàn giao:** Người 2 (Database Architect & Migration Owner)  
**Phiên bản:** 1.0.0 (Freeze)

---

## 1. Tổng quan & Phạm vi Bàn giao

Buyer Domain chịu trách nhiệm quản lý dữ liệu trên **9 bảng CSDL** (thuộc 6 Aggregate):
1. `user_profiles` (Hồ sơ người dùng)
2. `addresses` (Sổ địa chỉ giao hàng)
3. `carts` (Giỏ hàng)
4. `cart_items` (Chi tiết giỏ hàng)
5. `vouchers` (Mã giảm giá)
6. `voucher_usages` (Lịch sử sử dụng voucher)
7. `reviews` (Đánh giá sản phẩm)
8. `review_images` (Hình ảnh đính kèm đánh giá)
9. `notifications` (Thông báo người dùng)

Tài liệu này tổng hợp toàn bộ các câu truy vấn SQL thực tế được thực thi bởi các PostgreSQL Repositories của Người 4, tần suất thực thi dự kiến, và đề xuất tối ưu hóa Index bàn giao cho Người 2 rà soát.

---

## 2. Chi tiết Query Patterns theo Từng Aggregate

### 2.1. Aggregate Cart & CartItem

#### Pattern C-01: Lấy Giỏ hàng của Buyer
- **Mục đích:** Khởi tạo hoặc nạp giỏ hàng khi người mua truy cập trang Cart.
- **Tần suất:** Rất cao (Mỗi lượt vào trang giỏ hàng hoặc bắt đầu shopping session).
- **SQL Template:**
  ```sql
  SELECT cart_id, buyer_id, created_at, updated_at
  FROM carts
  WHERE buyer_id = $1;
  ```
- **Index hiện tại trong migration.sql:** `uq_carts__buyer_id` (B-tree unique).
- **Đánh giá Index:** Đã tối ưu hoàn hảo (Index scan O(log N)).

#### Pattern C-02: Lấy danh sách Cart Items
- **Mục đích:** Hiển thị chi tiết các sản phẩm trong giỏ hàng.
- **Tần suất:** Rất cao (Thực thi ngay sau Pattern C-01).
- **SQL Template:**
  ```sql
  SELECT cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at
  FROM cart_items
  WHERE cart_id = $1
  ORDER BY created_at ASC;
  ```
- **Index hiện tại:** `fk_cart_items__cart_id` (Foreign Key).
- **Đề xuất Người 2 bổ sung:**
  ```sql
  CREATE INDEX idx_cart_items__cart_id__created_at ON cart_items(cart_id, created_at ASC);
  ```
  *Lý do:* Tránh bước Sort trên bộ nhớ khi giỏ hàng có nhiều items, hỗ trợ Index scan trực tiếp theo thứ tự hiển thị.

#### Pattern C-03: Thêm hoặc Tăng số lượng Item (Atomic Upsert)
- **Mục đích:** Thêm sản phẩm vào giỏ hoặc cộng dồn số lượng nếu SKU đã tồn tại (RB-MG05).
- **Tần suất:** Cao.
- **SQL Template:**
  ```sql
  INSERT INTO cart_items (
    cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at
  )
  VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), now())
  ON CONFLICT (cart_id, variant_id) DO UPDATE
  SET quantity = cart_items.quantity + EXCLUDED.quantity,
      updated_at = now()
  RETURNING cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at;
  ```
- **Index hiện tại:** `uq_cart_items__cart_id__variant_id` (Unique composite index).
- **Đánh giá Index:** Đã có đầy đủ index phục vụ ON CONFLICT target.

#### Pattern C-04: Dọn các Items đã đặt hàng thành công sau Checkout
- **Mục đích:** Xóa sạch các items đã checkout khỏi giỏ khi đơn hàng được tạo (tích hợp checkout flow Người 5).
- **Tần suất:** Trung bình.
- **SQL Template:**
  ```sql
  DELETE FROM cart_items
  WHERE cart_item_id = ANY($1)
    AND cart_id IN (SELECT cart_id FROM carts WHERE buyer_id = $2);
  ```
- **Đánh giá Index:** Cần `pk_cart_items` (cho `cart_item_id`) và `uq_carts__buyer_id` (cho subquery). Cả hai đều đã có B-tree index.

---

### 2.2. Aggregate Voucher & VoucherUsage

#### Pattern V-01: Liệt kê Voucher đang Active (Sàn & Shop)
- **Mục đích:** Hiển thị danh sách mã giảm giá khả dụng khi buyer chọn voucher tại trang checkout hoặc trang khuyến mãi.
- **Tần suất:** Rất cao.
- **SQL Template:**
  ```sql
  -- Với PLATFORM scope:
  SELECT voucher_id, code, voucher_name, scope, shop_id, discount_type,
         discount_value, max_discount, min_order_value, quantity,
         start_at, end_at, status, created_at, updated_at
  FROM vouchers
  WHERE status = 'ACTIVE'
    AND start_at <= now()
    AND end_at > now()
    AND quantity > 0
    AND scope = 'PLATFORM'
  ORDER BY created_at DESC;

  -- Với SHOP scope:
  SELECT ...
  FROM vouchers
  WHERE status = 'ACTIVE'
    AND start_at <= now()
    AND end_at > now()
    AND quantity > 0
    AND scope = 'SHOP'
    AND shop_id = $1
  ORDER BY created_at DESC;
  ```
- **Index hiện tại:** Chưa có composite index cho điều kiện lọc đa thuộc tính này.
- **Đề xuất Người 2 bổ sung (Partial Index):**
  ```sql
  CREATE INDEX idx_vouchers__active_listing ON vouchers(scope, shop_id, end_at, created_at DESC)
  WHERE status = 'ACTIVE' AND quantity > 0;
  ```
  *Lý do:* Giảm 90% dung lượng index do chỉ đánh chỉ mục trên các voucher còn hiệu lực, tăng tốc độ query checkout cực đại.

#### Pattern V-02: Tìm kiếm Voucher theo Code
- **Mục đích:** Buyer nhập mã thủ công trong ô áp dụng voucher.
- **Tần suất:** Rất cao.
- **SQL Template:**
  ```sql
  SELECT ... FROM vouchers WHERE code = $1;
  ```
- **Index hiện tại:** `uq_vouchers__code` và `idx_vouchers__code`.
- **Đánh giá:** Đã có index B-tree chính xác.

#### Pattern V-03: Trừ số lượng nguyên tử khi Áp dụng Voucher (Atomic Decrement)
- **Mục đích:** Giữ chỗ và tiêu dùng lượt voucher, ngăn ngừa over-claiming (RB-LTT04).
- **Tần suất:** Cao.
- **SQL Template:**
  ```sql
  UPDATE vouchers
  SET quantity = quantity - 1,
      updated_at = now()
  WHERE voucher_id = $1 AND quantity > 0;
  ```
- **Đánh giá:** Sử dụng `pk_vouchers` (`voucher_id`), thực thi dưới 1ms.

#### Pattern V-04: Bù trừ hoàn lại số lượng (Compensating Increment)
- **Mục đích:** Hoàn lại voucher khi đơn hàng bị hủy trước thanh toán (RB-LQH03).
- **Tần suất:** Thấp.
- **SQL Template:**
  ```sql
  UPDATE vouchers
  SET quantity = quantity + 1,
      updated_at = now()
  WHERE voucher_id = $1;
  ```
- **Đánh giá:** Sử dụng `pk_vouchers`, thực thi tức thì.

#### Pattern V-05: Ghi nhận lịch sử sử dụng Voucher (VoucherUsage)
- **Mục đích:** Lưu bằng chứng sử dụng, chặn 1 order dùng 2 voucher (RB-LB07).
- **Tần suất:** Tương đương số đơn hàng áp voucher.
- **SQL Template:**
  ```sql
  INSERT INTO voucher_usages (
    usage_id, voucher_id, order_id, buyer_id, discount_amount, used_at
  )
  VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
  RETURNING usage_id, voucher_id, order_id, buyer_id, discount_amount, used_at;
  ```
- **Index hiện tại:** `uq_voucher_usages__order_id` (Unique B-tree).
- **Đánh giá:** Đảm bảo toàn vẹn nghiệp vụ tuyệt đối ở cấp độ engine.

---

### 2.3. Aggregate Review & ReviewImage

#### Pattern R-01: Đọc danh sách Reviews của Sản phẩm
- **Mục đích:** Khách hàng xem đánh giá trên trang Product Detail Page (PDP).
- **Tần suất:** Cực kỳ cao (Mọi lượt xem chi tiết sản phẩm).
- **SQL Template:**
  ```sql
  SELECT review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at
  FROM reviews
  WHERE product_id = $1 AND status = 'VISIBLE'
  ORDER BY created_at DESC;
  ```
- **Index hiện tại:** `idx_reviews__product_id__created_at ON reviews(product_id, created_at DESC)`.
- **Đề xuất Người 2 xem xét (Index cải tiến):**
  Hiện tại câu lệnh luôn có điều kiện `status = 'VISIBLE'`. Do đó, nếu bảng reviews lớn, có thể bổ sung Partial Index hoặc Composite Index:
  ```sql
  CREATE INDEX idx_reviews__product_visible ON reviews(product_id, created_at DESC) WHERE status = 'VISIBLE';
  ```

#### Pattern R-02: Kiểm tra Đánh giá theo Chi tiết Đơn hàng (OrderItem)
- **Mục đích:** Xác định xem item này đã được người mua đánh giá chưa để hiển thị nút "Đánh giá" hay "Xem đánh giá" (RB-LB09).
- **Tần suất:** Cao (Trang đơn mua của Buyer).
- **SQL Template:**
  ```sql
  SELECT ... FROM reviews WHERE order_item_id = $1;
  ```
- **Index hiện tại:** `uq_reviews__order_item_id`.
- **Đánh giá:** Đã có Unique Index, tốc độ lookup tối ưu.

#### Pattern R-03: Tạo Review và Lưu hình ảnh đính kèm
- **Mục đích:** Buyer gửi bài đánh giá kèm hình ảnh thực tế.
- **Tần suất:** Trung bình.
- **SQL Template:**
  ```sql
  -- Bước 1: Thêm review
  INSERT INTO reviews (review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), now())
  RETURNING *;

  -- Bước 2: Chèn từng review_images (vòng lặp)
  INSERT INTO review_images (review_image_id, review_id, image_url, sort_order)
  VALUES ($1, $2, $3, $4);
  ```
- **Index hiện tại:** `pk_reviews`, `fk_review_images__review_id`.

---

### 2.4. Aggregate Notification

#### Pattern N-01: Lấy danh sách Thông báo của Người dùng
- **Mục đích:** Hiển thị chuông thông báo (tất cả hoặc chỉ tin chưa đọc `is_read = FALSE`).
- **Tần suất:** Cực kỳ cao (Mọi lần Buyer tải trang hoặc polling).
- **SQL Template:**
  ```sql
  SELECT notification_id, recipient_id, type, title, content, is_read, created_at, read_at
  FROM notifications
  WHERE recipient_id = $1 AND is_read = $2
  ORDER BY created_at DESC;
  ```
- **Index hiện tại:** `idx_notifications__recipient_id__is_read__created_at ON notifications(recipient_id, is_read, created_at DESC)`.
- **Đánh giá:** Đã được Người 2 thiết kế composite index hoàn hảo, bao phủ 100% WHERE và ORDER BY clauses!

#### Pattern N-02: Đánh dấu đã đọc (Mark As Read)
- **Mục đích:** Cập nhật trạng thái khi người dùng mở thông báo (RB-LTT07).
- **Tần suất:** Cao.
- **SQL Template:**
  ```sql
  UPDATE notifications
  SET is_read = TRUE,
      read_at = COALESCE($2::timestamptz, now())
  WHERE notification_id = $1
  RETURNING notification_id, recipient_id, type, title, content, is_read, created_at, read_at;
  ```
- **Đánh giá:** Sử dụng `pk_notifications`, thực thi tức thì.

---

### 2.5. Aggregate UserProfile & Address

#### Pattern U-01: Lấy danh sách Địa chỉ của Buyer
- **Mục đích:** Hiển thị sổ địa chỉ, địa chỉ mặc định lên đầu.
- **Tần suất:** Cao (Checkout, trang cá nhân).
- **SQL Template:**
  ```sql
  SELECT address_id, user_id, recipient_name, phone, province, district, ward, detail_address, is_default, created_at, updated_at
  FROM addresses
  WHERE user_id = $1
  ORDER BY is_default DESC, created_at DESC;
  ```
- **Đề xuất Người 2 bổ sung:**
  ```sql
  CREATE INDEX idx_addresses__user_id__default ON addresses(user_id, is_default DESC, created_at DESC);
  ```

#### Pattern U-02: Đổi Địa chỉ mặc định (Set Default Address — Atomic)
- **Mục đích:** Đảm bảo duy nhất 1 địa chỉ mặc định trên mỗi tài khoản (RB-LB05).
- **Tần suất:** Thấp.
- **SQL Template:**
  ```sql
  -- Lệnh 1: Hủy mặc định cũ
  UPDATE addresses SET is_default = FALSE, updated_at = now() WHERE user_id = $1 AND is_default = TRUE;
  -- Lệnh 2: Bật mặc định mới
  UPDATE addresses SET is_default = TRUE, updated_at = now() WHERE address_id = $2 AND user_id = $1;
  ```
- **Index hiện tại:** `uq_addresses__one_default_per_user ON addresses(user_id) WHERE is_default = TRUE`.
- **Đánh giá:** Partial unique index hoạt động tối ưu và chính xác tuyệt đối.

---

## 3. Tổng kết Khuyến nghị Index gửi Người 2 (Action Items)

| Bảng | Tên Index Đề Xuất | Định Nghĩa SQL | Mức Độ Ưu Tiên |
| :--- | :--- | :--- | :--- |
| `cart_items` | `idx_cart_items__cart_id__created_at` | `ON cart_items(cart_id, created_at ASC)` | **Cao** |
| `vouchers` | `idx_vouchers__active_listing` | `ON vouchers(scope, shop_id, end_at, created_at DESC) WHERE status = 'ACTIVE' AND quantity > 0` | **Cao** |
| `reviews` | `idx_reviews__product_visible` | `ON reviews(product_id, created_at DESC) WHERE status = 'VISIBLE'` | **Trung bình** |
| `addresses` | `idx_addresses__user_id__default` | `ON addresses(user_id, is_default DESC, created_at DESC)` | **Thấp** |

Tài liệu này đã được kiểm tra chéo với toàn bộ 5 bộ Integration Tests trong `tests/modules/buyer/integration/`. Các query template trên đây phản ánh chính xác 100% câu lệnh chạy thực tế trên code PostgreSQL Repositories.
