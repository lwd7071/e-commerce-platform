# Tiến độ FE — Người 2 (UI/UX, Shared UI và Account)

## Trạng thái hiện tại

- Phase/ticket: Phase 0 D-001–003/P0-03; Phase 2 U-201–206/B-104; Phase 6 Profile request states/P-602/P-604–605/P-607b (UI mock/gated); Q-802/Q-803 scoped QA
- Cập nhật lần cuối: 2026-09-30
- Trạng thái: P0-05/06 có seed/reset fixture ảnh Storage thật, safety guard, reset địa chỉ/cart về baseline; Playwright có seeded Buyer login smoke tự reset trước mỗi test, suite chạy tuần tự. B-101 có lifecycle migration, RLS, cleanup runner và scheduled workflow. B-104, Profile states, ErrorSummary interaction test và Notifications fake boundary đã implement. Notification API còn chờ generated OpenAPI/runtime. D-004 viewport QA còn mở.
- Nhánh/PR: Các commit từ `codex/node-24-runtime`, `codex/frontend-ci-workspace` và `codex/member2-pr-a/b/c` đã merge vào `dev`; FE polish mới nhất được đẩy trực tiếp lên `origin/dev` (xem commit trên nhánh). Không có PR riêng.
- Chưa xác minh live: Không có cấu hình test project/allowlist trong môi trường hiện tại nên reset dừng ở safety guard trước mọi thao tác DB; chưa apply migration hoặc chạy Storage smoke/cleanup trên Supabase. Scheduled workflow cần secrets/vars đúng target production trước khi được bật. Notification wire DTO/runtime chờ generated OpenAPI types và Người 4. D-004 viewport QA còn mở.
- Việc tiếp theo: Cấu hình Supabase test + allowlist để chạy reset, migration và Storage smoke; cấu hình secrets/vars cleanup workflow; chạy Playwright smoke với frontend/backend test host; nối NotificationRepository sau OpenAPI/runtime handoff; hoàn tất D-004 viewport/browser QA.

## Nhật ký theo ngày

### 2026-09-30 — E2E fixtures, media lifecycle, ErrorSummary, upload, Profile và Notifications

