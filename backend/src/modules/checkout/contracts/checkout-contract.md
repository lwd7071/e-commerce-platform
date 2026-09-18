# Transaction core T1 — Contract & Orchestration Specification

Trạng thái: **Đã triển khai phần Domain thuần (Orchestrator & State Machines); Đề xuất/Chờ phối hợp phần Persistence, API Wiring & Adapter thật**.
Owner: Thành viên 5 (Transaction core).

---

## 1. Căn cứ kiến trúc & Quy tắc

- `docs/architecture/rules/order-workflow-transactions.md` §1–8 (Workflow 12 bước, state machines, concurrency).
- `docs/architecture/rules/api-conventions.md` §1–7 (Payload envelope, HTTP codes, formatting).
- `docs/architecture/rules/auth-rbac-rls.md` §2–4 (Buyer/Seller/Admin ownership & permissions).
- `docs/architecture/rules/db-schema-rules.md` §3, §9 (Schema freeze, numeric exact cents).
- `docs/architecture/rules/error-observability.md` §2, §6 (Standard error codes).
- Schema Freeze: Order, OrderItem, Payment, Shipment; QD08–QD13, QD18, QD20; RB-LTT06/08, RB-LB07/08/10, RB-LQH01–04.

---

## 2. Trạng thái phân định rõ ràng (Implemented vs Proposed)

### A. Đã hoàn thành và kiểm thử (Domain Layer - Pure)
1. **State Machines**:
   - `OrderStateMachine`: Ma trận 49 cặp chuyển trạng thái, 8 cạnh hợp lệ, kiểm tra quyền Buyer/Seller/Admin/Shipment, yêu cầu lý do hủy/admin can thiệp.
   - `PaymentStateMachine`: Settle PENDING -> SUCCESS/FAILED, kiểm tra khớp 100% order total, kiểm tra ngày lịch thực tế và chuẩn hóa UTC `paidAt`, chặn retry trên order đã completed.
   - `ShipmentStateMachine`: 5 trạng thái hợp lệ, 5 cạnh chuyển tiếp được phép.
2. **Order Calculation**:
   - `calculateOrderTotals`: Sử dụng `bigint` cents, kiểm tra chặt chẽ `NUMERIC(15,2)`, chặn tràn số PostgreSQL INTEGER (`2_147_483_647`), chặn chuỗi số dị dạng.
3. **Checkout Validation & Orchestration**:
   - `parseCheckoutCommand`: Validate strict input (address UUID, payment method COD/ONLINE, deduplicate voucher shop, key 16-128 chars).
   - `executeCheckout`: Domain orchestrator 12 bước nhận port qua constructor injection (`ICartPort`, `ICatalogPort`, `IVoucherPort`, `IdempotencyPort`).
   - 13/13 unit tests bao phủ đầy đủ happy path, multi-shop, voucher discount, anti-overselling, shop/variant inactive, idempotency replay/conflict/in_progress, isolation khi downstream lỗi.

### B. Đề xuất & Chờ phối hợp (Infrastructure / Integration Layer)
1. **Endpoint API Wiring** (Chờ Người 1):
   - Đề xuất các endpoint POST `/api/v1/orders`, `/api/v1/orders/{id}/cancel`, `/api/v1/orders/{id}/confirm`, `/api/v1/orders/{id}/transition`, `/api/v1/orders/{id}/payments`.
   - Cần Người 1 cung cấp `RequestContext`, API envelope và route handler.
2. **Persistence & DB Transaction** (Chờ Người 2):
   - Cần adapter PostgreSQL thực tế để đóng gói 12 bước vào một `BEGIN ... COMMIT` duy nhất.
   - Cần idempotency storage thật trên cơ sở dữ liệu (thay cho mock in-memory trong unit test).
3. **Adapters Catalog / Cart / Voucher thật** (Chờ Người 3, Người 4):
   - Người 3: Bổ sung bắt buộc `productName`, `shopId` trong port DTO và quy tắc snapshot `VariantSnapshot`.
   - Người 4: Cart/Voucher adapter tương thích transaction context.

---

## 3. Transaction Boundary — 12 Bước Checkout Chuẩn

Không có partial success. Kết quả trả về chứa danh sách Order (mỗi shop 1 Order độc lập).
Mọi lỗi ở bất kỳ bước nào đều rollback toàn bộ side-effect trên cơ sở dữ liệu.

