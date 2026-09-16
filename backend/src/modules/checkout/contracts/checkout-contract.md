# Transaction core T1 — contract đề xuất

Trạng thái: **Đề xuất, chưa khóa/bàn giao**. Owner: Thành viên 5.
Không thay thế shared contract của Thành viên 1 hay port của Thành viên 3/4.

## Căn cứ

- `docs/architecture/rules/order-workflow-transactions.md` §1–8.
- `docs/architecture/rules/api-conventions.md` §1–7.
- `docs/architecture/rules/auth-rbac-rls.md` §2–4.
- `docs/architecture/rules/db-schema-rules.md` §3, §9.
- `docs/architecture/rules/error-observability.md` §2, §6.
- Schema Freeze bảng Order, OrderItem, Payment, Shipment; QD08–QD13,
  QD18, QD20; RB-LTT06/08, RB-LB07/08/10, RB-LQH01–04.

## API và quyền

Mọi response qua envelope do platform sở hữu: success `data` + `request_id`,
error `error.code/message/details?` + `request_id`. Không triển khai HTTP ở T1 này.
UUID canonical lowercase; JSON snake_case; tiền decimal string; thời gian ISO UTC.
Unknown field bị từ chối. Không tin role/user_id/shop ownership từ request body.

| Command | Endpoint đề xuất | Input | Thành công / quyền |
|---|---|---|---|
| Checkout | POST /api/v1/orders | address_id, payment_method COD/ONLINE, vouchers? [{shop_id, code}]; Idempotency-Key header | 201, data = CheckoutResult; Buyer |
| Hủy | POST /api/v1/orders/{order_id}/cancel | expected_status, reason | 200, data = {order_id, status: CANCELLED}; Buyer sở hữu pending; Seller đúng Shop theo §8 |
| Xác nhận | POST /api/v1/orders/{order_id}/confirm | expected_status: PENDING_CONFIRMATION | 200, data = {order_id, status: CONFIRMED}; Seller đúng Shop |
| Chuyển trạng thái Seller | POST /api/v1/orders/{order_id}/transition | expected_status, target_status PREPARING/SHIPPING | 200, data = {order_id, status}; Seller đúng Shop, đúng cạnh |
| Can thiệp Admin | POST /api/v1/orders/{order_id}/admin-transition | expected_status, target_status, reason | 200, data = {order_id, status}; Admin; History và AdminLog cùng transaction |
| Retry Payment | POST /api/v1/orders/{order_id}/payments | method COD/ONLINE; Idempotency-Key header | 201, data = {payment_id, order_id, status: PENDING, amount}; Buyer sở hữu |

Các path bổ sung (transition/admin-transition), request/response đề xuất cần
Thành viên 1 review trước khi khóa. Admin vẫn phải tuân thủ cạnh chuyển trạng thái.
Shipment integration là actor nội bộ đã xác thực, không thêm role vào bảng User.

`address_id` phải được resolve và kiểm tra ownership qua Buyer contract trước khi
snapshot; không lấy địa chỉ của người khác. `shop_id` trong voucher chỉ là lựa chọn,
không chứng minh ownership và phải khớp Shop suy ra từ các dòng cart.
Cart port cung cấp toàn bộ dòng đang isSelected; command không tự thêm cart-item ID.
Không nhận client price/subtotal/discount/total/shipping fee làm nguồn chuẩn.

Cancel reason trim khác rỗng; PREPARING chỉ cho hủy khi policy ngoại lệ đã xác minh.
`processingEligible` và `exceptionalCancellation` của domain là bằng chứng từ
caller đáng tin cậy, KHÔNG là field được phép gửi qua API.
Domain trả decision; handler sau này mới ghi status/history/stock/audit.

## Transaction boundary — toàn request checkout

Không có partial success. Result chứa ít nhất một Order, đúng một Order mỗi Shop.
Một failure phải rollback toàn nhóm Order và các side effect trong DB.

1. Tải Cart/CartItem được chọn của Buyer, nhóm theo Shop.
2. Khóa các Variant theo thứ tự variant_id ổn định.
3. Xác nhận Product, Variant, Shop đang hoạt động.
4. Đọc giá hiện hành; xác nhận requested quantity không vượt tồn.
5. Khóa và kiểm tra lại Voucher: status, scope, Shop, thời gian, quantity, min order.
6. Tính tiền decimal chính xác, không dùng floating-point; chốt shipping fee từ nguồn server.
7. Tạo Order mỗi Shop, snapshot địa chỉ, PENDING_CONFIRMATION.
8. Tạo OrderItem với snapshot ProductName, Variant, UnitPrice.
9. Ghi VoucherUsage và giảm lượt có điều kiện; discount khớp Order.
10. Trừ tồn có điều kiện, không âm, không trừ lần hai sau lock.
11. Ghi initial History, Payment PENDING, Notification Buyer/Seller.
12. Dọn đúng CartItem đã checkout, lưu result idempotency cùng transaction rồi commit.

Repository không tự commit. Không giả lập atomicity bằng Map hoặc compensating
updates. Các port phải được bind vào cùng transaction qua adapter đã thống nhất
với Thành viên 2/3/4; tài liệu này không phát minh transaction helper thay thế.
Initial history OldStatus NULL; snapshot và tổng tiền bất biến sau commit.
Hủy hoàn tồn đúng một lần; mặc định không hoàn lượt voucher tự động.

## Idempotency

- Scope: user_id + endpoint + key. Endpoint retry phải bao gồm order_id canonical
  để tránh replay kết quả của Order khác. Key dài 16–128 ký tự.
