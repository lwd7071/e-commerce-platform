# Testing and Quality Gates

## 1. Mục tiêu

Không coi rule là đã triển khai nếu chưa có test chứng minh. Bộ test phải xác nhận cả đường thành công, đường bị từ chối và cạnh tranh transaction.

## 2. Test pyramid

| Tầng | Phạm vi | Công cụ đề xuất |
|---|---|---|
| Unit | Hàm tính tiền, voucher, state transition, validation thuần | Vitest |
| Service integration | Payload service + PostgreSQL thật, transaction và constraint | Vitest + test database |
| API contract | Method/path/envelope/status/auth/idempotency | Vitest/Supertest tương đương |
| RLS/security | Quyền DB role, JWT, ownership và redaction | SQL/integration tests |
| End-to-end | Luồng Buyer/Seller/Admin trọng tâm | Playwright |

Không mock PostgreSQL cho test constraint, isolation, row lock hoặc race condition.

## 3. Database gates

- Migration chạy thành công trên database trống.
- Toàn bộ migration chạy lại từ đầu tạo đúng 22 bảng.
- PK/FK/CHECK/UNIQUE/partial unique index có test positive và negative.
- Test delete policy xác nhận dữ liệu lịch sử không bị cascade ngoài ý muốn.
- `EXPLAIN` cho query danh sách Order/Product/Notification quan trọng sử dụng index phù hợp với dữ liệu thử đủ lớn.
- Migration đã phát hành không bị chỉnh sửa; checksum hoặc review phát hiện thay đổi.

## 4. Traceability QD01-QD20

| Rule | Test tối thiểu |
|---|---|
| QD01 | Email duplicate và concurrent registration |
| QD02 | Schema/log không chứa password plaintext |
| QD03 | User LOCKED với JWT hợp lệ vẫn bị chặn |
| QD04 | Seller cross-shop bị chặn |
| QD05 | Price 0/âm bị chặn |
| QD06 | Stock âm bị DB/Service chặn |
| QD07 | Hai checkout không oversell |
| QD08 | Đổi giá variant không đổi Order cũ |
| QD09 | Voucher hết hạn/hết lượt/sai scope/min order |
| QD10 | Total không âm và đúng công thức |
| QD11 | Toàn bộ transition hợp lệ/bị cấm |
| QD12 | Buyer chỉ hủy trạng thái được phép |
| QD13 | Seller không xử lý Order Shop khác |
| QD14 | Review đúng Buyer/Product/OrderItem và Order completed |
| QD15 | Rating boundary 1-5 |
| QD16 | Dữ liệu có giao dịch chỉ đổi trạng thái |
| QD17 | Moderation thiếu reason bị từ chối |
| QD18 | Card data bị từ chối và redacted khỏi log |
| QD19 | Revenue chỉ tính Order completed/hợp lệ |
| QD20 | Admin action và AdminLog atomic |

Mỗi QD phải được gắn ID trong tên test hoặc metadata để có thể truy vết tự động.

## 5. API contract gates

- Mọi endpoint dùng `/api/v1`, resource naming và envelope chuẩn.
- UUID/timestamp/decimal string đúng format.
- `400/401/403/404/409/422/500/503` đúng trường hợp.
- Error response không lộ stack, SQL hoặc constraint name.
- Pagination cursor ổn định, không trùng/mất record khi có cùng sort value.
- Unknown field và invalid sort/filter bị từ chối.
- `request_id` luôn có trong success/error response.

## 6. RBAC và RLS gates

- Guest chỉ đọc dữ liệu công khai.
- Buyer A không đọc/ghi dữ liệu riêng của Buyer B.
- Seller A không đọc/ghi Product, Voucher và Order của Seller B.
- Admin command nhạy cảm phải có reason và audit.
- User LOCKED bị chặn ở mọi protected endpoint.
- DB role `anon` và `authenticated` không trực tiếp truy cập 22 bảng nghiệp vụ.
- Frontend build scan không chứa Supabase service-role key hoặc database credential.

## 7. Transaction và concurrency gates

- Failure tại từng bước tạo Order rollback toàn bộ.
- Multi-shop checkout tạo đúng một Order/Shop và atomic toàn request.
- Hai request mua lượng tồn cuối: không tồn âm, không cả hai cùng commit quá số lượng.
- Hai request dùng lượt Voucher cuối: tối đa một request thành công.
- Hai payment callback đồng thời: tối đa một Payment `SUCCESS`.
- Hai default Address đồng thời: partial unique index chặn vi phạm.
- Deadlock/serialization retry có giới hạn và không lặp side effect.
- Hủy Order retry không hoàn tồn hoặc ghi history hai lần.

## 8. Idempotency gates

- Cùng key/cùng payload trả cùng kết quả và ID resource.
- Cùng key/khác payload trả `IDEMPOTENCY_KEY_REUSED`.
- Hai request cùng key chạy đồng thời không tạo hai Order/Payment.
- Replay callback không tạo Notification/History/Audit trùng.
- Record idempotency hết hạn theo policy nhưng không làm mất tính đúng của resource đã tạo.

## 9. End-to-end MVP

Các luồng bắt buộc:

1. Buyer đăng nhập, thêm Variant, checkout, tạo Order và xem lịch sử.
2. Seller xác nhận, chuẩn bị và bàn giao vận chuyển cho Order thuộc Shop.
3. Shipment hoàn thành làm Order `COMPLETED`; Buyer tạo Review.
4. Buyer hủy Order còn cho phép và tồn kho được xử lý đúng một lần.
5. Admin khóa User/Shop hoặc ẩn Product với reason và thấy audit log.
6. User bị khóa không tiếp tục gọi protected API dù phiên cũ còn hạn.

## 10. Quality gate cho merge

Một thay đổi chỉ được merge khi:

- Lint/typecheck/build pass.
- Unit và integration tests liên quan pass.
- Migration test pass nếu có thay đổi DB.
- API/RBAC/security tests pass nếu thay đổi endpoint/quyền.
- Mọi QD/RB bị ảnh hưởng có test cập nhật.
- Không có secret hoặc card data trong code, fixture, snapshot hay log test.
- Tài liệu rule và CR Approved được cập nhật nếu hành vi thay đổi.

Không được bỏ qua test bằng `.skip`, chỉ snapshot lỗi hoặc nới assertion để làm CI xanh mà không có lý do review rõ ràng.

## 11. Quality gate cho release

- Chạy migration trên môi trường staging từ bản gần production.
- Chạy smoke E2E cho Buyer/Seller/Admin.
- Kiểm tra rollback/restore plan và backup trước migration phá vỡ.
- Kiểm tra dashboard metrics/log/alert nhận được request_id và error code.
- Xác nhận service-role key chỉ tồn tại ở secret store server.
- Kiểm tra changelog liên kết CR Approved và migration/API thay đổi.
