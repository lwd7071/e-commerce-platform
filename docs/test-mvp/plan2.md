# Kế hoạch kiểm thử MVP — Đợt 2

## Mục tiêu

Kiểm tra lại hệ thống sau khi các nhánh tính năng đã được gộp vào `dev`, tập trung vào **luồng xuyên vai trò trên frontend, backend và database thật của môi trường test**. Đợt 1 trong [plan.md](plan.md) là mốc tham chiếu; kết quả và bằng chứng cũ không tự động được tính là đã qua đợt 2.

Tiêu chí nghiệp vụ theo [quy tắc theo vai trò](../architecture/role-business-rules.md), [testing quality gates](../architecture/rules/testing-quality-gates.md) và các state machine được liên kết từ đó. Nếu tài liệu và hành vi thực tế khác nhau, ghi rõ sai lệch để quyết định, không tự đổi rule cho khớp code.

## Chuẩn bị chung

1. Ghi commit SHA của `dev`, phiên bản frontend/backend, ngày chạy và URL môi trường test vào báo cáo. Dùng môi trường và dữ liệu test riêng; không dùng production.
2. Chạy migration trên database test, chuẩn bị Redis/storage/cấu hình thanh toán test khi luồng cần đến. Xác nhận frontend gọi đúng backend và không bật chế độ mock cho các ca được đánh dấu **live**.
3. Chuẩn bị tài khoản Guest, hai Buyer, hai Seller thuộc hai Shop khác nhau (`ACTIVE` và `PENDING`), một Admin; sản phẩm có variant/tồn kho, voucher, địa chỉ và dữ liệu đơn hàng. Không ghi mật khẩu, token hay secret vào tài liệu.
4. Chạy baseline lint, typecheck, build và các bộ test tự động hiện có của frontend/backend. Ghi lệnh, số ca pass/fail và lỗi môi trường; test mô phỏng hoặc mock API phải được ghi đúng là test mô phỏng.
5. Dùng mã ca mới dạng `T2-P1-01`…`T2-P5-01`. Chia sẻ ID dữ liệu test và Order giữa các người để theo dõi trọn hành trình; tránh cùng sửa một fixture khi chạy song song.

## Luồng chung phải đi hết

| Mã | Hành trình | Bằng chứng tối thiểu |
|---|---|---|
| `T2-E2E-01` | Guest xem sản phẩm → Buyer đăng nhập → thêm variant vào giỏ → chọn địa chỉ/voucher → checkout → xem đơn → Seller xác nhận, chuẩn bị, bàn giao vận chuyển → Buyer xác nhận nhận hàng khi đủ điều kiện → tạo review | Ảnh/trace từng mốc, request ID, Order ID, trạng thái và history, tồn kho, số tiền, notification, review |
| `T2-E2E-02` | Buyer tạo đơn rồi hủy khi còn được phép; thử hủy lặp và hủy sai trạng thái | History, tồn kho được hoàn đúng một lần, response khi gọi lặp/sai trạng thái |
| `T2-E2E-03` | Seller mở Shop `PENDING` → hoàn thiện hồ sơ/địa chỉ lấy hàng → Admin duyệt → Seller tạo và bán sản phẩm | Trạng thái Shop, quyền ghi trước/sau duyệt, product/variant lưu thật |
| `T2-E2E-04` | Admin khóa User/Shop hoặc ẩn Product có reason; thử truy cập bằng phiên cũ và kiểm tra audit | API bị chặn, trạng thái tài nguyên, reason và AdminLog |

Chạy các hành trình này trên backend và database test thật. Nếu cổng thanh toán hoặc đơn vị vận chuyển chỉ có sandbox, ghi rõ phần nào dùng sandbox và điểm bàn giao nào được mô phỏng. Không gọi một Playwright test có `page.route(...).fulfill(...)` là bằng chứng tích hợp live.

## Phân công 5 người

