# Báo cáo: Dòng tiền sàn & ví người bán (Escrow & Seller Wallet)

## Owner và trạng thái

- Owner: Tri Nguyen (Thành viên 5)
- Người phối hợp: Đội Core Platform (Order & Checkout integration), lwd7071 (Dev CI/Merge)
- Trạng thái: Hoàn thành
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit: Nhánh `thanh-vien-5` (đồng bộ từ `dev` commit `e2896bc`)

## Mục tiêu và phạm vi

- Mục tiêu: Xây dựng hệ thống bảo chứng thanh toán (Escrow) minh bạch, bảo vệ tài chính cho Buyer và Shop; tự động thu phí hoa hồng nền tảng (Commission 5%), quản lý số dư Ví người bán (Shop Wallet), xử lý phê duyệt rút tiền (Withdrawal Payouts) của Admin, và tích hợp cổng thanh toán VietQR PayOS kèm cơ chế tự động thử lại (Retry) và đối soát (Reconciliation) ngăn chặn thất thoát hoặc kẹt tiền.
- Trong phạm vi:
  - Bản ghi Escrow giữ 100% tiền đơn hàng khi thanh toán (`gross_amount`), tính toán trước phí sàn 5% (`commission_fee`) và tiền thực nhận 95% (`net_amount`).
  - Tự động quyết toán (`settleEscrow`) sang `shop_wallets` khi đơn hàng chuyển `COMPLETED` (Buyer xác nhận nhận hàng hoặc hoàn tất giao hàng).
  - Tự động hoàn tiền (`refundEscrow`) sang `REFUNDED` khi đơn hàng bị hủy (`CANCELLED`).
  - Cơ chế phòng ngừa lỗi dòng tiền: Thử lại tự động (`retryEscrowOperation` tối đa 3 lần với exponential backoff) và hàm/API đối soát định kỳ (`reconcilePendingEscrows`) xử lý lệch trạng thái giữa `orders` và `escrow_records`.
  - Quản lý Ví Shop: Quản lý số dư khả dụng (`balance`), số dư phong tỏa rút tiền (`hold_balance`), cập nhật thông tin ngân hàng thụ hưởng (chặn rút nếu thiếu bank info, giới hạn rút tối thiểu 50.000 VNĐ).
  - Phê duyệt / Từ chối rút tiền của Admin: Duyệt lệnh -> trừ `hold_balance` và hoàn tất chi trả; Từ chối -> hoàn trả lại vào `balance`, ghi nhận đầy đủ sổ cái `wallet_transactions`.
  - Cổng thanh toán VietQR PayOS: Tạo link thanh toán QR động, xác thực webhook HMAC-SHA256, chế độ mock linh hoạt trong môi trường test/dev.
  - Giao diện:
    - `/seller/wallet`: Màn hình Ví người bán (xem số dư, cập nhật STK ngân hàng, tạo lệnh rút tiền, xem lịch sử biến động số dư).
    - `/admin/finance`: Bảng điều khiển tài chính Admin (5 chỉ số KPI dòng tiền toàn sàn, danh sách duyệt rút tiền và trigger đối soát).
    - `OrderCard` / `PendingConfirmationCard`: Nút thanh toán VietQR và dialog quét mã thanh toán PayOS.
- Ngoài phạm vi:
  - Tích hợp cổng thanh toán thẻ quốc tế trực tiếp (Stripe/PayPal), chỉ hỗ trợ PayOS VietQR và Mock chuyển khoản.
  - Tự động ủy nhiệm chi ngân hàng qua Open Banking API (Admin duyệt chi trả thủ công trên cơ sở thông tin STK của shop).

## Đã thực hiện

- Schema migration tạo 4 bảng tài chính: `shop_wallets`, `escrow_records`, `wallet_transactions`, `withdrawal_requests` — Bằng chứng: [`backend/prisma/migrations/20261002150000_escrow_and_seller_wallet/migration.sql`](../../backend/prisma/migrations/20261002150000_escrow_and_seller_wallet/migration.sql).
- Domain & Repository quản lý ví và escrow:
  - Định nghĩa hợp đồng và interface: [`backend/src/modules/wallet/domain/wallet.types.ts`](../../backend/src/modules/wallet/domain/wallet.types.ts), [`backend/src/modules/wallet/domain/wallet-errors.ts`](../../backend/src/modules/wallet/domain/wallet-errors.ts).
  - Repository PostgreSQL với transaction nguyên tử và khóa bi quan (`FOR UPDATE`): [`backend/src/modules/wallet/repositories/pg-wallet.repository.ts`](../../backend/src/modules/wallet/repositories/pg-wallet.repository.ts).
