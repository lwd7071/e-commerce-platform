# UC10 — Mua sản phẩm Flash Sale

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Người mua
    participant FE as Frontend Next.js
    participant API as Backend API
    participant FS as FlashSaleService
    participant Redis as Redis (Lua atomic)
    participant DB as PostgreSQL

    Buyer->>FE: Chọn sản phẩm và mua Flash Sale
    FE->>API: POST /api/v1/flash-sales/items/{itemId}/purchase + Idempotency-Key
    API->>API: Xác thực JWT context và lấy user_id
    API->>DB: Tìm Flash Sale item và slot
    DB-->>API: item_id, slot_id
    API->>FS: purchase(user, slot, item, voucher, địa chỉ)
    FS->>Redis: Đặt idempotency marker / kiểm tra request lặp
    alt Request đã hoàn tất trước đó
        Redis-->>FS: Kết quả đã lưu
        FS-->>API: Idempotent replay
        API-->>FE: 200 kết quả đơn cũ
    else Request mới
        FS->>Redis: Lua trừ quota tồn kho, giới hạn mỗi Buyer và voucher
        alt Hết hàng, slot không hoạt động hoặc vượt giới hạn
            Redis-->>FS: Mã thất bại
            FS-->>API: success=false và mã lỗi
            API-->>FE: Báo không thể mua
        else Đặt chỗ Redis thành công
            FS->>DB: BEGIN; kiểm tra idempotency và đọc item/voucher
            FS->>DB: Tạo order PENDING_CONFIRMATION, order_item và payment PENDING
            FS->>DB: Ghi voucher usage và idempotency record (nếu có)
            FS->>Redis: Pre-commit handshake giữ reservation
            alt Handshake thất bại hoặc ghi PostgreSQL lỗi
                FS->>DB: ROLLBACK
                FS->>Redis: Bồi hoàn reservation/quota đã giữ
                FS-->>API: Lỗi đặt hàng
                API-->>FE: Hiển thị lỗi và cho phép thử lại
            else Handshake thành công
                FS->>DB: COMMIT (PostgreSQL là nguồn dữ liệu đơn hàng)
                FS->>Redis: Hoàn tất reservation và cache idempotency
                FS-->>API: order_id và kết quả mua hàng
                API-->>FE: 200 kết quả thành công
                FE-->>Buyer: Hiển thị đơn Flash Sale
            end
        end
    end
```
