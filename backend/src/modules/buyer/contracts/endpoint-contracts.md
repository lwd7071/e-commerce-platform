# Buyer Supporting Domain - API Contracts & Ports Specification (T1)
## Người 4: Buyer Supporting Domain

Tài liệu này công bố chi tiết:
1. **Public Ports** cho Người 5 (Transaction Core) và Người 1 (Integration Lead).
2. **REST Endpoint Contracts** cho 6 sub-domains (`profile`, `address`, `cart`, `voucher`, `review`, `notification`) theo chuẩn `/api/v1` và Envelope của nhóm ([api-conventions.md](file:///c:/E-Commerce%20Platform/docs/architecture/rules/api-conventions.md)).

---

## 1. Public Ports bàn giao cho Người 5 (Checkout & Order)

### 1.1. Cart Port (`ICartPort`)
- **File:** `src/modules/buyer/ports/cart.port.ts`
- **Mục đích:** Người 5 gọi trong transaction checkout để lấy các dòng cart được chọn và dọn giỏ hàng sau khi checkout thành công.
- **Phương thức:**
  ```typescript
  export interface SelectedCartItemSnapshot {
    cartItemId: UUID;
    variantId: UUID;
    quantity: number;
    isSelected: boolean;
  }

  export interface ICartPort {
    getSelectedItems(buyerId: UUID): Promise<SelectedCartItemSnapshot[]>;
    clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void>;
  }
  ```

### 1.2. Voucher Port (`IVoucherPort`)
- **File:** `src/modules/buyer/ports/voucher.port.ts`
- **Mục đích:** Người 5 gọi trong transaction checkout để kiểm tra tính hợp lệ và lấy `discountAmount` (theo công thức `PERCENT` hoặc `FIXED`, có áp dụng cap theo `MaxDiscount` và `Subtotal`). Sau đó Người 5 dùng giá trị này để kiểm tra QD10/RB-LQH01-03 ở Order transaction.
- **Phương thức:**
  ```typescript
  export interface EvaluateVoucherContext {
    code: string;
    buyerId: UUID;
    orderSubtotal: DecimalString;
    shopId: UUID;
    now?: string; // ISO timestamp
  }

  export type VoucherEvaluationResult =
    | { isValid: true; voucherId: UUID; discountAmount: DecimalString }
    | { isValid: false; errorCode: string; errorMessage: string };

  export interface IVoucherPort {
    evaluateVoucher(context: EvaluateVoucherContext): Promise<VoucherEvaluationResult>;
    consumeVoucher(params: {
      voucherId: UUID;
      orderId: UUID;
      buyerId: UUID;
      discountAmount: DecimalString;
    }): Promise<VoucherUsage>;
  }
  ```

---

## 2. Danh mục REST Endpoints (Chuẩn REST & Envelope)

Base Path: `/api/v1`  
Header: `Authorization: Bearer <token>`

### 2.1. User Profile (`/api/v1/profile`)
- **`GET /api/v1/profile`**: Lấy hồ sơ của Buyer hiện tại.
  - Success `200`:
    ```json
    {
      "data": {
        "user_id": "44444444-4444-4444-8444-444444444444",
        "full_name": "Nguyễn Văn Mua",
        "phone": "0901234567",
        "avatar_url": "https://storage.example.com/avatars/user1.jpg",
        "updated_at": "2026-09-16T10:00:00.000Z"
      },
      "request_id": "req_01J..."
    }
    ```
- **`PUT /api/v1/profile`**: Cập nhật hồ sơ Buyer. Body: `{"full_name": "...", "phone": "..."}`.

### 2.2. Addresses (`/api/v1/addresses`)
- **`GET /api/v1/addresses`**: Danh sách sổ địa chỉ của Buyer.
- **`POST /api/v1/addresses`**: Tạo địa chỉ mới.
- **`PUT /api/v1/addresses/{address_id}`**: Cập nhật địa chỉ.
- **`DELETE /api/v1/addresses/{address_id}`**: Xóa địa chỉ.
- **`POST /api/v1/addresses/{address_id}/set-default`**: Đặt làm địa chỉ mặc định (RB-LB05: tự động chuyển các địa chỉ khác thành `is_default = false`).

### 2.3. Cart (`/api/v1/cart`)
- **`GET /api/v1/cart`**: Lấy giỏ hàng hiện tại kèm danh sách các dòng variant.
- **`POST /api/v1/cart/items`**: Thêm sản phẩm vào giỏ. Body: `{"variant_id": "...", "quantity": 2}`.
  - Nếu variant đã có trong giỏ: tự động cộng dồn `quantity` (RB-LB04).
- **`PATCH /api/v1/cart/items/{cart_item_id}`**: Cập nhật số lượng (`quantity >= 1`, RB-MG05) hoặc chọn thanh toán (`is_selected: true/false`).
- **`DELETE /api/v1/cart/items/{cart_item_id}`**: Xóa 1 dòng khỏi giỏ.

### 2.4. Vouchers (`/api/v1/vouchers`)
- **`GET /api/v1/vouchers/applicable?shop_id={shop_id}&subtotal={subtotal}`**: Lấy danh sách voucher hợp lệ có thể áp dụng.
- **`POST /api/v1/vouchers/evaluate`**: Preview/kiểm tra voucher trước khi checkout. Body: `{"code": "PLATFORM20", "shop_id": "...", "subtotal": "150000.00"}`.

### 2.5. Reviews (`/api/v1/order-items/{order_item_id}/review`)
- **`POST /api/v1/order-items/{order_item_id}/review`**: Tạo đánh giá cho sản phẩm đã mua.
  - Body: `{"rating": 5, "content": "Sản phẩm rất tốt", "images": []}`
  - Điều kiện (QD14, QD15, RB-MG08, RB-LB09): Order phải ở trạng thái `COMPLETED`, buyer là chủ sở hữu, rating từ 1 đến 5 sao, chưa từng được review trước đó.
- **`GET /api/v1/products/{product_id}/reviews`**: Xem danh sách đánh giá của sản phẩm (public).

### 2.6. Notifications (`/api/v1/notifications`)
- **`GET /api/v1/notifications`**: Lấy danh sách thông báo của Buyer.
- **`PATCH /api/v1/notifications/{notification_id}`**: Cập nhật trạng thái thông báo.
  - Body: `{"is_read": true}`
  - Tuân thủ [api-conventions.md](file:///c:/E-Commerce%20Platform/docs/architecture/rules/api-conventions.md) §1: cập nhật trường tài nguyên (resource-based), tự động set `read_at = now()` (RB-LTT07) một cách idempotent.