- **P0-05/06:** `backend/scripts/reset-e2e-fixtures.ts` cùng `db:e2e:reset` tạo lại 4 tài khoản Dino, shop pending/active, category/product + stock 1, address, cart, voucher, notification unread, order/status history cho 7 trạng thái, Shipment khi cần và review baseline. Ảnh fixture là PNG thật upload qua Supabase Storage API theo path đúng policy, có `product_images` public URL và registry `ATTACHED`. Guard bắt buộc non-production, `DATABASE_ENVIRONMENT=test`, `ALLOW_E2E_SEED=true`, project ref + DB host khớp allowlist.
- **P0-06 hook:** `frontend/e2e/fixtures.ts` tự chạy reset script trước từng test; `playwright.config.ts` giới hạn worker là 1 để fixture chung không bị race. Có seeded Buyer login smoke làm tracer test. `test:e2e -- --list` nhận diện đúng test; chạy test thật xác nhận hook được gọi và safety guard dừng trước DB vì local `DATABASE_ENVIRONMENT` chưa phải `test`.
- **B-101:** Lifecycle registry migration; presign registration kiểm tra purpose/bucket/path, active-shop ownership và TTL tối đa 10 phút; finalize chỉ chấp nhận media ≤5 MB có magic bytes JPEG/PNG/WebP; attach chỉ từ `FINALIZED`, đúng owner/purpose/product-or-review path, với status predicate để serialize cùng cleanup. Cleanup claim dùng `FOR UPDATE SKIP LOCKED`, chỉ xử lý finalized quá 24h/chưa attach, gọi Storage API và retry trạng thái lỗi. GitHub Actions daily/manual có allowlist/secret guard. Cần apply migration, cấu hình production secrets/vars và chạy Storage smoke trên test project.
- **P0-03:** Bổ sung jsdom, React Testing Library và user-event. Interaction test xác nhận submit nhiều lỗi chuyển focus vào ErrorSummary, link trỏ đúng field, inline errors và `aria-describedby`/`aria-invalid` vẫn có; submit hợp lệ không render summary và giữ focus ở nút submit. Test focus đã được kiểm chứng đỏ khi tạm bỏ focus effect, rồi xanh sau khi khôi phục. DOM interaction pass 2/2; SSR contract pass 10/10.
- **B-104:** Purpose cap Product 5/Review 3/Avatar 1, JPEG/PNG/WebP ≤5 MB, preview URL lifecycle/revoke, demo badge và production gate trước legacy uploader. Review/product consumers khai báo purpose.
- **Profile:** state loading/signed_out/missing/error/ready, missing chỉ cho `404 RESOURCE_NOT_FOUND`, giữ code/request ID, retry, signed-out CTA `returnTo`, và avatar gate; thêm classifier tests.
- **Notifications C-303–305:** Screen nhận repository injectable; demo provider chỉ chạy non-production. Production gate không gọi repository hay render dữ liệu demo. Có loading/error/retry, filter/empty state, mark-one optimistic rollback, bulk tối đa 20 unread đang hiển thị, concurrency tối đa 4, giữ item thành công và rollback riêng item lỗi/chưa được gửi khi gặp 429. Test focused notification 14/14 pass. API repository dùng generated Notification DTO và runtime service vẫn là handoff riêng; chưa có generated types hoặc NotificationService wiring trong app runtime nên production tiếp tục gated.
- **Kiểm chứng:** frontend typecheck pass; full Vitest **41 files / 239 tests pass**; lint không có error (còn 2 warning ở Admin repository/Profile effect). Playwright list thấy 1 seeded Buyer smoke; chạy thật vào hook nhưng safety guard từ chối trước kết nối/ghi DB. Backend typecheck/lint pass; 41 focused tests về fixture reset, seed/migration/policy guard và media lifecycle/cleanup pass. PNG seed bytes xác thực được metadata 1×1 PNG. Chưa chạy PostgreSQL/Storage integration hoặc browser login do thiếu target test được allowlist.
- **D-004:** Route `/admin` hiện có; review viewport thực tế chưa làm trong lượt này. Không ghi nhận viewport/accessibility pass khi chưa có evidence; tiếp tục là phần QA còn lại.

### 2026-09-30 — Task 4 B-104 và Task 5 Profile states

- **B-104:** `FileUploadZone` áp dụng giới hạn Product 5, Review 3, Avatar 1; `maxFiles` từ caller chỉ có thể giảm giới hạn theo purpose. Chặn cả batch vượt số ảnh còn lại và file sai MIME/kích thước; chỉ nhận JPEG/PNG/WebP tối đa 5 MB, loại GIF. Seller Product và Review khai báo purpose tường minh.
- Preview dùng object URL tách khỏi danh sách URL đã upload. URL được revoke khi thay ảnh, bỏ preview hoặc unmount. Khi media lifecycle chưa tích hợp, production báo chưa khả dụng và không gọi API upload cũ; development hiển thị nhãn demo và chỉ giữ preview local, không lưu ảnh mẫu/Unsplash vào form.
- **Profile:** request state phân biệt loading, signed_out, missing, error và ready. Chỉ `404 RESOURCE_NOT_FOUND` thành missing; lỗi API khác giữ mã lỗi/request ID khi có và có nút retry. Chưa có session thì không gọi profile API và CTA đăng nhập quay lại `/profile`. Email/vai trò read-only; chỉ full name và phone được gửi khi lưu. Lỗi lưu giữ nguyên nội dung người dùng nhập; avatar tiếp tục bị khóa.
- Thêm/cập nhật policy và state tests trong `frontend/test/`; P0-03 interaction và SSR contracts hiện pass theo nhật ký ngày 2026-09-30 phía trên.
- Còn chờ: Người 3 bàn giao media repository/lifecycle để nối upload thật và ảnh seed; các công việc này không thay đổi backend task 1–2.

### 2026-09-29 — FE polish: semantic tokens, touch targets, typed handlers