- Fingerprint từ payload đã validate, canonical hóa theo quy tắc thống nhất;
  không tính request_id. Cần chốt canonicalization/version với platform trước storage thật.
- Claim phải atomic; cùng scope/fingerprint đã hoàn tất trả result cũ; không gọi lại
  Catalog/Cart/Voucher. Khác fingerprint: 409 IDEMPOTENCY_KEY_REUSED.
- Claim đang xử lý: 409 REQUEST_IN_PROGRESS hoặc chờ kết quả cũ theo platform policy.
- Scope khác không replay lẫn nhau. Duy trì kết quả tối thiểu 24 giờ.
- `complete` phải commit cùng dữ liệu Order và Cart cleanup; replay dùng request_id
  của request hiện tại. `release` chỉ sau rollback và đúng ownership token.
- Crash recovery, lease expiry và isolation của adapter còn chờ người 2.
- Không có implementation idempotency storage/consumer trong đợt này; interface
  không tự chứng minh chống request đồng thời.

## Error mapping

| Tình huống | Code / HTTP |
|---|---|
| Thiếu Idempotency-Key | IDEMPOTENCY_KEY_REQUIRED / 400 |
| Sai field, UUID, key length, method | VALIDATION_FAILED / 422 |
| Cùng key khác fingerprint | IDEMPOTENCY_KEY_REUSED / 409 |
| Request đang xử lý | REQUEST_IN_PROGRESS / 409 |
| Transition/expected status không hợp lệ | ORDER_INVALID_TRANSITION / 409 |
| Buyer không được hủy | ORDER_CANCELLATION_NOT_ALLOWED / 409 |
| Thiếu reason | REASON_REQUIRED / 422 |
| Seller chéo Shop | RESOURCE_FORBIDDEN / 403 |
| Buyer truy cập Order không sở hữu | RESOURCE_NOT_FOUND / 404 |
| Không đủ tồn | INVENTORY_INSUFFICIENT / 409 |
| Voucher không hợp lệ | VOUCHER_NOT_APPLICABLE / 422 |
| Payment amount sai | PAYMENT_AMOUNT_INVALID / 422 |
| Order đã có Payment SUCCESS | PAYMENT_ALREADY_COMPLETED / 409 |

`transitionShipment` trả decision INVALID_STATUS/INVALID_TRANSITION ở domain;
đây không phải mã lỗi HTTP mới. Mapping transition Shipment còn chờ chốt.
Không đưa stack, SQL, credential hay dữ liệu thẻ vào response/log.

## Payment và callback chưa khóa

`settlePendingPayment` chỉ xử lý attempt PENDING, không phải callback handler.
SUCCESS cần paid_at, Amount dương và bằng toàn bộ Order.TotalAmount.
`createPaymentRetry` nhận snapshot đầy đủ các attempts cùng Order dưới lock;
chặn SUCCESS đã tồn tại và tạo ID mới. Hàm thuần không bảo vệ concurrent writes.
SUCCESS replay phải được handler nhận diện và trả kết quả cũ; không gọi settlement lần hai.
Không suy diễn FAILED là terminal tuyệt đối: callback success đến muộn sau FAILED
còn thiếu chính sách. Không tự thêm cạnh chuyển trạng thái hoặc refund policy.

## Dependency/blocker và tiêu chí bàn giao

1. Người 1: scaffold, lint/typecheck/build/test discovery, RequestContext, envelope,
   auth, Audit port. Đầu ra phải chạy được gate và API contract test.
2. Người 2: DB client/transaction helper, migrations, test DB, idempotency storage.
   Bàn giao bằng test rollback từng bước, concurrency, unique success thật.
3. Người 3: nguồn ShopID/ProductName/Product status; xác định lockVariant chỉ lock
   hay đồng thời decrement và cách bind transaction. Hiện service dùng Map/trừ tồn ngay.
   SalePrice/effectivePrice trong code chưa có CR Approved tương ứng với Schema Freeze.
4. Người 4: Cart/Voucher trong cùng transaction, address snapshot/ownership,
   Notification transactional contract. Không bỏ Notification để giả hoàn tất checkout.
5. Nhóm/owner: tổng Order bằng 0 nhưng Payment.Amount phải >0; chính sách phí ship;
   callback success đến sau FAILED; mapping lỗi Shipment và endpoint đề xuất.

Không mở orchestration success test đầy đủ bằng mock thêm field ngoài port đã khóa.
Sau bàn giao, mock đúng ICatalogPort/ICartPort/IVoucherPort tại boundary; kiểm tra
qua kết quả checkout, không test mock đơn lẻ hay private implementation.

## Acceptance cases

Đã có runtime tests: Order, Shipment, pending Payment/retry, checkout input validation.
Các case sau là tiêu chí tương lai, CHƯA chạy/chưa pass:

- Một/nhiều Shop: đúng số Order, initial History/Payment, snapshot chính xác.
- Lỗi bất kỳ bước nào: không có checkout result thành công và DB rollback tất cả.
- Cùng key/cùng payload: cùng IDs; khác payload: conflict; concurrent: không nhân đôi.
- Voucher hết lượt sau preview; không dọn Cart khi checkout thất bại.
- Hai request tranh tồn cuối; hai callback success; hủy retry không hoàn tồn hai lần.
- Callback Shipment lặp không nhân đôi History; DELIVERED/FAILED cập nhật Order
  chỉ khi Order SHIPPING, atomic cùng Shipment.
- Role/ownership/expected status, error envelope và AdminLog rollback qua API thật.

Mock không thay test PostgreSQL cho constraint, lock/isolation hoặc concurrency.
