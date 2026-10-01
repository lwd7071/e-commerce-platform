# CR-SELLER-01 — Hoàn thiện vận hành Seller

## Trạng thái

**Approved** — 2026-10-01, được Chủ dự án phê duyệt trực tiếp trong hội thoại Codex.

## Owner và review

- Owner: Chủ dự án.
- Ghi nhận: Codex cập nhật trạng thái theo chỉ thị trực tiếp của Chủ dự án ngày 2026-10-01; không giả lập reviewer kỹ thuật.
- Ngày phê duyệt: 2026-10-01.

## Lý do

Seller hiện có luồng tạo/quản lý một phần Product và fulfillment, nhưng chưa có API/UI tự quản lý Shop, voucher, báo cáo và thông báo. Dashboard FE đang dùng Shop ID mẫu, `/seller/kpi` chưa có runtime handler, và một số màn Seller vẫn lấy dữ liệu từ public/mock boundary. Các thay đổi dưới đây bổ sung khả năng Seller vận hành Shop thật, luôn scope theo identity đã xác thực.

## Quyết định đã duyệt

1. Seller được đọc Shop sở hữu và cập nhật `shop_name`, `description`, `pickup_address`, `contact_phone` ở trạng thái `PENDING` hoặc `ACTIVE`. `PENDING` chỉ được hoàn thiện Shop; vẫn không được quản lý Product, Voucher, Order hay báo cáo bán hàng. Shop `SUSPENDED`/`LOCKED` chỉ đọc hồ sơ.
2. Admin chỉ duyệt Shop khi có địa chỉ lấy hàng và số điện thoại liên hệ. Kiểm tra nằm trong transaction duyệt; lỗi validation không đổi trạng thái và không ghi audit thành công giả. Shop đã `ACTIVE` thiếu dữ liệu không tự bị đổi trạng thái.
3. Thông báo cá nhân của Seller được đọc/đánh dấu đã đọc theo `recipient_id = context.user_id`, không phụ thuộc Shop ACTIVE.
4. Seller có thể cập nhật thông tin Product/Variant và ảnh thuộc Shop. Tồn kho tiếp tục là command riêng. SKU duy nhất theo Shop; giá dương; tồn không âm. Variant đã tham gia Order không xóa vật lý. Seller không thể bỏ trạng thái moderation `HIDDEN`.
5. Seller quản lý Voucher `SHOP` của Shop mình. Voucher có usage chỉ được deactivate; thay đổi điều kiện tạo voucher mới. Checkout hiện hữu và Order lịch sử giữ snapshot/discount đã ghi nhận.
6. Seller dashboard/report chỉ truy vấn dữ liệu của Shop từ request context; `shop_id` do FE truyền không cấp quyền. Doanh thu chỉ tính Order `COMPLETED` theo QD19.
7. Shop logo là optional. Nếu triển khai, chỉ attach media `SHOP_LOGO` đã finalize và thuộc Seller hiện tại; bucket/path phải tuân theo Storage policy.

## API/contract dự kiến

- `GET/PATCH /seller/shop`
- `GET /seller/products` cursor pagination; `GET /seller/products/:id`; `PATCH /seller/products/:id`; giữ stock và status command riêng.
- `GET/POST /seller/vouchers`; `GET/PATCH /seller/vouchers/:id`; `PATCH /seller/vouchers/:id/status`.
- `GET /seller/kpi`; `GET /seller/reports/revenue?from=&to=`.
- Cho Seller dùng `GET/PATCH /notifications...` với owner scope.
- Mở rộng `GET /orders` cursor pagination và Order detail có status history nếu contract hiện hành không đáp ứng.
- Nếu có logo: thêm media purpose `SHOP_LOGO` và migration mới cho constraints/storage policy; không sửa migration đã phát hành.

Request/response DTO, error codes và OpenAPI phải được chốt trước implementation. Tất cả API dùng envelope/request ID chuẩn. Client không được chọn arbitrary `shop_id`.

## Tài liệu/rules cần cập nhật sau khi Approved