- Đồng bộ các state màu ở form, notice, navigation, skeleton, order/status, toast, cart/catalog/seller screens sang CSS semantic tokens trong `frontend/`; thêm `--success-border` để success badge/toast giữ viền phân biệt trên nền success.
- Giữ phản hồi hover của danger button bằng token danger-border; filter tabs và nút tăng/giảm số lượng đạt vùng chạm tối thiểu 44×44px theo [UI/UX rules §4](../09-ui-ux-rules.md).
- Bổ sung type assertions cho Buyer-only route guard vào test hợp đồng. Route metadata `/orders` và `/notifications` hiện đã được sửa ở commit upstream `552e2a6`.
- Thay `any` bằng literal union/generic update trong hai màn prototype `ecommerce-web/`; phần này là type-only cleanup, không thay đổi contract hay runtime của ứng dụng `frontend/`.
- Kiểm tra lượt này: chưa chạy lại frontend quality gates; cần chạy `typecheck`, `lint`, `test` và `build` trước khi đóng QA FE.

### 2026-09-29 — D-004 visual review (đã rà các page hiện có)

- Đã review `frontend/` trên browser với mock session/data tại 360px và 1280px cho homepage, checkout và Seller orders. Kiểm tra `document.documentElement.scrollWidth` không vượt viewport ở cả ba trang tại hai kích thước; các nút chính và Seller actions được đo tối thiểu 44px.
- Homepage: hierarchy hero → benefits → catalog rõ và co về một cột trên mobile. Handoff Người 3: bỏ emoji trang trí `✨` ở hero để theo UI rule dùng icon SVG/wordmark chữ Dino; đây là phần page owner xử lý.
- Checkout: desktop có nhịp section và thứ tự nội dung dễ theo dõi; mobile không tràn ngang. Handoff Người 4: hàng tiêu đề địa chỉ bị chật ở 360px, hai nút “Đổi địa chỉ”/“Thêm mới” xuống nhiều dòng; chuyển actions thành hàng riêng hoặc xếp dọc để giữ scanability.
- Seller orders: desktop table/mobile cards đều hiển thị được; filter tabs cuộn ngang trên mobile, touch target 44px. Không thấy lỗi tràn ngang ở 360/1280px.
- Admin dashboard chưa có route/page trong `frontend/src/app/`, nên chưa thể review phần này. D-004 hoàn tất một phần, chờ đúng page sample Admin; không sửa chéo page owners.
- Môi trường QA: local Next dev server, `NEXT_PUBLIC_USE_MOCK=true`, mock Buyer/Seller; đây là visual/DOM review, không xác nhận API production hay PostgreSQL.

### 2026-09-29 — Tích hợp các nhánh runtime, CI và shared UI vào dev

- Đã làm: Các thay đổi trên `codex/node-24-runtime`, `codex/frontend-ci-workspace` và chuỗi `codex/member2-pr-a/b/c` đã được merge vào `dev` cục bộ. PR C chứa các helper navigation/notification, hardening shared UI và test contract; Node 24 và quality gate frontend cũng đã có trên `dev`.
- Test/kiểm tra: Route guard test ban đầu bắt mismatch role ở `/orders`; sau khi đồng bộ `/orders`, `/orders/[id]/review` và `/notifications` sang Buyer-only, toàn bộ frontend pass typecheck, lint, 74/74 tests và production build trên Node `24.15.0`/npm `11.12.1`. PostgreSQL smoke vẫn chưa chạy do thiếu DB test/`DIRECT_URL`.
- Đối chiếu UI rules: màu trạng thái trong seller/order screens dùng semantic tokens; filter tabs đáp ứng touch target 44px. Các cặp semantic text/surface được kiểm tra đạt WCAG AA.
- Handoff: Chờ Người 1/backend owner xác nhận review runtime/CI; handoff contrast login/register và seller status vẫn cần owner xử lý/xác nhận.
- Blocker: PR GitHub chưa được tạo theo nhật ký trước đó do GitHub CLI credential invalid; local PostgreSQL smoke chưa có DB test/`DIRECT_URL`.
- Còn lại: D-004 và các ticket đang gated theo backend/page readiness như phần trạng thái hiện tại.

### 2026-09-29 — PR C implementation sau test contract