| Người | Phạm vi đợt 2 | Ca ưu tiên và điều kiện đạt | Ghi chép bắt buộc |
|---|---|---|---|
| **Người 1** | Guest, đăng ký/đăng nhập, phiên và điều hướng | Catalog công khai chỉ hiện hàng/Shop hợp lệ; `returnTo` sau đăng nhập; đăng xuất; token sai/hết hạn; Guest gọi API riêng tư; User `LOCKED` bị chặn dù phiên cũ còn hạn. Cung cấp phiên Buyer/Seller/Admin cho các luồng chung. | Ghi tiếp vào [person-1.md](person-1.md), mục **Đợt 2**. |
| **Người 2** | Buyer: hồ sơ, địa chỉ, giỏ hàng, checkout, voucher, đơn mua, review và notification | Hai Buyer không xem/sửa dữ liệu nhau; địa chỉ mặc định và snapshot đơn; checkout một/nhiều Shop, tính tiền/voucher/tồn kho; gửi lại cùng idempotency key; hủy đơn và hoàn tồn một lần; chỉ review OrderItem đã hoàn tất, rating 1–5. Chủ trì đầu Buyer của `T2-E2E-01/02`. | Ghi tiếp vào [person-2.md](person-2.md), mục **Đợt 2**. |
| **Người 3** | Catalog, Seller Product, media và Chat AI/Live Chat | Guest/Buyer xem đúng catalog, lọc/phân trang/chi tiết; Seller tạo/sửa variant, SKU, giá, tồn và ảnh thật; Shop khác không sửa được; ẩn/hiện sản phẩm; kiểm tra lại thêm/xóa variant từng gặp timeout; review media upload/attach nếu đã hỗ trợ; chat/presence và fallback khi API lỗi. Cung cấp sản phẩm cho `T2-E2E-01/03`. | Ghi tiếp vào [person-3.md](person-3.md), mục **Đợt 2**. |
| **Người 4** | Seller Shop, voucher, xử lý đơn, vận chuyển và báo cáo | Shop `PENDING` sửa hồ sơ Shop nhưng không được bán; Shop `ACTIVE` xử lý đúng Order thuộc mình; xác nhận → chuẩn bị → bàn giao → hoàn tất theo rule, không tự hoàn tất trái quyền; voucher Shop dùng trong checkout; thử Shop khác, trạng thái sai và thao tác lặp; đối chiếu doanh thu chỉ từ Order hợp lệ `COMPLETED`. Chủ trì đầu Seller của `T2-E2E-01/03`. | Ghi tiếp vào [person-4.md](person-4.md), mục **Đợt 2**. |
| **Người 5** | Admin, RBAC, audit, thanh toán/ví/escrow và điều phối hồi quy | Duyệt/khóa/mở Shop/User, moderation Product/Review, Order command có reason và audit; kiểm tra quyền/owner; đối chiếu payment callback lặp, escrow/refund/reconcile trên môi trường test nếu được cấu hình; chạy lại các lỗi Blocker/Cao đã sửa và xác nhận không còn ảnh hưởng luồng khác. Chủ trì `T2-E2E-04` và tổng hợp kết quả. | Ghi tiếp vào [person-5.md](person-5.md), mục **Đợt 2**. |

Người 2 và 4 cùng xác nhận Order ID của `T2-E2E-01/02`; Người 3 xác nhận sản phẩm/ảnh; Người 1 xác nhận phiên/quyền; Người 5 kiểm tra audit và báo cáo chéo. Mỗi người vẫn chịu trách nhiệm ghi kết quả phần mình vào **file `person-*.md` hiện có**. Không tạo file tiến độ cá nhân mới và không ghi đè nhật ký đợt 1.

## Cách chạy và ghi kết quả

