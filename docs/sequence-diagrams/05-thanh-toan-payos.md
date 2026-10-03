# UC05 — Thanh toán online qua PayOS

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Người mua
    participant FE as Frontend Next.js
    participant API as Backend API
    participant Pay as PayOS Service
    participant DB as PostgreSQL
    participant Escrow as Escrow Service
    participant DB2 as PostgreSQL (connection riêng của Wallet)

    Buyer->>FE: Chọn thanh toán online cho đơn đã tạo
    FE->>API: POST /api/v1/payments/payos/create-link (order_id)
    API->>DB: Đọc đơn và kiểm tra quyền sở hữu
    DB-->>API: Order, buyer, tổng tiền và trạng thái
    API->>Pay: Tạo payment link, return URL và cancel URL
    Pay-->>API: checkoutUrl, QR và thông tin nhận tiền
    API->>DB: Ghi payment ONLINE trạng thái PENDING
    API-->>FE: 200 success envelope + checkout_url/QR
    FE-->>Buyer: Mở trang thanh toán PayOS
    Buyer->>Pay: Hoàn tất thanh toán

    Pay->>API: POST /api/v1/payments/payos/webhook
    API->>Pay: Xác minh chữ ký webhook
    alt Chữ ký không hợp lệ
        API-->>Pay: 400 Invalid webhook signature
    else Webhook hợp lệ và có orderCode
        API->>DB: Tìm payment theo transaction_code
        DB-->>API: Payment và order liên quan
        API->>DB: BEGIN trên connection webhook
        API->>DB: Cập nhật payment SUCCESS
        API->>DB: Nếu order đang PENDING_CONFIRMATION, chuyển sang CONFIRMED và ghi history
        API->>Escrow: Tạo escrow qua Wallet repository
        Escrow->>DB2: INSERT escrow_records qua pool connection riêng
        DB2-->>Escrow: Escrow được ghi độc lập (autocommit)
        Escrow-->>API: Escrow đã tạo
        API->>DB: COMMIT transaction webhook
        API-->>Pay: 200 success
    end
    Note over DB,DB2: Payment/order và escrow hiện không nằm trong cùng transaction; escrow có thể đã commit riêng nếu transaction webhook rollback.
```
