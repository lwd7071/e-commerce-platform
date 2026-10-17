# CR-LOYALTY-03 — Đổi/thu hồi DinoPoint và lịch xét PREFERRED

- Ngày: 11/10/2026.
- Trạng thái nghiệp vụ: Approved — chủ dự án chọn “Chốt theo đề xuất” trong phiên làm việc.
- Owner: NVCuong3112; phối hợp Tri Nguyen nếu tích hợp sự kiện hoàn tiền từ finance/PayOS.
- Trạng thái phát hành: Chờ review draft PR #14; chưa merge hoặc triển khai production.

## Quy tắc được duyệt

1. Mỗi lượt đổi 100 DinoPoint phát hành một voucher PLATFORM giảm 10.000đ, đơn tối thiểu 100.000đ, hạn 30 ngày và một lượt sử dụng. Voucher chỉ dành cho Buyer đã đổi; hệ thống chặn sử dụng bởi tài khoản khác và không đưa vào danh sách voucher chung.
2. API lấy Buyer ID từ auth context. UUID idempotency_key dùng lại khi retry; cùng key chỉ có một voucher, một ledger và một lần trừ điểm. Các lượt đổi khác key cùng Buyer được khóa để không vượt số dư. Số dư dưới 100, kể cả âm, không đổi được.
3. Chỉ điều chỉnh loyalty sau khoản hoàn tiền thành công. Tiền đủ điều kiện hoàn là phần tiền hàng sau giảm giá, không gồm phí ship; Admin nhập **số tiền tăng thêm của khoản hoàn này**, không nhập tổng lũy kế.
4. Điểm thu hồi lũy kế = floor(điểm đã thưởng cho đơn × tiền đủ điều kiện đã hoàn lũy kế / tiền đủ điều kiện ban đầu). Mỗi khoản hoàn chỉ trừ phần tăng thêm. Hoàn toàn bộ thu hồi đủ điểm gốc, tránh mất điểm do làm tròn từng lần.
5. Trừ chi tiêu đã hoàn, giữ VIP đã đạt. Cho phép điểm âm khi điểm đã đổi thưởng; điểm mới bù nợ. Voucher đã đổi không tự bị hủy. Hết hạn voucher không tự hoàn điểm.
6. Mã đối soát khoản hoàn là duy nhất. Retry cùng mã/cùng đơn/cùng tiền không trừ lại; đổi dữ liệu dưới cùng mã trả 409. Vượt tiền đủ điều kiện còn lại trả 409. Điều chỉnh ledger, điểm/chi tiêu và audit Admin cùng transaction.

## Phạm vi hoàn tiền thực tế

API `POST /api/v1/admin/orders/:id/loyalty-refunds` ghi nhận khoản hoàn **đã được Admin xác minh thành công**, bắt buộc mã đối soát và lý do/bằng chứng. API này không gọi PayOS, chuyển tiền, sửa payment hoặc escrow. Backend hiện chưa có sự kiện hoàn tiền thành công cho đơn COMPLETED từ provider; không suy ra trạng thái escrow REFUNDED là bằng chứng tiền đã chuyển. Luồng callback tự động cần phối hợp owner finance và đối chiếu hợp đồng provider trước khi kết nối.

Không backfill đơn cũ. Nếu ledger ORDER_COMPLETED cũ chưa có snapshot eligible_spent_amount, dùng subtotal/discount_amount của đơn để đối chiếu; đơn không có ledger không bị tự tạo điểm hoặc thu hồi. Đơn 0 điểm có thể giảm chi tiêu khi hoàn tiền.

## Lịch PREFERRED

- Backend `src/server.ts` bật worker lúc khởi động và mỗi 86.400.000 ms (24 giờ). Đây là lịch theo vòng đời backend, không phải lịch cố định 00:00 hay cron của Supabase.
- `SHOP_TIER_WORKER_ENABLED=false` tắt worker; `SHOP_TIER_INTERVAL_MS` đặt khoảng chạy từ 1.000 đến 2.147.483.647 ms, phải là số nguyên. Test không bật worker ngầm khi gọi createRuntimeApp; server production/dev bật rõ qua runtime option.
- Dùng tiêu chí sẵn có: 20 đơn COMPLETED, rating >=4,5, ít nhất 5 review VISIBLE. Toàn bộ lịch sử; không tự đặt khoảng 30 ngày hoặc thời gian chờ hạ hạng.
- Chỉ xét ACTIVE, bỏ qua MALL và override Admin. Mỗi Shop được khóa FOR UPDATE trong transaction trước khi đọc hạng và cập nhật để không ghi đè quyết định Admin đồng thời. Ngưỡng custom của API Admin được kiểm tra kiểu/phạm vi.
- Tick không chồng trong một tiến trình; advisory transaction lock PostgreSQL ngăn hai tiến trình chạy sweep đồng thời. Lỗi rollback toàn sweep và retry ở lượt kế; shutdown chờ lượt đang chạy trước khi đóng pool.
- Sweep dùng một transaction nên có thể giữ khóa lâu nếu số Shop lớn; khi có bằng chứng cần tối ưu mới tách batch. Worker cần backend luôn chạy; không tiếp tục chạy khi backend đã dừng. Chưa có lịch sử audit riêng cho từng lần tự xét.

## Dữ liệu và API

- Migration forward-only `20261011200000_loyalty_redemption_refunds`; không sửa Schema Freeze hoặc migrations đã phát hành.
- Cho phép điểm âm, tiếp tục bắt buộc total_spent không âm; voucher có loyalty_owner_id; ledger thêm operation_key, voucher_id, eligible_spent_amount và refunded_eligible_amount, cùng unique indexes chống retry.
- RLS/revoke của vouchers/ledger được giữ. Secrets, fixture credentials và env test nằm ngoài Git.
- Buyer: GET `/buyer/loyalty/rewards`, POST `/buyer/loyalty/redeem`; Admin: POST `/admin/orders/:id/loyalty-refunds`. OpenAPI và generated types đồng bộ.
- UI Profile có đổi điểm, voucher và lịch sử âm; Admin Order detail có form ghi nhận khoản hoàn đã thành công.

## Kiểm chứng

Theo [báo cáo chạy thật](../../test-mvp/dino-loyalty-extension-live.md). Không coi các skipped local là PASS; CI mới được xác nhận theo đúng commit của PR.
