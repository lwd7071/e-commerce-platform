# Order Workflow and Transactions

## 1. Invariants

- Một Order thuộc đúng một Buyer và một Shop.
- Checkout có sản phẩm từ nhiều Shop phải tạo một Order cho mỗi Shop.
- Một Order sử dụng tối đa một Voucher; quan hệ chỉ tồn tại qua VoucherUsage.
- Một Order có tối đa một Shipment trong MVP.
- Một Order có thể có nhiều Payment attempt nhưng tối đa một Payment `SUCCESS`.
- Payment thành công phải bằng toàn bộ `Order.TotalAmount`; không partial/split payment.
- `OrderItem` và các snapshot/tổng tiền của Order bất biến sau khi transaction tạo Order commit.
- Không có Order hợp lệ nếu thiếu OrderItem, initial history hoặc Payment ban đầu.

## 2. Order state machine

| Trạng thái hiện tại | Trạng thái kế tiếp | Actor | Điều kiện |
|---|---|---|---|
| `PENDING_CONFIRMATION` | `CONFIRMED` | Seller/Admin | Order thuộc Shop; còn hiệu lực xử lý |
| `PENDING_CONFIRMATION` | `CANCELLED` | Buyer/Seller/Admin | Có `cancel_reason`; actor có quyền |
| `CONFIRMED` | `PREPARING` | Seller/Admin | Order thuộc Shop |
| `CONFIRMED` | `CANCELLED` | Seller/Admin | Có lý do; Buyer không còn quyền mặc định |
| `PREPARING` | `SHIPPING` | Seller/Admin | Shipment tồn tại và đã bàn giao |
| `PREPARING` | `CANCELLED` | Seller/Admin | Trường hợp ngoại lệ có lý do; xử lý hoàn tồn nếu chính sách yêu cầu |
| `SHIPPING` | `COMPLETED` | Shipment integration/Admin | Shipment `DELIVERED` hoặc xác nhận tương đương |
| `SHIPPING` | `DELIVERY_FAILED` | Shipment integration/Admin | Shipment `FAILED`; có reason/note |

- `COMPLETED`, `CANCELLED`, `DELIVERY_FAILED` là terminal state trong MVP.
- Không cho phép quay ngược trạng thái hoặc nhảy qua bước.
- Admin không được UPDATE status trực tiếp. Can thiệp dùng command riêng, reason bắt buộc, ghi OrderStatusHistory và AdminLog trong cùng transaction.
- Mọi transition dùng optimistic check `WHERE order_id = ? AND status = <expected>` hoặc row lock; nếu không match trả `409 ORDER_INVALID_TRANSITION`.

## 3. Shipment state machine

| Từ | Đến |
|---|---|
| `PENDING` | `HANDED_OVER` |
| `HANDED_OVER` | `SHIPPING` |
| `HANDED_OVER` | `FAILED` |
| `SHIPPING` | `DELIVERED` |
| `SHIPPING` | `FAILED` |

- Shipment `DELIVERED` kích hoạt transition Order sang `COMPLETED` nếu Order đang `SHIPPING`.
- Shipment `FAILED` kích hoạt Order `DELIVERY_FAILED` nếu Order đang `SHIPPING`.
- Callback lặp phải idempotent và không tạo history trùng.

## 4. Transaction tạo Order

Request tạo Order bắt buộc có `Idempotency-Key`. Backend không nhận giá hoặc tổng tiền do client làm nguồn chuẩn.

Trong một database transaction:

1. Tải Cart/CartItem được chọn của Buyer và nhóm theo Shop.
2. Khóa các ProductVariant liên quan theo thứ tự `variant_id` ổn định để giảm deadlock.
3. Kiểm tra Product, Variant và Shop đang hoạt động.
4. Đọc giá hiện hành và kiểm tra `requested_quantity <= stock_quantity`.
5. Tải và khóa Voucher khi có; kiểm tra status, scope, Shop, thời gian, quantity và min order.
6. Tính `LineTotal`, `Subtotal`, `DiscountAmount`, `ShippingFee`, `TotalAmount` bằng decimal chính xác.
7. Tạo một Order cho từng Shop với snapshot người nhận/địa chỉ và status `PENDING_CONFIRMATION`.
8. Tạo OrderItem với snapshot ProductName, Variant và UnitPrice.
9. Tạo VoucherUsage và giảm lượt dùng bằng update có điều kiện nếu áp dụng Voucher.
10. Giảm tồn kho bằng update có điều kiện, không cho kết quả âm.
11. Tạo OrderStatusHistory ban đầu, Payment `PENDING` và Notification cho Buyer/Seller.
12. Xóa hoặc bỏ chọn CartItem đã checkout, lưu kết quả idempotency rồi COMMIT.

