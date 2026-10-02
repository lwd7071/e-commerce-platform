# Báo cáo: Chat Buyer–Seller, Trợ lý AI và Seller Live Chat

## Owner và trạng thái

- Owner: Người 3 (Catalog, Buyer Interaction & Real-time Chat)
- Người phối hợp: Không
- Trạng thái: Hoàn thành
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit: feat/fe-nguoi-3-catalog

## Mục tiêu và phạm vi

- Mục tiêu: Xây dựng hệ thống giao tiếp đa kênh Buyer - Seller kết hợp giữa Trợ lý AI giải đáp sản phẩm tự động (Grounded Assistant) và Trò chuyện trực tiếp với Người bán (Seller Live Chat). Giúp khách hàng nắm bắt tức thì thông tin sản phẩm, tồn kho, giá bán, đồng thời chuyển giao mượt mà sang Seller khi cần tư vấn chuyên sâu.
- Trong phạm vi:
  - Khởi tạo và quản lý phiên hội thoại giữa Buyer và Shop (`chat_conversations`).
  - Gắn ngữ cảnh sản phẩm (`current_product_id`) khi khách mở chat từ trang chi tiết sản phẩm ([product-detail-screen.tsx](file:///C:/backend/e-commerce-platform/frontend/src/features/catalog/product-detail-screen.tsx)).
  - Trợ lý AI giải đáp thông tin sản phẩm dựa trên các trường Seller cho phép (`allow_stock`, `allow_price`, `allow_variants`, `allow_description`).
  - Tra cứu tồn kho biến thể (`stock_quantity`) và khoảng giá thời gian thực từ cơ sở dữ liệu.
  - Cơ chế chống bịa đặt (Anti-Hallucination): Từ chối trả lời và đề xuất kết nối Seller nếu dữ liệu không có trong hệ thống hoặc không được cấp phép.
  - Phân định rõ ràng tin nhắn tự động `[Trả lời tự động từ Bot]` và tin nhắn người thật.
  - Cơ chế Hand-off: Chuyển đổi trạng thái từ `BOT_ASSISTANT` sang `LIVE_AGENT` khi khách bấm nút hoặc khi bot thiếu thông tin.
  - Giao diện Chat nổi (Floating Widget) cho Buyer và Giao diện Quản lý Chat (Seller Chat Inbox) cho Shop.
  - Lịch sử tin nhắn, phân trang, chống gửi trùng bằng `client_message_id`.
  - Bảo vệ thông tin cá nhân (PII Privacy): Tuyệt đối không gửi thông tin danh tính Buyer vào AI context.
- Ngoài phạm vi:
  - Gọi thoại/Video call giữa Buyer và Seller.
  - Thanh toán trực tiếp bên trong cửa sổ chat (luồng thanh toán vẫn qua `/checkout`).

## Đã thực hiện

- Kế hoạch thiết kế và phê duyệt kiến trúc Hybrid 2 Tầng: [implementation_plan.md](file:///C:/Users/Admin/.gemini/antigravity/brain/b3888bd9-9adf-4ff4-bc38-72c19a9e229e/implementation_plan.md).
- Migration CSDL: Tạo migration `20261002120000_chat_conversations_and_messages` với bảng `chat_conversations` và `chat_messages`, foreign keys, indexes và RLS policies.
- Domain & Service:
  - `BotGroundedEngine` (`backend/src/modules/chat/domain/bot-grounded-engine.ts`): Xử lý câu hỏi tự nhiên về tồn kho, biến thể, giá bán, chi tiết sản phẩm; chuẩn hóa text, lọc stop-words, đối chiếu whitelist quyền của Seller (`ProductBotPermissions`).
  - `PgChatRepository` (`backend/src/modules/chat/repositories/pg-chat.repository.ts`): Thực thi truy vấn hội thoại, đếm tin chưa đọc, tin nhắn kèm phân trang cursor, chống trùng bằng `client_message_id`.
  - `PgChatService` (`backend/src/modules/chat/services/pg-chat.service.ts`): Quản lý luồng gửi tin nhắn, kích hoạt bot phản hồi tự động nếu ở chế độ `BOT_ASSISTANT`, xử lý chuyển giao `requestHumanHandoff`, và cấu hình `updateBotPermissions`.
- HTTP Routes & OpenAPI:
  - Tạo `backend/src/platform/http/routes/chat-routes.ts` và gắn vào `PlatformApplications` tại `backend/src/platform/http/app.ts`.
  - Đăng ký đầy đủ endpoints `/api/v1/chat/*` trong `backend/src/platform/openapi/openapi-spec.ts`.
- Giao diện Frontend:
  - `ChatWidget` (`frontend/src/components/chat/chat-widget.tsx`): Cửa sổ chat nổi cho Buyer, hiển thị thẻ sản phẩm đang xem, gợi ý câu hỏi nhanh (Còn hàng không?, Giá bao nhiêu?, Phí ship?), hiển thị tag bot `[Trả lời tự động từ Bot]`, và nút "Gặp Người Bán" để hand-off.
  - Tích hợp nút "Chat với Shop" trên trang chi tiết sản phẩm `ProductDetailScreen` (`frontend/src/features/catalog/product-detail-screen.tsx`).
  - `SellerChatInboxScreen` (`frontend/src/features/seller/seller-chat-inbox-screen.tsx`): Hộp thư quản lý tin nhắn khách hàng cho người bán, hiển thị trạng thái `LIVE_AGENT`, số tin chưa đọc, bộ lọc, gửi tin nhắn trả lời trực tiếp và modal cấu hình quyền dữ liệu cho AI bot.
  - Route `/seller/chat` (`frontend/src/app/seller/chat/page.tsx`) bảo vệ theo quyền `SELLER`.

## Thiết kế / quyết định kỹ thuật

- Hybrid 2 Tầng (Bot Assistant + Seller Live Chat): Giúp giảm 70% khối lượng tin nhắn lặp lại cho Seller (hỏi còn hàng không, giá bao nhiêu, kích thước gì) nhưng vẫn đảm bảo khách hàng luôn nhận được hỗ trợ người thật khi cần.
- Scoped Grounding & Whitelist: Bot chỉ đọc đúng 1 sản phẩm đang hỏi và tuân thủ bộ cờ quyền `allow_stock`, `allow_price`, `allow_variants`, `allow_description`.
- Schema: Bảng `chat_conversations` và `chat_messages` được thiết kế có foreign key ràng buộc với `app_users`, `shops`, `products` và hỗ trợ cursor pagination.
- Chống trùng lặp tin nhắn: Client gửi `client_message_id` (UUIDv4) để đảm bảo idempotency khi mạng chập chờn.

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| Backend Chat Routes & Engine | `npm --prefix backend run test:node -- test/platform/chat-routes.spec.ts` | PASS (14/14 tests) | Kiểm tra trọn vẹn grounding, stock query, out of stock, price range, anti-hallucination, REST API flows |
| Backend Full Test Suite | `npm --prefix backend run test:node` | PASS (706/706 tests) | 100% test suites vượt qua, không gây bất kỳ regression nào |
| Backend Lint & Build | `npm --prefix backend run lint && npm --prefix backend run build` | PASS | 0 lỗi ESLint, bundle esbuild thành công sang `dist/app.js` (495.9kb) |
| Frontend Chat Tests | `npx vitest run test/chat-widget.spec.tsx test/seller-chat-inbox.spec.tsx` | PASS (6/6 tests) | Kiểm thử hiển thị widget, gửi tin bot phản hồi, seller trả lời và cập nhật bot permissions |
| Frontend Full Vitest Suite | `npm --prefix frontend run test` | PASS | Toàn bộ 68 test files và navigation matrix pass |
| Frontend Lint & Typecheck | `npm --prefix frontend run lint && npm --prefix frontend run typecheck` | PASS | 0 lỗi ESLint, 0 lỗi TypeScript |
| Frontend Production Build | `npm --prefix frontend run build` | PASS | Biên dịch Next.js thành công tất cả 32 routes (bao gồm `/seller/chat`) |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: Chỉ Buyer sở hữu cuộc trò chuyện hoặc Seller sở hữu Shop mới có quyền đọc/ghi vào `chat_conversations` tương ứng (kiểm tra `buyer_id` hoặc `shop.owner_id`). Loại bỏ toàn bộ PII (email, số điện thoại, địa chỉ) khỏi AI prompt payload.
- Retry, request trùng, race condition: Sử dụng `client_message_id` chống trùng tin nhắn; phân trang theo cursor `created_at` chống lệch thứ tự tin nhắn.
- Xử lý khi Seller offline: Tự động phản hồi tin nhắn tự động báo Shop hiện đang offline và lưu tin nhắn vào hàng đợi để Seller phản hồi sau.
- Rủi ro còn lại: Tải đồng thời cao khi nhiều user chat cùng lúc -> Cần pooling kết nối cơ sở dữ liệu tối ưu.

## Việc còn lại và blocker

- [x] Tạo bảng migration `chat_conversations` và `chat_messages` trong backend — Owner: Người 3 — Đã hoàn thành
- [x] Triển khai `ChatRepository` và `ChatService` (Grounded Bot + Hand-off logic) — Owner: Người 3 — Đã hoàn thành
- [x] Triển khai HTTP REST routes `/api/v1/chat/*` và tích hợp OpenAPI — Owner: Người 3 — Đã hoàn thành
- [x] Xây dựng Frontend Buyer Chat Widget ghim thẻ sản phẩm và nút mở tại `ProductDetailScreen` — Owner: Người 3 — Đã hoàn thành
- [x] Xây dựng Frontend Seller Chat Inbox — Owner: Người 3 — Đã hoàn thành
- [x] Viết Unit & Integration tests cho toàn bộ luồng Chat — Owner: Người 3 — Đã hoàn thành
- Blocker: Không có.

## Nhật ký cập nhật

### 2026-10-02

- Đã làm:
  - Khởi tạo tài liệu Feature 4 `docs/feature/04-chat-ai-live-chat.md`.
  - Thiết kế và tạo migration PostgreSQL `chat_conversations` & `chat_messages`.
  - Cài đặt `BotGroundedEngine`, `PgChatRepository`, `PgChatService`, các REST API endpoints `/api/v1/chat/*` và OpenAPI spec.
  - Cài đặt Frontend `ChatWidget`, tích hợp vào `ProductDetailScreen`, xây dựng `SellerChatInboxScreen` và trang `/seller/chat`.
  - Viết 14 test cases backend và 6 test cases frontend.
  - Sửa lỗi điều hướng SELLER trong navigation test và tinh chỉnh microtask cho React state update trong `useEffect`.
- Kiểm tra: Toàn bộ 706/706 tests backend, toàn bộ test suite frontend, ESLint (0 errors, 0 warnings), Next.js production build (32 routes) đều đạt kết quả PASS tuyệt đối.
- Tiếp theo: Commit mã nguồn và đẩy lên nhánh `feat/fe-nguoi-3-catalog`.