- `docs/architecture/rules/auth-rbac-rls.md`: ngoại lệ quyền sửa hồ sơ Shop ở PENDING, tách Buyer Address, seller notifications, owner scope.
- `docs/architecture/rules/business-rules.md`: điều kiện duyệt Shop, cập nhật Product/Variant/Voucher và report ownership nếu rule hiện tại chưa bao phủ.
- `docs/architecture/rules/api-conventions.md`/`error-observability.md`: endpoint và lỗi ổn định mới.
- `docs/architecture/rules/db-schema-rules.md`: chỉ nếu mở rộng purpose/bucket hoặc constraint.
- `docs/architecture/role-business-rules.md`, FE mapping/gap/implementation plan, OpenAPI và migration tương ứng.
- Không sửa `docs/spec/schema-freeze-v1.md`.

## Acceptance và test traceability

- REST/PostgreSQL: seller A không đọc/ghi tài nguyên Seller B; PENDING sửa Shop được nhưng bị chặn business writes; Admin approve thiếu address/contact bị từ chối nguyên tử; ownership, SKU, giá/tồn, Voucher usage và media ownership được enforce.
- Orders: Seller chỉ thao tác Shop mình; mọi transition tuân QD11/QD13; timeline có thứ tự; retry/conflict không tạo history, notification hay side effect trùng.
- Voucher/report: Voucher scope đúng Shop; checkout concurrency không oversell quantity; report chỉ tính COMPLETED, Shop hiện tại và date filter hợp lệ.
- FE: không dùng Shop ID mẫu/mock trong live; loading/empty/error/accessibility và Shop status được trình bày chính xác.
- E2E: onboarding → Shop completion → Admin approve → Product create/edit → Buyer checkout → Seller fulfill → Buyer confirm → report update.

## Implementation evidence và việc còn lại

CR được Approved để triển khai; approval không phải nghiệm thu. Trạng thái dưới đây được đối chiếu với code tại HEAD `fd353e1` ngày 2026-10-01. Các con số test là evidence lịch sử ở lượt đã ghi; nhóm test thêm sau đó chưa có kết quả chạy mới trong nhật ký.

- Đã triển khai: Shop self-service và điều kiện duyệt nguyên tử; KPI/report/voucher API và UI; order pagination/history và Seller notifications; Product list/detail/edit, variant lifecycle và guard moderation; Product media upload/finalize và edit ảnh; Shop logo media; UI tests cho Shop/product edit/voucher/report; Seller browser E2E dùng mock API. Các cập nhật sau `cf2003b` nằm trong `38b4501`, `1b7e014`, `2b9f4a6`, `fd353e1`.
- Evidence lịch sử trước các cập nhật trên: focused backend REST, frontend Vitest 48 files/274 tests, backend/frontend typecheck, lint/build và OpenAPI drift pass; PostgreSQL integration riêng pass cho Shop approval, voucher, reporting, order/checkout và một số catalog behavior. Variant add/remove rerun mới nhất lúc đó lỗi `ETIMEDOUT`; chưa có kết quả rerun mới được ghi.
- Evidence mới trong repository: focused UI tests, Seller mocked browser lifecycle E2E, Shop logo/media integration tests và PostgreSQL Product image update integration test. Sự hiện diện của test trong source không khẳng định test đã chạy pass.
- Seller browser E2E hiện mock API; bao phủ Shop profile, upload/xóa ảnh Product khi edit, voucher và report. Chưa bao phủ full lifecycle onboarding → Admin approve → Buyer checkout → Seller fulfillment → Buyer confirm → report với backend/DB thật.
- Full backend Vitest chưa có pass toàn suite được ghi nhận; lượt trước bị dừng sau mismatch assertion Voucher, assertion đã được sửa và các DB suite liên quan được chạy riêng. Không tính các suite riêng là full-suite pass.
- Còn lại: chạy các test UI/E2E/media mới; xác minh migration và logo/media integration; rerun variant PostgreSQL integration khi DB reachable; chạy full backend Vitest; bổ sung/chạy full lifecycle browser E2E với backend thật; cập nhật evidence chính xác.

## Điều kiện áp dụng

Các thay đổi nghiệp vụ/API nêu trong CR được triển khai sau khi Chủ dự án phê duyệt. Review kỹ thuật bổ sung có thể được ghi nhận khi có reviewer tương ứng; không giả lập người review.
