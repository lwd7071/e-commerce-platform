# Kiểm chứng đổi/thu hồi DinoPoint và lịch PREFERRED

Ngày 11/10/2026. Phạm vi được duyệt tại [CR-LOYALTY-03](../spec/changes/CR-LOYALTY-03-redemption-refunds-scheduler.md). Nhánh `feat/yeu-cau-nang-hang-dino-mall`, draft [PR #14](https://github.com/lwd7071/e-commerce-platform/pull/14), chưa merge.

## Môi trường

Supabase test riêng `tejmnwemsnosolidkvqb`, database postgres qua session pooler Sydney, role postgres; đối chiếu đúng project/host trước migration. Tổng 23 migrations đã áp dụng, gồm migration mới `20261011200000_loyalty_redemption_refunds`. Không migrate hoặc seed database dùng chung/production. Key, password và credentials Auth test lưu ngoài Git.

Frontend/backend local, NEXT_PUBLIC_USE_MOCK=false, Chrome thật. Tài khoản Auth disposable riêng và dữ liệu test có ledger được tạo qua LoyaltyService trong transaction. Khoản hoàn trong E2E là dữ liệu thử nghiệm do Admin ghi nhận; không chuyển tiền thật hoặc xác minh PayOS hoàn tiền. Guard yêu cầu opt-in, allowlist và cùng đích Auth/database như Dino Mall; không được dùng một cờ test để vượt kiểm tra.

## Kết quả

| Kiểm tra | Kết quả |
| --- | --- |
| Backend native `npm run test:node` | 801/801 PASS, chạy lại sau sửa |
| Backend Vitest không remote DB | 198 PASS, 239 SKIPPED; skipped không phải PASS |
| Worker/RBAC unit HTTP | 13/13 PASS, dùng mock thời gian/service/Auth context; không phải live JWT |
| Full frontend | 416/416 PASS |
| Database schema/Mall/loyalty mở rộng | 39/39 PASS, 399,83 giây; hai ca redemption/ownership chạy lại sau bổ sung guard ACTIVE và tính tiền chính xác đều PASS |
| Live Dino Mall regression (lượt cuối) | 3/3 PASS: 22,9 giây; 21,9 giây; 13,7 giây |
| Live đổi điểm → Admin ghi nhận hoàn → Buyer điểm âm (lượt cuối) | 1/1 PASS, 24,4 giây; tổng cùng Dino Mall 4/4 PASS, 0 skipped, 1,5 phút, exit 0 |
| Lint/typecheck/build hai phía, Prisma validate, API types check | PASS |
| CI | Run 38074500929 PASS tại 83aa931 trước lượt bổ sung. Lượt 38076880019 tại 15b999d lỗi typecheck trong assertion voucher mới; đã sửa assertion kiểm tra cả isValid/discountAmount, chạy lại typecheck/lint local. Theo PR để xem kết quả đúng commit sửa, không suy ra PASS từ run cũ |

Lượt database đầu có 38 PASS, 1 FAIL: giá trị -0 tại ca hoàn một phần. Đã sửa tính delta để trả 0 chuẩn; ca này chạy riêng lại PASS (23 ca khác không được chọn). Sau đó chạy lại cả bộ; không che lần FAIL thành PASS. Lượt browser đầu ca loyalty FAIL do selector tìm riêng “100” thay vì text thật “100 điểm”; sau sửa ca chạy thật PASS. Ba ca Dino Mall trong lượt đầu đều PASS.

Database bao phủ: retry và cạnh tranh đổi điểm, ownership/minimum/one-use voucher, rollback voucher khi ledger lỗi, hoàn nhiều phần/làm tròn lũy kế/vượt hạn mức, retry hoàn đồng thời, điểm âm và giữ VIP/bù nợ, audit lỗi rollback, khóa chống hai sweep, nâng/hạ PREFERRED và bảo vệ MALL/override. Browser không mock page.route/Auth/API và không ghi tier giả vào storage.

## Chạy lại

1. Xác minh Supabase test riêng, áp dụng migrations, tạo fixture mới. Ca loyalty cần Buyer STANDARD có đúng 100 điểm từ một đơn COMPLETED đủ điều kiện 1.000.000đ, chưa thu hồi/đổi; Admin riêng. Đặt E2E_LOYALTY_REFUND_ORDER_ID bằng ID của đơn đó.
2. Nạp env riêng đúng đích. Biến môi trường giống [Dino Mall live](dino-mall-live.md), thêm RUN_LOYALTY_LIVE_E2E=true và E2E_LOYALTY_REFUND_ORDER_ID. Backend phải được khởi động từ chính env test đó.
3. PowerShell tại frontend: `$env:PLAYWRIGHT_CHANNEL='chrome'`; `npx playwright test e2e/loyalty-redemption-connected-live.spec.ts`. Không bật opt-in thì suite skipped, cấu hình sai khi đã opt-in thì preflight fail.
4. Database: tại backend, với RUN_REMOTE_DB_TESTS=true và env test đã xác minh, `npx vitest run tests/db/tiering-loyalty.integration.test.ts tests/db/seller-mall-request.integration.test.ts tests/db/schema-smoke.test.ts`.

Fixture được giữ trong project test, không tự xóa public data hoặc hạ Mall để chạy lại. Test integration chỉ tự dọn schema ngẫu nhiên do chính suite tạo. Scheduler dùng PostgreSQL và không cần Redis; worker Flash Sale local vẫn báo thiếu Redis, không nằm trong bằng chứng này. ChatGPT Web chưa được ghép với workspace nên chưa tham gia review độc lập.