1. **Baseline:** ghi kết quả test tự động và môi trường. Lỗi test do thiếu dịch vụ/fixture vẫn là `Bị chặn`, kèm nguyên nhân và cách tái chạy; không ghi `Đã xác minh`.
2. **Luồng thành công:** thao tác qua UI như người dùng thật; kiểm tra request/response, dữ liệu lưu, trạng thái, notification/history/audit tại từng điểm quan trọng.
3. **Luồng bị từ chối:** kiểm tra sai role, sai owner, sai trạng thái, dữ liệu biên, gửi lại request và lỗi dịch vụ. Backend phải từ chối đúng; UI phải thông báo rõ và giữ dữ liệu nhập khi phù hợp.
4. **Lỗi:** ghi bước tái hiện, mong đợi/thực tế, mức độ, bằng chứng, người xử lý và liên kết commit/PR. Sau sửa, chạy lại đúng ca lỗi và ca liền kề; lỗi Blocker/Cao cần người khác xác minh lại.
5. **Báo cáo cá nhân:** mỗi người **tiếp tục cập nhật chính file `person-N.md` đã dùng ở đợt 1**. Thêm mục `## Đợt 2 — kiểm thử sau merge` gồm ngày, commit, môi trường, bảng ca, lỗi mở, kết quả kiểm tra lại và giới hạn. Mỗi ca theo mẫu trong [README.md](README.md); ghi rõ bằng chứng là live, sandbox hay mock.
6. **Tổng hợp:** Người 5 cập nhật bảng cuối file này sau khi đọc đủ năm file cá nhân. Chỉ đánh dấu hoàn tất khi có bằng chứng mới của đợt 2.

## Bảng theo dõi đợt 2

| Người | Trạng thái | Ca đã chạy / dự kiến | Lỗi mở (Blocker/Cao/Vừa/Thấp) | Cập nhật gần nhất |
|---|---|---|---|---|
| Người 1 | Đang làm (Đã chạy ca biên) | 3 / 5 | 0 / 0 / 0 / 0 | 2026-10-04 |
| Người 2 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |
| Người 3 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |
| Người 4 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |
| Người 5 | Chưa bắt đầu | 0 / chưa chốt | 0 / 0 / 0 / 0 | — |

## Điều kiện kết thúc

- Bốn hành trình chung có kết quả và bằng chứng trên môi trường test, hoặc có mục `Bị chặn` nêu rõ phần chưa thể chạy.
- Cả năm file `person-*.md` có mục Đợt 2 với commit, môi trường, ca đã chạy, kết quả và bằng chứng mới.
- Không còn lỗi Blocker/Cao chưa được xử lý hoặc chưa có quyết định rõ; lỗi Vừa/Thấp còn lại có người phụ trách và mức ảnh hưởng.
- Lint, typecheck, build và test liên quan có kết quả được ghi; các phần dùng mock/sandbox được phân biệt với luồng live.
- Người 5 đối chiếu bảng tổng hợp với nhật ký của năm người và ghi kết luận phát hành/test tiếp.

---

## Phụ lục Kỹ thuật Đợt 2: Quy chuẩn Nghiệp vụ, State Machine & Danh mục Mã lỗi (Module Người 4)
*Ngày ban hành:* `2026-10-04`.  
*Các bên thống nhất & Ký xác nhận:* Người 2 (Buyer Module), Người 4 (Nguyễn Trung Hải - Seller Module), Người 5 (Nguyễn Minh Trí - Lead Admin & Gatekeeper).

### 1. Danh mục Mã Lỗi Chung Bổ sung (Thống nhất Người 2, Người 4, Người 5)
- `ORDER_CANCELLATION_NOT_ALLOWED` (`409 Conflict`): Buyer cố tình hủy đơn hàng khi trạng thái đã là `CONFIRMED` hoặc `PREPARING` (*"Orders already confirmed by seller cannot be cancelled directly by buyer"*).
- `SELLER_CANNOT_COMPLETE_ORDER` (`403 Forbidden`): Seller vi phạm quy tắc QD11, cố tình gọi transition sang `COMPLETED` (*"Sellers cannot complete orders; completion requires buyer confirmation or administrative proof"*).
- `REFUND_REQUIRES_ADMIN` (`403 Forbidden`): Seller hoặc Buyer gọi transition sang `REFUNDED` tại các trạng thái `SHIPPING` hoặc `COMPLETED` (*"Refund processing requires Admin authority"*).
- `VOUCHER_CODE_CONFLICT` (`409 Conflict`): Trùng mã voucher trong cùng một Shop (mã chuẩn thực tế của codebase tại `error-handler.ts`, thay thế các biến thể cũ).
- `VOUCHER_NOT_OWNED` (`422 Unprocessable Entity`): Sử dụng voucher của shop khác cho sản phẩm không thuộc shop đó.
- `SHOP_NOT_ACTIVE` (`403 Forbidden`): Shop ở trạng thái `PENDING` cố tình tạo/sửa sản phẩm hoặc tạo voucher.
- `SHOP_PROFILE_READ_ONLY` (`403 Forbidden`): Token cũ gọi API ghi khi shop đã bị Admin `LOCKED` hoặc `SUSPENDED`.

