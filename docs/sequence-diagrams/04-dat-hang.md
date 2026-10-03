# UC04 — Đặt hàng

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Người mua
    participant FE as Frontend Next.js
    participant API as Backend API
    participant Checkout as PgCheckoutService
    participant Ship as Shipping Fee Provider
    participant DB as PostgreSQL

    Buyer->>FE: Xác nhận địa chỉ, phương thức thanh toán và voucher
    FE->>API: POST /api/v1/checkout + Idempotency-Key
    Note over FE,API: Body gồm address_id, payment_method, vouchers và expected_shipping_fees; items lấy từ cart đã chọn
    API->>Checkout: parse command và createOrder(context, command)
    Checkout->>DB: Tìm idempotency record còn hạn
    alt Key đã dùng với cùng payload
        DB-->>Checkout: Fingerprint trùng và có result
        Checkout-->>API: Trả lại result đã lưu (idempotent replay)
        API-->>FE: 201 success envelope (result trước đó)
    else Key đã dùng với payload khác
        DB-->>Checkout: Fingerprint khác
        Checkout-->>API: 409 IDEMPOTENCY_KEY_REUSED
        API-->>FE: Lỗi xung đột idempotency
    else Chưa có kết quả phát lại
        Checkout->>DB: Đọc địa chỉ và các món đã chọn để báo phí
        DB-->>Checkout: Shop, khối lượng, địa chỉ nhận
        Checkout->>Ship: Tính phí giao hàng theo từng shop
        Ship-->>Checkout: Báo giá
        alt Phí gửi lên đã thay đổi
            Checkout-->>API: 409 SHIPPING_QUOTE_CHANGED + báo giá mới
            API-->>FE: Yêu cầu xem lại phí giao hàng
        else Báo giá còn hiệu lực
            Checkout->>DB: BEGIN (READ COMMITTED)
            Checkout->>DB: Claim Idempotency-Key trong transaction
            Checkout->>DB: Khóa cart_items và product_variants bằng FOR UPDATE
            DB-->>Checkout: Các món đã chọn và tồn kho
            alt Sản phẩm ngừng bán hoặc không đủ tồn
                Checkout->>DB: ROLLBACK
                Checkout-->>API: 409 INVENTORY_INSUFFICIENT
                API-->>FE: Báo sản phẩm không đủ tồn kho
            else Giỏ và tồn kho hợp lệ
                opt Có voucher
                    Checkout->>DB: Đọc và đánh giá voucher
                    Checkout->>DB: Giảm quantity có điều kiện và ghi voucher usage
                end
                loop Mỗi shop trong giỏ
                    Checkout->>DB: INSERT order trạng thái PENDING_CONFIRMATION
                    Checkout->>DB: UPDATE tồn kho với điều kiện stock_quantity >= quantity
                    Checkout->>DB: INSERT order_items, history, payment PENDING và notifications
                    Checkout->>DB: DELETE cart_items đã checkout
                end
                Checkout->>DB: Lưu kết quả idempotency
                Checkout->>DB: COMMIT
                Checkout-->>API: Mảng orders (một đơn cho mỗi shop)
                API-->>FE: 201 success envelope
                FE-->>Buyer: Hiển thị đơn hàng đã tạo
            end
        end
    end
```