- Các service nghiệp vụ tài chính:
  - `EscrowService`: Quản lý giữ tiền, quyết toán, hoàn tiền và đối soát — Bằng chứng: [`backend/src/modules/wallet/services/escrow.service.ts`](../../backend/src/modules/wallet/services/escrow.service.ts).
  - `ShopWalletService`: Quản lý số dư, cập nhật ngân hàng, yêu cầu rút tiền — Bằng chứng: [`backend/src/modules/wallet/services/shop-wallet.service.ts`](../../backend/src/modules/wallet/services/shop-wallet.service.ts).
  - `AdminFinanceService`: Báo cáo tài chính, duyệt/từ chối rút tiền, đối soát lệch trạng thái — Bằng chứng: [`backend/src/modules/wallet/services/admin-finance.service.ts`](../../backend/src/modules/wallet/services/admin-finance.service.ts).
  - `PayosService`: Tạo link thanh toán VietQR động, tạo chữ ký và kiểm tra webhook chữ ký bảo mật HMAC-SHA256 — Bằng chứng: [`backend/src/modules/wallet/services/payos.service.ts`](../../backend/src/modules/wallet/services/payos.service.ts).
- API routes & Hooks kết nối:
  - Tuyến API Ví người bán: [`backend/src/platform/http/routes/seller-wallet-routes.ts`](../../backend/src/platform/http/routes/seller-wallet-routes.ts).
  - Tuyến API Tài chính Admin: [`backend/src/platform/http/routes/admin-finance-routes.ts`](../../backend/src/platform/http/routes/admin-finance-routes.ts) (bổ sung `POST /admin/finance/escrow/reconcile`).
  - Tuyến API PayOS VietQR: [`backend/src/platform/http/routes/payos-payment-routes.ts`](../../backend/src/platform/http/routes/payos-payment-routes.ts).
  - Đấu nối hooks tại `createRuntimeApp` với cơ chế retry 3 lần và loại bỏ secret hardcode: [`backend/src/platform/http/app.ts`](../../backend/src/platform/http/app.ts).
- Giao diện người dùng & API Client:
  - Giao diện ví người bán: [`frontend/src/features/seller/seller-wallet-screen.tsx`](../../frontend/src/features/seller/seller-wallet-screen.tsx).
  - Giao diện quản trị tài chính: [`frontend/src/features/admin/admin-finance-screen.tsx`](../../frontend/src/features/admin/admin-finance-screen.tsx).
  - Tích hợp thanh toán PayOS VietQR: [`frontend/src/components/orders/pending-confirmation-card.tsx`](../../frontend/src/components/orders/pending-confirmation-card.tsx).
  - Client API tích hợp: [`frontend/src/lib/api/wallet.api.ts`](../../frontend/src/lib/api/wallet.api.ts).

## Thiết kế / quyết định kỹ thuật

- Tính toán tài chính bằng số nguyên Cents (Fixed decimals): Trong repository, tiền tệ được chuyển đổi sang Cents (`BigInt`) để tính toán cộng/trừ và so sánh, loại bỏ hoàn toàn sai số dấu phẩy động (floating point precision leak).
- Khóa bi quan (`SELECT ... FOR UPDATE`): Mọi thao tác biến động số dư ví hoặc chuyển trạng thái Escrow đều bọc trong PostgreSQL Transaction và khóa hàng tương ứng, triệt tiêu race condition khi có 2 request đồng thời.
- Cơ chế phong tỏa 2 bước khi rút tiền (Hold & Clear):
  1. Khi người bán gửi lệnh rút tiền hợp lệ (>= 50.000 VNĐ và đã có bank info): Hệ thống chuyển ngay `balance -= amount` và `hold_balance += amount`. Người bán không thể rút lặp số dư này.
  2. Khi Admin duyệt: `hold_balance -= amount`, ghi nhận transaction `WITHDRAWAL_SUCCESS`.
  3. Khi Admin từ chối: `hold_balance -= amount` và hoàn về `balance += amount`, ghi nhận transaction `WITHDRAWAL_REJECTED`.
- Cơ chế tự chữa lành (Self-healing & Reconciliation):
  1. Hook `confirmReceived`, `transitionOrder`, `cancelOrder` bọc trong `retryEscrowOperation` thử lại tối đa 3 lần với exponential backoff khi gặp lỗi mạng/lock tạm thời.
  2. Bổ sung hàm `reconcilePendingEscrows()` và API `POST /api/v1/admin/finance/escrow/reconcile` để quét và tự động bù trừ các đơn hàng `COMPLETED`/`CANCELLED` có escrow bị kẹt ở `HOLDING`.