### 2. Quy chuẩn Whitelist & Validation Mass Assignment (Task 1)
- Áp dụng Zod schema `.strict()` trên endpoint `PATCH /seller/shop`:
  - Mọi trường lạ không khai báo (unknown/unrecognized fields) hoặc trường nhạy cảm trong danh sách cấm (`status`, `owner_id`, `commission_rate`, `tier`, `escrow_balance`, `id`, `created_at`, `updated_at`) đều bị **REJECT thẳng thừng với mã `422 Unprocessable Entity`** (code: `VALIDATION_FAILED`), tuyệt đối **không âm thầm strip**.
- Cơ chế kiểm tra Token cũ sau khi Shop bị khóa (Ca 1.4):
  - Áp dụng **Per-request Database Query** tức thời trong middleware `auth/shop-guard`. Không phụ thuộc vào TTL của cache, đảm bảo zero-latency ngay khi Admin vừa lock shop.

### 3. Thống kê Phủ độ Ma trận State Machine Order (Tổng cộng 42 cặp trạng thái)
Hệ thống quản lý 7 trạng thái: `PENDING_CONFIRMATION`, `CONFIRMED`, `PREPARING`, `SHIPPING`, `COMPLETED`, `CANCELLED`, `REFUNDED` ($7 \times 6 = 42$ cặp chuyển trạng thái):
- **9 Cặp chuyển hợp lệ có điều kiện:** 
  1. `PENDING_CONFIRMATION` $\rightarrow$ `CONFIRMED` (Seller/Admin)
  2. `PENDING_CONFIRMATION` $\rightarrow$ `CANCELLED` (Buyer/Seller/Admin)
  3. `CONFIRMED` $\rightarrow$ `PREPARING` (Seller/Admin)
  4. `CONFIRMED` $\rightarrow$ `CANCELLED` (Seller/Admin)
  5. `PREPARING` $\rightarrow$ `SHIPPING` (Seller/Admin)
  6. `PREPARING` $\rightarrow$ `CANCELLED` (Seller/Admin)
  7. `SHIPPING` $\rightarrow$ `COMPLETED` (Buyer/Admin/Webhook ĐVVC - **Seller bị 403 QD11**)
  8. `SHIPPING` $\rightarrow$ `REFUNDED` (Admin/Hệ thống khi giao thất bại)
  9. `COMPLETED` $\rightarrow$ `REFUNDED` (Admin/Hệ thống khi khiếu nại sau nhận hàng)
- **15 Cặp cấm có test ca biên:** Bao gồm tất cả các luồng đi lùi (`COMPLETED` $\rightarrow$ `SHIPPING`, `SHIPPING` $\rightarrow$ `PREPARING`, v.v.), nhảy cóc trái phép, và các chuyển đổi đi ra từ trạng thái cuối (`COMPLETED` sang các trạng thái khác trừ `REFUNDED`, `CANCELLED` sang trạng thái khác, `REFUNDED` sang trạng thái khác).
- **18 Cặp cấm còn lại:** Tự động trả về `409 Conflict` (`ORDER_INVALID_TRANSITION`) bởi guard clause tập trung tại Service layer.
$\Rightarrow$ **Tổng cộng:** $9 + 15 + 18 = 42$ cặp (100% không gian trạng thái được đóng kín).

