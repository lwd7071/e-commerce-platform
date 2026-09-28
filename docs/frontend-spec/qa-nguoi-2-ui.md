# UI QA — phạm vi Người 2

> Ngày kiểm tra: 2026-09-28
> Phạm vi: shared shell/navigation, `/profile`, `/notifications`; không thay QA toàn hệ thống.
> Branch baseline: `5ace145`; chạy development với `NEXT_PUBLIC_USE_MOCK=true`.

## Quality gates

| Gate | Môi trường/kết quả | Trạng thái |
|---|---|---|
| `npm ci` | Node 22.20.0, npm 11; cài 415 packages. npm báo 2 moderate vulnerabilities trong dependency tree. | Pass |
| `npm run typecheck` (`tsc --noEmit`) | Chạy bằng Node 22.20.0 | Pass |
| ESLint trên source | `eslint src/` pass trên toàn source; sau thay đổi markup cuối, chạy lại lint trên toàn bộ 6 file TypeScript đã chạm và pass (Node 22.20.0). `npm run lint` không kết thúc trong thời gian hợp lý ở lượt cuối và không được tính làm evidence pass riêng. | Pass bằng CLI tương đương |
| `npm test` | 3 test files, 12 tests: route guards, money adapter, API client | Pass |
| `npm run build` | Next.js 16.3.5 production build, TypeScript, static generation | Pass |

Do sandbox không cho Vitest tạo subprocess (`spawn EPERM`) và build cần tải Geist từ Google Fonts, các lệnh test/build được chạy lại với quyền subprocess/network. Không sửa package/lockfile và không thêm dependency vào project; Playwright chỉ dùng từ npm cache ngoài repository cho browser QA.

## Browser và responsive

Đã chạy smoke trên Chrome và Edge cài trong môi trường, tại 320, 360, 768 và 1280px:

| Kiểm tra | Chrome | Edge |
|---|---|---|
| `/profile` và `/notifications`: không tràn ngang ở 320/360/768/1280px | Pass | Pass |
| Guest vào `/profile` và `/notifications`: chuyển login, giữ `returnTo` tương ứng | Pass | Pass |
| Buyer mock: header text-only `Dino`, auth metadata name/email hiển thị trên profile | Pass | Pass |
| Buyer notifications: demo label, filter unread, mark-one, bulk demo giới hạn 20 | Pass | Pass |
| Seller/Admin: ẩn mục notifications, mở URL trực tiếp nhận unauthorized state | Pass | Pass |
| Keyboard: Tab đầu tiên focus skip link | Pass | Pass |
| `prefers-reduced-motion`: shimmer skeleton có animation duration `0s` | Pass | Pass |
| Browser page errors trong các luồng đã chạy | Không có | Không có |

Source audit đã xác nhận controls/buttons tối thiểu 44px, mobile dock link 54px, form helper/error được nối `aria-describedby`/`aria-invalid`, toast có live region và nút đóng có accessible name. Đây là rà source/component contract, không thay screen-reader QA.

## Defect và handoff ngoài ownership Người 2

1. **Người 3 — trang chủ bị tràn ngang ở 320/360px.** Browser thấy nội dung/header của route `/` rộng hơn viewport; tại 320px document rộng 367px, CTA ở vùng header vượt mép phải. Các route Người 2 vẫn đạt ở cùng viewport. Sửa responsive header/action trên trang chủ thuộc page owner Người 3; Người 2 không sửa chéo page.
2. **Người 1 — brand cũ trên `/login`.** Login vẫn có ô biểu tượng chữ `EC` và copy “E-Commerce Platform”; đổi sang brand contract Dino text-only trong page auth thuộc Người 1. Header shared trên route nghiệp vụ đã là chữ Dino, không logo.

## Còn cần nghiệm thu

- Dialog ESC/backdrop/return-focus hiện mới được rà source; chưa có browser-interaction evidence trên một consumer dialog trong phạm vi Người 2.
- Chưa chạy screen-reader thực tế hoặc đo contrast toàn màn bằng công cụ tự động. Token CTA và focus ring dùng cặp đã chốt trong file 09; Q-802/Q-803 chỉ **đạt trong phạm vi Người 2 với các case đã nêu**, chưa đóng gate toàn hệ thống.
- D-004 vẫn chờ page samples từ Người 3/4/5.

## Kết luận

Quality gates kỹ thuật pass. Shell, profile và notifications đạt các browser smoke được liệt kê. Giữ U-201–206 và Q-802/Q-803 ở trạng thái nghiệm thu theo phạm vi, không tuyên bố hoàn tất D-004 hoặc gate toàn dự án cho tới khi hoàn thiện dialog interaction/contrast và nhận page samples.