1. **Step 0: Idempotency Claim** — Kiểm tra claim với scope `(user_id, endpoint, key)`. Nếu `replay` thì trả ngay kết quả cũ (không gọi downstream); nếu `conflict` ném `IDEMPOTENCY_KEY_REUSED`; nếu `in_progress` ném `REQUEST_IN_PROGRESS`.
2. **Step 1: Load Selected Cart Items** — Đọc các item `isSelected: true` từ giỏ hàng. Nếu rỗng ném `VALIDATION_FAILED`.
3. **Step 2: Stable Sorting** — Sắp xếp items theo `variantId` tăng dần để triệt tiêu nguy cơ deadlock DB lock.
4. **Step 3-4: Verify Variants & Shops** — Đọc giá/tồn kho từ Catalog, kiểm tra variant `status === 'ACTIVE'`, shop `checkShopActive === true`, và số lượng yêu cầu không vượt tồn kho (`INVENTORY_INSUFFICIENT`).
5. **Step 5: Group by Shop & Evaluate Vouchers** — Nhóm mặt hàng theo từng shop sở hữu. Với mỗi shop có voucher, gọi `evaluateVoucher`. Nếu không hợp lệ, ngắt ngay (`VOUCHER_NOT_APPLICABLE`).
6. **Step 6: Calculate Totals per Shop** — Tính toán chính xác LineTotals, Subtotal, Discount, ShippingFee, TotalAmount bằng `calculateOrderTotals`.
7. **Step 7: Lock Variants** — Khóa tồn kho tất cả variants tương ứng.
8. **Step 8: Consume Vouchers** — Tiêu thụ voucher cho các shop tương ứng.
9. **Step 9: Clear Checked Out Cart Items** — Xóa đúng các item đã checkout khỏi giỏ hàng.
10. **Step 10-12: Build Order/Payment Snapshots & Complete Idempotency** — Tạo snapshot Order `PENDING_CONFIRMATION`, Payment `PENDING`, lưu trữ cache Idempotency và trả về `CheckoutResult`.

---

## 4. Idempotency Specification

- **Scope**: `user_id + endpoint + key`.
- **Fingerprint**: Băm payload canonical gồm `address_id`, `payment_method`, `vouchers`.
- **Hành vi**:
  - `replay`: Trả ngay kết quả `CheckoutResult` cũ mà **không gọi** Cart, Catalog, Voucher.
  - `conflict`: Ném lỗi `IDEMPOTENCY_KEY_REUSED` (HTTP 409).
  - `in_progress`: Ném lỗi `REQUEST_IN_PROGRESS` (HTTP 409).
  - `complete`: Lưu kết quả với TTL tối thiểu 24 giờ.

---

## 5. Error Mapping Chuẩn Domain TV5

| Mã lỗi Domain | HTTP Mapping | Tình huống |
|---|---|---|
| `IDEMPOTENCY_KEY_REQUIRED` | 400 Bad Request | Thiếu header Idempotency-Key |
| `VALIDATION_FAILED` | 422 Unprocessable | Sai định dạng UUID, body thừa trường, method sai, variant/shop không active, rỗng giỏ |
| `IDEMPOTENCY_KEY_REUSED` | 409 Conflict | Trùng key nhưng khác payload |
| `REQUEST_IN_PROGRESS` | 409 Conflict | Request cùng key đang được xử lý song song |
| `ORDER_INVALID_TRANSITION` | 409 Conflict | Chuyển trạng thái Order không nằm trong 8 cạnh cho phép |
| `ORDER_CANCELLATION_NOT_ALLOWED` | 409 Conflict | Buyer hủy đơn không ở PENDING_CONFIRMATION |
| `REASON_REQUIRED` | 422 Unprocessable | Hủy đơn hoặc Admin can thiệp thiếu lý do |
| `RESOURCE_FORBIDDEN` | 403 Forbidden | Sai vai trò, Seller thao tác shop khác, Buyer thao tác order khác |
| `RESOURCE_NOT_FOUND` | 404 Not Found | Không tìm thấy Order tương ứng |
| `INVENTORY_INSUFFICIENT` | 409 Conflict | Số lượng đặt vượt quá tồn kho khả dụng (QD07) |
| `VOUCHER_NOT_APPLICABLE` | 422 Unprocessable | Voucher hết hạn, không đủ điều kiện đơn tối thiểu, hoặc sai shop |
| `PAYMENT_AMOUNT_INVALID` | 422 Unprocessable | Số tiền thanh toán không dương hoặc không bằng tổng Order |
| `PAYMENT_ALREADY_COMPLETED` | 409 Conflict | Thử retry payment cho Order đã thanh toán thành công |
| `PAYMENT_STATE_INVALID` | 409 Conflict | Settle attempt không ở trạng thái PENDING hoặc thiếu timestamp UTC |

---

## 6. Tiêu chí bàn giao & Phụ thuộc tiếp theo

1. **Người 1 (Platform/API)**:
   - Wiring HTTP endpoint cho `/api/v1/orders` gọi tới `executeCheckout`.
   - Trích xuất `buyerId` từ auth token, ánh xạ mã lỗi sang envelope chuẩn `{ error: { code, message }, request_id }`.
2. **Người 2 (Database & Persistence)**:
   - Viết persistence repository cho Order, OrderItem, OrderStatusHistory, Payment.
   - Viết `IdempotencyStorage` adapter lưu trên bảng PostgreSQL thật.
   - Đóng gói toàn bộ 12 bước của `executeCheckout` vào database transaction với transaction helper/client.
3. **Người 3 (Catalog Port)**:
   - Bổ sung trường `productName` bắt buộc và `shopId` trong DTO để hỗ trợ tạo OrderItem snapshot đầy đủ.
4. **Người 4 (Buyer Port)**:
   - Cung cấp CartPort và VoucherPort adapter kết nối trực tiếp database transaction.