### 4. Quy chuẩn Kỹ thuật Kiểm thử Concurrency, Voucher & Doanh thu
1. **Ca Concurrency lặp 30 lần (`T2-P4-02`):**
   - Đơn vị đếm: 1 ca con (test scenario) chạy 30 iterations concurrency bên trong.
   - Bắt buộc ghi nhận bảng thống kê chi tiết toàn bộ 30 iterations (từ #1 đến #30, gồm Request ID, Order ID, Req 1 status, Req 2 status, Collision Duration < 50ms, History Count = 1, Kết quả PASS/FAIL) vào báo cáo tiến độ, không chỉ ghi tóm tắt một con số "30/30".
   - Bằng chứng cốt lõi tại DB: Đúng 1 request nhận `200 OK`, request thứ hai nhận `409 Conflict`, và bảng `order_status_history` chỉ ghi đúng 1 bản ghi chuyển trạng thái. Không dùng `db_lock_wait_time > 0` làm tiêu chí PASS nếu hạ tầng pooler hạn chế quyền xem `pg_stat_activity`. Nếu cả hai nhận 200 hoặc cả hai nhận 409 $\rightarrow$ Tính là `FAIL / CHẠY LẠI`. Tỷ lệ đạt chuẩn: 30 / 30 iterations (100%).
2. **Ca Race Condition 2 chiều (`T2-P4-01`):**
   - Sử dụng transaction kiểm soát lock chủ động (`SELECT ... FOR UPDATE` trên bảng `shops`) kèm `SET LOCAL lock_timeout = '5000ms'` để tránh treo vô hạn connection.
3. **Smoke Check Voucher Trùng Mã (`T2-P4-05`):**
   - Trước khi chạy bộ test lớn của `T2-P4-05`, thực hiện 1 request smoke check thật gửi POST tạo voucher với mã đã tồn tại. Xác thực và ghi nhận raw response trả về đúng mã `409 Conflict` kèm code `VOUCHER_CODE_CONFLICT` theo đúng `backend/src/platform/http/middlewares/error-handler.ts`.
4. **Ca 3.3 (Buyer xác nhận nhận hàng):**
   - Được định nghĩa là **Ca phụ trợ (Test Harness)** do Người 4 điều phối để khép kín chu trình kiểm chứng QD11; trách nhiệm chính thuộc về Người 2 (`T2-E2E-02`).
5. **Smoke Check API Báo cáo Doanh thu QD19 (`T2-P4-06`):**
   - Thực hiện 1 request smoke check độc lập gọi `GET /seller/reports/revenue?date=YYYY-MM-DD` để xác thực cơ chế quy đổi múi giờ `Asia/Ho_Chi_Minh` (UTC+7) sang dải UTC trên database. Kết quả thật (Raw Response Status 200 OK và dải UTC đã quy đổi) bắt buộc phải được ghi vào `person-4.md` trước khi chạy `T2-P4-06`.
   - Doanh thu tính theo VNĐ nguyên tệ Integer: $\sum_{\text{Đơn COMPLETED}} \left[ \sum (\text{Price} \times \text{Qty} - \text{ShopDiscount}) \right]$. Không trừ phí ship, không cộng đơn `PREPARING` / `SHIPPING`.
6. **Lộ trình Thực thi Phân kỳ (Execution Phasing):**
   - **Đợt A (Chạy ngay):** Giai đoạn 0 (Seed dữ liệu & chuẩn bị môi trường), `T2-P4-01` (Shop Gating & Mass Assignment), `T2-P4-03` (QD11 Cấm Seller Hoàn tất đơn), `T2-P4-04` (IDOR & Cách ly đa gian hàng).
   - **Đợt B (Chạy sau khi xác thực Smoke Voucher):** `T2-P4-02` (Concurrency 30 iterations có bảng log 30 dòng), `T2-P4-05` (Quản trị voucher shop & Checkout).
   - **Đợt C (Chạy sau khi xác thực Smoke Date và có kết quả Đợt A/B):** `T2-P4-06` (Đối soát doanh thu QD19), `T2-E2E-01` (Hành trình mua bán live), `T2-E2E-03` (Hành trình mở shop PENDING live).
7. **Hiệu lực Ký Nghiệm Thu:**
   - Chữ ký tại kế hoạch là cam kết phương pháp luận và tiêu chuẩn chất lượng. Hiệu lực nghiệm thu chính thức được kích hoạt sau khi chạy xong thực tế và xuất kèm Biên bản nghiệm thu nghiệm thu đầy đủ bằng chứng 4 yếu tố.