- Cấu hình PayOS an toàn:
  - Loại bỏ hoàn toàn fallback credentials hardcode trong mã nguồn.
  - Sử dụng biến môi trường `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` và tài liệu hóa trong `.env.example`.
  - Khi không cấu hình key, `PayosService` tự động chuyển sang chế độ Mock VietQR an toàn, không làm gián đoạn luồng test local/CI.

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| Backend Wallet, Escrow & PayOS unit/integration spec | `npx --prefix backend tsx --test backend/test/modules/wallet/wallet-and-escrow.spec.ts` | PASS | 17/17 test, 6 test suites đạt 100%; bao gồm cả 3 test mới cho Escrow Reconciliation & Failure Recovery |
| Toàn bộ Backend Node Test Suite | `npm --prefix backend run test:node` | PASS | 756/756 test, 208 suites, 0 fail, 0 skipped |
| Backend TypeScript Typecheck | `npm --prefix backend run typecheck` | PASS | 0 lỗi kiểu dữ liệu |
| Backend ESLint | `npm --prefix backend run lint` | PASS | 0 cảnh báo, 0 lỗi |
| Frontend Wallet & Finance Vitest | `npm --prefix frontend test -- test/seller-wallet-screen.spec.tsx test/admin-finance-screen.spec.tsx test/payos-vietqr.spec.tsx` | PASS | 3/3 test files, 9/9 tests PASS |
| Toàn bộ Frontend Vitest Suite | `npm --prefix frontend test` | PASS | 74/74 test files, 351/351 tests PASS, 0 fail |
| Frontend TypeScript Typecheck | `npm --prefix frontend run typecheck` | PASS | 0 lỗi kiểu dữ liệu |
| Frontend ESLint | `npm --prefix frontend run lint` | PASS | 0 lỗi cú pháp |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm:
  - Route `/seller/wallet/*` yêu cầu quyền `SELLER`, chỉ truy vấn ví của shop thuộc sở hữu người dùng đăng nhập.
  - Route `/admin/finance/*` yêu cầu quyền `ADMIN`.
  - Không lưu trữ hay log thông tin nhạy cảm của cổng thanh toán. Chữ ký PayOS sử dụng HMAC-SHA256 với `checksumKey` bí mật phía backend.
- Chống race condition & Idempotency:
  - Đảm bảo mỗi đơn hàng chỉ tạo 1 bản ghi escrow nhờ ràng buộc duy nhất `uq_escrow_records__order_id`.
  - Quyết toán kép (Double settlement) bị chặn hoàn toàn ở tầng cơ sở dữ liệu (`WHERE order_id = $1 AND status = 'HOLDING' FOR UPDATE`), ném lỗi `EscrowAlreadySettledError`.
- Hủy đơn, hoàn tiền, rollback:
  - Mọi thao tác cộng/trừ số dư và thay đổi trạng thái escrow đều nằm trong transaction ACID, rollback tức thời nếu xảy ra lỗi.
  - Khi đơn hàng bị hủy (`CANCELLED`), escrow được đánh dấu `REFUNDED`, không kết chuyển tiền vào ví người bán.
- Cơ chế đối soát (Reconciliation):
  - Cho phép Admin gọi API đối soát để giải phóng hoặc hoàn tiền tất cả các escrow bị treo do sự cố gián đoạn trước đó mà không gây trùng lặp giao dịch.

## Việc còn lại và blocker

- [x] Loại bỏ secret PayOS mặc định trong mã nguồn — Owner: Tri Nguyen.
- [x] Bổ sung cơ chế retry và đối soát (reconciliation) khi settle hoặc refund lỗi — Owner: Tri Nguyen.
- [x] Viết bổ sung bộ kiểm thử tự động cho đối soát tài chính — Owner: Tri Nguyen.
- [x] Chạy lại toàn bộ test suite ví/finance sau khi merge và ghi nhận kết quả — Owner: Tri Nguyen.
- [x] Lập báo cáo hoàn chỉnh cho tính năng Escrow & Seller Wallet — Owner: Tri Nguyen.
- Blocker: Không có.

## Nhật ký cập nhật

### 2026-10-02

- Đã làm:
  - Xóa bỏ fallback credentials hardcode của PayOS trong `backend/src/platform/http/app.ts`; cập nhật biến môi trường mẫu trong `.env.example`.
  - Bổ sung cơ chế retry 3 lần cho hook settle/refund đơn hàng tại `orderServices`.
  - Triển khai phương thức đối soát `reconcilePendingEscrows()` trong `PgWalletRepository`, `EscrowService`, `AdminFinanceService` và bổ sung route `POST /admin/finance/escrow/reconcile`.
  - Mở rộng test suite `wallet-and-escrow.spec.ts` với suite `5. Escrow Reconciliation & Failure Recovery` (3 test cases mới), nâng tổng số test lên 17/17 PASS.
  - Khởi tạo báo cáo tài liệu đầy đủ `01-escrow-seller-wallet.md` theo chuẩn cấu trúc đồ án.
- Kiểm tra:
  - Backend spec: 17/17 test pass; Full backend node tests: 756/756 test pass.
  - Backend & Frontend typecheck + lint: Đều pass 0 lỗi.
  - Frontend wallet tests: 9/9 test pass; Full frontend vitest: 351/351 test pass.
- Trạng thái: Sẵn sàng nghiệm thu và tích hợp vào sản phẩm.