Bất kỳ bước nào thất bại phải ROLLBACK toàn bộ nhóm Order của request. Không được để một Shop thành công và Shop khác thất bại trong cùng checkout nếu API không công bố partial result; MVP chọn atomic toàn checkout.

## 5. Chống overselling

Có thể dùng row lock hoặc atomic conditional update. Dù dùng cách nào, điều kiện bắt buộc là database quyết định:

```sql
UPDATE product_variants
SET stock_quantity = stock_quantity - :quantity,
    updated_at = now()
WHERE variant_id = :variant_id
  AND status = 'ACTIVE'
  AND stock_quantity >= :quantity;
```

- Số row update phải bằng 1; nếu bằng 0 trả `409 INVENTORY_INSUFFICIENT`.
- Không thực hiện check tồn và trừ tồn ở hai transaction khác nhau.
- Lock nhiều variant theo thứ tự UUID ổn định.
- Retry do deadlock/serialization chỉ thực hiện ở backend với số lần giới hạn và vẫn dùng idempotency key.

## 6. Voucher concurrency

- Voucher phải được kiểm tra lại trong transaction, không tin kết quả preview.
- Giảm `quantity` bằng update có điều kiện `quantity > 0`.
- `VoucherUsage.OrderID` unique ngăn một Order dùng nhiều VoucherUsage.
- `VoucherUsage.DiscountAmount` phải bằng `Order.DiscountAmount`; không có VoucherUsage thì discount bằng 0.
- Voucher preview không giữ chỗ và không bảo đảm voucher còn hợp lệ khi submit.

## 7. Payment và callback

- Mỗi retry tạo Payment mới `PENDING`; không UPDATE attempt `FAILED` thành attempt mới.
- Nếu đã có Payment `SUCCESS`, retry trả `409 PAYMENT_ALREADY_COMPLETED`.
- Callback được định danh bởi provider/transaction code và phải idempotent.
- Khi callback success: khóa Order/Payment, kiểm tra amount, đánh dấu Payment `SUCCESS`, đặt `paid_at`, tạo Notification; partial unique index bảo vệ attempt success thứ hai.
- Callback success lặp trả kết quả thành công cũ, không tạo history/notification trùng.
- Callback với cùng transaction code nhưng payload/amount khác trả conflict và tạo security log.
- Không lưu PAN, CVV hoặc dữ liệu thẻ thật.

## 8. Hủy Order và tồn kho

- Buyer chỉ hủy `PENDING_CONFIRMATION` trong MVP.
- Seller/Admin có thể hủy `PENDING_CONFIRMATION`, `CONFIRMED` và trường hợp ngoại lệ `PREPARING` theo bảng transition.
- `cancel_reason` là bắt buộc và phải trim khác rỗng.
- Hoàn tồn chỉ thực hiện đúng một lần trong cùng transaction hủy; idempotency/expected-state ngăn hoàn tồn lặp.
- Voucher quantity/usage khi hủy phải theo một policy thống nhất. Schema Freeze chưa khóa việc hoàn lượt voucher, vì vậy MVP mặc định **không hoàn lượt tự động**; thay đổi cần CR Approved.

## 9. Review eligibility

Khi tạo Review, transaction phải xác nhận:

- `order_item_id` tồn tại và chưa có Review.
- OrderItem thuộc Order của Buyer hiện tại.
- `product_id` khớp OrderItem.
- Order đang `COMPLETED` tại thời điểm tạo.
- Rating từ 1 đến 5.

Nếu Admin đổi trạng thái sau đó, Review không bị xóa hoặc vô hiệu hóa hồi tố trong MVP.

## 10. Test bắt buộc

- Checkout một Shop và nhiều Shop.
- Một bước bất kỳ lỗi làm rollback toàn checkout.
- Hai checkout tranh cùng tồn kho, chỉ request đủ điều kiện commit.
- Voucher hết lượt giữa preview và submit.
- Cùng Idempotency-Key trả cùng Order; key khác payload trả conflict.
- Hai payment callback success đồng thời chỉ tạo một Payment `SUCCESS`.
- Mọi transition hợp lệ và bị cấm; terminal state không chuyển tiếp.
- Hủy retry không hoàn tồn hai lần.
- Đổi giá ProductVariant không làm thay đổi OrderItem cũ.
