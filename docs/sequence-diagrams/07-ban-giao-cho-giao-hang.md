# UC07 — Seller bàn giao đơn cho giao hàng

```mermaid
sequenceDiagram
    autonumber
    actor Seller as Seller
    participant FE as Seller Portal (Next.js)
    participant API as Backend API
    participant Order as PgCheckoutService
    participant DB as PostgreSQL

    Seller->>FE: Chọn đơn PREPARING và chuyển sang SHIPPING
    FE->>API: POST /api/v1/orders/{order_id}/transition (to=SHIPPING)
    API->>Order: Xác thực Seller và shop sở hữu đơn
    Order->>DB: BEGIN; khóa order và xác thực chuyển trạng thái
    alt Đơn không ở trạng thái cho phép hoặc Seller không sở hữu shop
        Order->>DB: ROLLBACK
        Order-->>API: 403/409 lỗi chuyển trạng thái
        API-->>FE: Hiển thị lỗi
    else Chuyển trạng thái hợp lệ
        Order->>DB: Tạo hoặc cập nhật shipment = HANDED_OVER
        Order->>DB: Cập nhật order = SHIPPING và ghi status history
        Order->>DB: COMMIT
        Order-->>API: Order SHIPPING
        API-->>FE: 200 success envelope
        FE-->>Seller: Hiển thị đã bàn giao
    end
    Note over Order,DB: Backend hiện tạo shipment mô phỏng (carrier_name = Simulated delivery); sơ đồ không giả định tích hợp hãng vận chuyển thật.
```