- Commit test-only `9a58181` được tạo trước helper/implementation; lúc đó suite đỏ do module navigation helper chưa tồn tại. Sau đó tách helper và nối lại consumer; full suite chuyển xanh.
- Ma trận nav tách thành pure helper dùng chung desktop/mobile; notification filter/count/mark-one/bulk tách thành pure state helper và giữ max 20 visible unread, không mutate input.
- SSR unit test riêng xác nhận `ProtectedPage` buyer-only không render notification content cho Seller và có CTA an toàn, còn Buyer render được. Đây không thay thế browser direct-URL smoke; browser automation chưa chạy được trong môi trường này.
- Route helper `ROUTE_RULES` đang thiếu role cho `/notifications`, dù route UI truyền `allowedRoles=["BUYER"]`; handoff Người 1 cần bổ sung/đồng bộ auth route metadata hoặc xác nhận helper không còn là source dùng. Không sửa chéo owner.
- Frontend Node `24.15.0`/npm `11.12.1`: typecheck pass; Vitest 15 files / 74 tests pass; build pass; lint pass.

### 2026-09-29 — PR C navigation/notifications helpers (provisional)

- Viết contract tests trước implementation: test đỏ ban đầu do chưa có helper; sau khi tách role navigation items và notification view-state helper, tests xanh.
- Ma trận Guest/Buyer/Seller/Admin, notification filter/unread count, mark-one, bulk tối đa 20 và tính bất biến input được kiểm tra riêng. Direct-role UI test xác nhận seller mở content buyer-only nhận unauthorized state/CTA, Buyer được render content.
- `NotificationsPageContent` vẫn giữ `ProtectedPage allowedRoles={["BUYER"]}`; production tiếp tục hiển thị gated state, không gọi API 501. Không thêm test/helper API notification chưa có contract.
- Frontend trên Node `24.15.0`/npm `11.12.1`: typecheck pass; Vitest 15 files / 74 tests pass; production build pass; lint pass.
- Browser trực tiếp không được chạy lại trên nhánh hiện tại: CUA không khởi tạo được và `playwright` không có trong npm cache. Browser QA ngày 2026-09-28 ở mục [QA evidence](#qa-evidence) đã ghi Chrome/Edge direct URL cho Seller/Admin nhận unauthorized state; `ProtectedPage` và route wrapper không đổi ở PR C. Route helper `ROUTE_RULES` vẫn thiếu `allowedRoles: ["BUYER"]` cho `/notifications`; đây là auth contract thuộc Người 1, đã để nguyên và cần handoff/owner xác nhận.
- Metadata `/profile` và `/notifications` hiện khai báo base title; root template `%s | Dino` đã tạo kết quả chuẩn. Không cần metadata diff cho hai route Người 2; metadata bất nhất ở page người khác để đúng owner xử lý, không sửa chéo.

### 2026-09-29 — PR B shared component hardening (provisional)

- Test đỏ trước sửa xác nhận các EmptyState/ErrorState trên cùng page dùng lại `empty-title`/`error-title`; sau đó mỗi instance dùng `useId()` và test unique accessible heading target đã xanh.
- Toast timer có manager nhỏ để hủy timer khi đóng từng toast và khi `ToastProvider` unmount; test manager xác nhận cancel/dispose và callback expiry. SSR test xác nhận polite live-region container còn hiện diện; chưa có browser interaction test tự động cho hành vi toast provider end-to-end.
- Giữ nguyên public props của shared components. Không sửa Dialog vì repro browser hiện có cho ESC/backdrop/return-focus đã pass; Dialog vẫn chưa có automated interaction test.
- Frontend trên Node `24.15.0`/npm `11.12.1`: typecheck pass; Vitest 14 files / 67 tests pass; production build pass; lint pass sạch sau khi xử lý hook dependency.
- Evidence provisional trên nhánh phụ thuộc PR0a; phải rebase/chạy lại gate sau PR0a. Thông báo owner shared components/review chéo vẫn cần trước khi merge vào nhánh nhóm.

### 2026-09-29 — PR A token/contrast và SSR contract (provisional)

- Thêm token mới `--success-text` và `--warning-text`, giữ nguyên giá trị mọi token palette gốc; dùng lại `--danger-text` đã có. Thêm test tính WCAG AA ≥4.5:1 cho semantic text/surface và chữ trắng trên CTA.
- Thêm SSR characterization cho Button (variant/disabled/loading), FormField (label/help/error ARIA), EmptyState, ErrorState và StatusBadge; không thêm navigation/notification helper test ở PR A.
- Frontend Node `24.15.0`/npm `11.12.1`: typecheck, lint, build pass; Vitest 12 files / 63 tests pass.
- Evidence provisional trên nhánh dựa vào PR0a chưa merge; sau khi PR0a được duyệt/gộp phải rebase và chạy lại tất cả gate. `Toast`/`Dialog` interaction chưa có automated interaction test; Dialog mới có browser repro/evidence trong nhật ký QA.

### 2026-09-28 — PR0a Node 24 runtime migration (đang chuẩn bị, chưa merge)

- Đã đồng bộ từ `origin/dev` mới nhất và làm trong worktree riêng; không mang theo hoặc sửa thay đổi local tại `ecommerce-web/`.
- Đã cập nhật `.nvmrc`, engines của backend/frontend thành `>=24 <25`, giữ npm `11.x` và `packageManager: npm@11.12.1`; `@types/node` lên major 24. Hai lockfile chỉ đổi engine, `@types/node`/`undici-types` và bundled optional metadata do npm 11 ghi nhận cho Tailwind WASM.
- Backend và frontend `npm ci` pass trên Node `24.15.0`/npm `11.12.1`, không có `EBADENGINE`; audit lần này: backend 6 advisory (2 moderate, 4 high), frontend 2 moderate. Không chạy audit fix.
- Backend trên Node 24: Prisma Client generate và schema validate pass (dùng URL PostgreSQL giả chỉ để nạp Prisma config); typecheck, lint, build pass. Test pass ngoài sandbox: native 598/598 và Vitest 96/96; 119 DB/remote integration cases skip do chưa có DB config. Trong sandbox native suite gặp một `spawn EPERM`; chạy lại được ngoài sandbox. Cần PostgreSQL service quality CI xanh trước merge làm DB/client smoke evidence.
- Frontend trên Node 24: typecheck pass (cần quyền ghi `tsconfig.tsbuildinfo` trong worktree); 54/54 unit tests, production build và lint pass.
- CI PR0a chuyển backend/remote DB/auth/storage jobs sang Node `24.15.0` và thêm runtime assertion; job `frontend-quality` còn Node22 có chủ đích vì vẫn kiểm tra prototype `ecommerce-web/`, sẽ được thay riêng ở PR0b.
- Chưa có deploy/hosting evidence hay review của Người 1/backend owner; không merge PR0a cho tới khi đủ review và PostgreSQL service CI xanh. Node22 evidence bên dưới là lịch sử runtime tiền nhiệm, không phải gate hiện hành.

### 2026-09-28 — PR0b frontend CI cutover (đang chuẩn bị)

- Trên nhánh riêng xếp sau PR0a, `frontend-quality` đổi working directory/cache sang `frontend/`, xác nhận Node `24.15.0`/npm `11.12.1`, chạy `npm ci`, lockfile-clean, lint, typecheck, test và build.
- Các gate local frontend trên Node24 đều pass; PR0b không sửa manifest/lockfile và không chạy quality gate cho `ecommerce-web/`. Chỉ merge sau PR0a và CI thật xanh.

### 2026-09-28 — U-203, Q-802, Q-803 (QA sau merge catalog)

- Đã làm:
  - Sửa định vị `.dialog` trong `frontend/src/app/globals.css`: khai báo `position: fixed`, `inset: 0`, `margin: auto` để modal không còn bị Tailwind reset dồn về góc trên trái.
  - Chạy browser smoke bằng Chrome 153 với mock session, không thêm file QA hay dependency.
- Quyết định UI/contract: Giữ native `<dialog>`; dùng cơ chế modal/focus containment/ESC của trình duyệt và lớp CSS chung, không thêm thư viện dialog.
- Test/kiểm tra:
  - `npm run typecheck`, `npm run lint`, `npm test` (4 files/15 tests), `npm run build`: PASS trên Node 24.15.0/npm 11.12.1. Đây là evidence mới của workspace FE; migration toàn repo và các gate sau đồng bộ `origin/dev` vẫn đang thực hiện.
  - Chrome mock browser: Dialog nằm giữa viewport; focus vào dialog khi mở; Tab giữ focus bên trong; Escape đóng và trả focus về nút mở; click backdrop đóng và trả focus. Không có JS exception trong smoke.
  - Chrome responsive smoke: `/` không tràn ngang tại 320/360/768/1280px; `/profile` và `/notifications` không tràn tại 360px. Reduced motion bật làm animation skeleton gần như tắt (`0.00001s`).
  - Contrast audit: `#E11D48` trên `#FFF1F2` đạt 4.28:1 (dưới 4.5:1) trong auth error copy; `#059669` trên `#ECFDF5` đạt 3.58:1 và `#D97706` trên `#FFFBEB` đạt 3.07:1 cho status text seller. Đây là page của Người 1/3, không sửa chéo ownership.
- Handoff: Người 1 — dùng foreground đỏ đậm hơn cho nội dung lỗi login/register; Người 3 — dùng màu text trạng thái success/warning đậm hơn trên status surface. Trang chủ trước đây ghi nhận overflow 320/360px, hiện smoke ở bốn viewport đều không còn overflow sau merge catalog.
- Blocker: D-004 chưa thể review đủ checkout, seller orders và admin dashboard vì các route/page mẫu này chưa có trong `frontend/src/app/`.
- Còn lại: Chờ đúng owner xử lý các contrast handoff; tiếp tục D-004 khi đủ page mẫu; không đóng Q-802/Q-803 toàn hệ thống.

### 2026-09-28 — D-001–003, U-201–206, P-602/P-604–605/P-607b, Q-802/Q-803

- Đã làm: Hoàn thiện tokens/global style, Button/IconButton, field controls/error summary, Dialog, ToastProvider, StatusBadge đủ 7 trạng thái, skeleton/empty/error, header/mobile dock, layout, role navigation, profile read-only và notification UI trong `frontend/src/`. Header/metadata/profile fallback dùng Dino text-only. FormField tự nối helper/error ARIA; notifications chỉ Buyer; profile chỉ dùng auth name/email và initials, không render avatar URL.
- Quyết định UI/contract: Giữ nguyên palette đã cung cấp; CTA chữ trắng dùng `#BF3A6F` đạt contrast, không glow. Profile metadata chỉ read-only; avatar bị khóa vì thiếu media contract. Notifications demo/local-state chỉ trong non-production; production báo runtime API chưa sẵn sàng (501), không gọi endpoint thật hoặc realtime. Bulk action giới hạn tối đa 20 ID và hiện chỉ cập nhật demo state; production không hiển thị.
- Test/kiểm tra lịch sử (2026-09-28, runtime tiền nhiệm Node 22.20.0/npm 11): trên nền `5ace145`, `npm ci` pass (415 packages; audit báo 2 moderate vulnerabilities); typecheck pass; ESLint source và 6 file TS đã sửa pass bằng CLI tương đương; Vitest 3 files/12 tests pass; production build pass. Đây không phải evidence cho runtime Node 24. Browser smoke và defect evidence ghi ở mục [QA evidence](#qa-evidence). CUA không khởi tạo được nên dùng Chrome/Edge headless cài sẵn và Playwright cache ngoài repo; không sửa package/lockfile.
- Handoff: Người 1 — login/register cần đổi brand copy/wordmark sang Dino text-only; Người 3 — trang chủ có horizontal overflow ở 320/360px và brand/copy cần đổi Dino; Người 3/4/5 — dùng tokens, shared components và route handoff ở [file 10](../10-ui-ux-handoff.md). Chưa được xác nhận nhận.
- Blocker: BE — notifications/profile APIs và media contract; Người 3/4/5 — page samples cho D-004. Không còn blocker scaffold/auth wiring.
- Còn lại: Contrast screen-wide và dialog interaction cần browser QA evidence; notification API/rollback và avatar upload chỉ làm khi dependency backend sẵn.

### QA evidence

Quality gates lịch sử ngày 2026-09-28 dùng runtime tiền nhiệm Node `22.20.0`/npm 11: `npm ci` pass (415 packages); typecheck pass; ESLint source pass bằng CLI tương đương (lượt cuối `npm run lint` không kết thúc trong thời gian hợp lý, không tính riêng); Vitest 3 files/12 tests pass; Next production build pass. `npm ci` audit ghi nhận 2 moderate vulnerabilities. Đây không phải gate Node 24; evidence mới theo Node 24 được ghi riêng ở các mục PR0a/PR A/B/C phía trên.

| Kiểm tra | Chrome | Edge |
|---|---|---|
| `/profile` và `/notifications` không tràn ngang ở 320/360/768/1280px | Pass | Pass |
| Guest redirect từ hai route giữ `returnTo` | Pass | Pass |
| Buyer: header chữ Dino, auth name/email trên profile; notifications demo, filter, mark-one, bulk tối đa 20 | Pass | Pass |
| Seller/Admin: ẩn menu notifications và URL trực tiếp hiện unauthorized | Pass | Pass |
| Tab đầu focus skip link; reduced-motion tắt shimmer; không có page errors trong luồng đã chạy | Pass | Pass |

Source audit: controls/buttons cao tối thiểu 44px, dock links 54px, form help/error nối `aria-describedby`/`aria-invalid`, toast có live region và close button có accessible name.

Defect/handoff ngoài ownership Người 2 (không sửa chéo):

1. Người 3 — contrast status success/warning trong seller product screen lần lượt 3.58:1 và 3.07:1 trên surface; dùng semantic foreground đậm hơn. Overflow trang chủ đã không tái hiện ở QA sau merge: 320/360/768/1280px đều không tràn.
2. Người 1 — `/login` và `/register` dùng danger text trên danger surface đạt 4.28:1; đổi sang foreground đỏ đậm hơn. Handoff cũ về copy/logo login Dino text-only vẫn cần owner xác nhận đã xử lý.

Đã có browser-interaction evidence cho dialog ESC/backdrop/return-focus. Chưa chạy screen reader; contrast đã tính cho các cặp token/usage nêu trên, chưa audit toàn bộ mọi route. D-004 chờ page samples Người 4/5. Q-802/Q-803 đạt trong phạm vi shared shell/profile/notifications, không đóng gate toàn dự án.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| UI/UX rules + screen inventory | Người 1, 3, 4, 5 | Token, 14-route inventory, readiness/responsive/keyboard states | Đã viết; chờ consumer review | [Rules](../09-ui-ux-rules.md), [handoff](../10-ui-ux-handoff.md) |
| Shared UI + shell | Người 1, 3, 4, 5 | button/forms/dialog/toast/status/data states/navigation; source trong `frontend/src/components` | Typecheck/lint/test/build pass; browser QA theo Q-802/Q-803 ở trên | [Workspace](../../../frontend/README.md) |
| Profile/notifications UI | Người 1 | Read-only auth metadata, buyer-only notifications, demo gated; không gọi API thiếu | UI/role guard đã implement; API integration blocked | [Handoff 10](../10-ui-ux-handoff.md) |

## Việc được giao

- [x] D-001–003 — screen inventory, UI rules và route/owner UX handoff; D-004 còn chờ page samples.
- [ ] D-004 — visual review trang chủ, checkout, seller order, admin dashboard tại 360/1280px.
- [x] U-201–206 — source implementation, quality gates và browser QA trong phạm vi shared UI đã có evidence; xem nhật ký ngày 2026-09-28.
- [x] P-602 — read-only auth metadata (email/full name), phone/avatar không giả dữ liệu; profile mutations vẫn chờ GAP-07.
- [ ] P-604/P-605 — demo UI có nhãn và gated; API integration/bulk behavior chờ runtime/GAP-10.
- [ ] P-607b — upload UI được giải thích và khóa; chờ media contract P-606.
- [x] Q-802 — đạt trong phạm vi shared shell/profile/notifications, gồm dialog keyboard/focus; contrast defect của page owner khác đã handoff; không đóng gate toàn dự án.
- [x] Q-803 — đạt trong phạm vi shared shell/profile/notifications; browser smoke 320/360/768/1280 và homepage sau merge; không đóng gate toàn dự án.
