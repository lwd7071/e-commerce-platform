# MVP User/Buyer implementation log

> Single implementation journal for this phase. `DONE` requires new-test evidence, the exact command and observed result. For TDD tasks it also requires a recorded red result for the intended missing behavior and a green result after implementation.

## Required reading

Read in the requested order before code changes:

1. `docs/spec/schema-freeze-v1.md`
2. `docs/architecture/rules/auth-rbac-rls.md`
3. `docs/architecture/rules/api-conventions.md`
4. `docs/architecture/rules/business-rules.md`
5. `docs/architecture/rules/db-schema-rules.md`
6. `docs/architecture/rules/order-workflow-transactions.md`
7. `docs/architecture/rules/testing-quality-gates.md`
8. `docs/frontend-spec/04-data-model.md`
9. `docs/frontend-spec/05-api-contract.md`
10. `docs/frontend-spec/06-fe-be-mapping.md`
11. `docs/frontend-spec/07-gap-analysis.md`
12. `backend/src/modules/buyer/contracts/endpoint-contracts.md`

## Baseline (2026-09-29)

| Area | Command | Result |
|---|---|---|
| Backend unit/service tests | `cd backend; npm run test:node` | PASS, 600/600 tests across 70 files, exit 0 (run outside sandbox because Node worker spawning is restricted inside it). |
| Backend DB/catalog integration suite | `cd backend; npm run test:vitest` | Partial baseline: real PostgreSQL constraint/catalog/RLS/checkout/concurrency suites observed passing; full run manually interrupted while a migration/replay suite continued without output. Not counted as a full pass. |
| Backend typecheck | `cd backend; npm run typecheck` | PASS, exit 0 |
| Backend lint | `cd backend; npm run lint` | PASS, exit 0 |
| Backend build | `cd backend; npm run build` | PASS, exit 0 |
| Frontend tests | `cd frontend; npm run test` | PASS, 149/149 tests across 24 files, exit 0 (run outside sandbox because esbuild worker spawning is restricted inside it). |
| Frontend typecheck | `cd frontend; npm run typecheck` | PASS, exit 0 |
| Frontend lint | `cd frontend; npm run lint` | PASS, exit 0 |
| Frontend build | `cd frontend; npm run build` | PASS, exit 0; Next generated 13 static pages. |

Baseline contract-audit gaps (recorded before implementation): onboarding/auth provisioning, profile routes, categories route, enriched cart, order GET stubs, and address item routes. Baseline files `env_vercel` and `frontend/env_vercel` were already untracked and are left untouched.

## Work tracker

> **Độ mới của báo cáo (2026-10-01):** Tracker và các số liệu bên dưới là snapshot lịch sử ngày 2026-09-29, không phải kết quả kiểm tra hiện tại. Repo hiện ở HEAD `fd353e1`; sau snapshot có thêm thay đổi trên nhánh, trong đó commit `3c57d45` điều chỉnh thời hạn voucher dùng trong test Buyer. Chưa chạy lại các gate Buyer trong lần rà soát tài liệu này, nên giữ nguyên trạng thái/evidence lịch sử và không suy diễn rằng code hiện tại đã pass hay đã hoàn tất các mục còn mở. Cần cập nhật các task Buyer sau khi chạy lại acceptance liên quan.

| Task | Trạng thái | Dependency | Thay đổi | Test/Evidence | Blocker |
|---|---|---|---|---|---|
| TASK-00 Baseline + contract | DONE | — | Required docs read in order; baseline and runtime gap/target contract captured here | Backend `test:node` 600/600; frontend `test` 149/149; backend typecheck/lint/build PASS; frontend typecheck/lint/build PASS. Full backend Vitest baseline was interrupted and is not claimed as pass. | — |
| TASK-01 Auth user bootstrap trigger | IN_PROGRESS | TASK-00 | Added additive migration `20260929120000_auth_user_bootstrap`, SECURITY DEFINER trigger, safe backfill, actual initial-schema PostgreSQL fixture; added guarded migration deploy command | Red/green integration evidence remains as above. Deploy: `cd backend; $env:ALLOW_MIGRATION_DEPLOY='true'; npm run db:ci:migrate` — applied successfully; process-only allow flag removed afterward. Verify: `cd backend; npx prisma migrate status` — database schema up to date. Read-only PostgreSQL catalog query confirms trigger exists, SECURITY DEFINER, locked search_path, and no direct anon/authenticated EXECUTE. After the user explicitly authorized testing this project, `cd backend; $env:ALLOW_SUPABASE_AUTH_SMOKE='true'; npm run test:auth-smoke` — PASS; creates one random confirmed Auth user through Supabase Admin API, verifies trigger-created BUYER/ACTIVE `app_users`, password sign-in and runtime ACTIVE/LOCKED authorization, then deletes both test records. The smoke script now requires explicit process-only opt-in and matching `EXPECTED_SUPABASE_PROJECT_REF`; migration test flags remain false in `.env`. | Signup OTP and Google provider smoke are separate and remain blocked on provider configuration/test inbox; this smoke uses confirmed admin-created user, not the OTP signup UI |
| TASK-02 Onboarding API | IN_PROGRESS | TASK-01 | Transactional Buyer/Seller onboarding, retry conflict 409, unique owner protection, active-shop route guard and sensitive endpoint rate limits | Red: onboarding integration initially failed to import missing `PgOnboardingService`. Green: `cd backend; npm run test:vitest -- --reporter=dot tests/db/onboarding.integration.test.ts` — 8 real PostgreSQL tests pass, including Buyer/Seller pending shop, API route, matching retry, conflicting role/shop, validation and concurrent retry. Rate-limit boundary covered by `cd backend; npm run test:node` (599 pass). | External provider signup smoke pending |
| TASK-03 Supabase Google/OTP/email setup | IN_PROGRESS | TASK-01 | Supabase Auth current settings: Google/email enabled, signup enabled, email autoconfirm off. | Latest read-only Auth settings check and OAuth authorize request: `/auth/v1/authorize?provider=google` returned HTTP 302 to `accounts.google.com`; initiation is verified, but Google account consent/callback/onboarding has not been completed in browser. Email OTP and recovery delivery/verification are not yet verified with a real test inbox. | Complete Google sign-in/callback with an interactive Google account; run OTP signup/resend and recovery using a test inbox. Confirm email templates, redirect allowlist, minimum password, and SMTP delivery before marking this task DONE. Gmail SMTP remains demo-only; use a transactional provider before production. |
| TASK-04 Frontend auth foundation | IN_PROGRESS | TASK-02, TASK-03 | Added Supabase signup OTP, Google OAuth redirect, callback code exchange, backend `/auth/me` role lookup, onboarding call, password recovery/update, sessionStorage signup draft; removed metadata role trust and clears local session on `USER_LOCKED` | Frontend typecheck/build pass; auth flow tests/provider smoke remain. Client is browser Supabase SDK (no `@supabase/ssr` cookie client yet). | SSR cookie session hardening, focused auth tests and provider config remain |
| TASK-05 Auth screens and flows | IN_PROGRESS | TASK-04 | Added Google buttons, name/shop signup, 8-character minimum, OTP verification/resend countdown, forgot/reset, OAuth callback and `/complete-profile`; missing draft routes to profile completion | `cd frontend; npm run test` — 176/176; typecheck, lint and build pass. No focused auth component tests or provider E2E yet. | Supabase provider/template configuration and auth E2E |
| TASK-06 Profile API + UI | IN_PROGRESS | TASK-02 | Added GET/PATCH `/profile`, JWT-scoped repo, strict field rejection, profile UI load/save; avatar disabled; PATCH rate limit and boundary test | Real PostgreSQL profile API test in onboarding suite; frontend profile contract in 176/176; typecheck/lint/build pass | Focused profile UI test and deployment rate-limit strategy review |
| TASK-07 Order reads | IN_PROGRESS | TASK-00 (parallel with auth) | PostgreSQL `OrderQueryService`, batched DTO/ownership/status filters, one query repository/pool runtime composition; router no longer reads command `orderRepo`; frontend DTO mapping/reload after mutations | Red: missing `listOrders/getOrderDetail`. Green: order runtime integration is included in consolidated PostgreSQL run (5 tests), including authenticated `createRuntimeApp()`; order DTO adapter in 176/176 | Full checkout-to-order smoke remains |
| TASK-08 Public categories | IN_PROGRESS | TASK-00 (parallel with auth) | Active public category route/repository, detailed OpenAPI schema and live frontend cache adapter | Real PostgreSQL category route included in consolidated suite (6 suites, 28 tests); FE adapter in 176/176 | Verify deployed category data |
| TASK-09 Enriched cart | IN_PROGRESS | TASK-00 (parallel with auth) | PostgreSQL join read model and availability UI; live API errors do not fall back to fixtures | Red: real PostgreSQL DTO lacked product/shop fields. Green: consolidated PostgreSQL run 28/28; FE decimal/unavailable/error tests in 176/176 | Full checkout COD smoke remains |
| TASK-10 Address CRUD | IN_PROGRESS | TASK-00 (parallel with auth) | Owner-scoped routes, transaction+row locking for default changes, checkout snapshots, profile address manager with create/edit/default/delete | Red: mid-update failure lost prior default; create-default hit partial unique index. Green: address integration 6/6 real PostgreSQL tests, including route CRUD/ownership/concurrency/rollback/default/snapshot; FE address API tests in 176/176 | Full checkout address snapshot E2E remains |
| TASK-11 Contract/security alignment | IN_PROGRESS | TASK-04..10 | Updated FE/BE mapping/gap docs, JWKS/issuer/audience/expiry/key rotation and Seller ACTIVE guard; detailed OpenAPI category/cart/order/profile/address DTOs; API local port 3001/site 3000 | Route/OpenAPI unit tests in backend Node suite; both typecheck/lint/build pass | Provider auth and final live contract review remain |
| TASK-12 Acceptance + docs | IN_PROGRESS | All | Updated journal/API contract/FE mapping/gap analysis; added auth/onboarding/profile/category/cart/order/address coverage; applied bootstrap migration to configured Supabase | Backend `test:node` 599/599; frontend `test` 176/176; consolidated real PostgreSQL integration run 7 files/36 tests PASS, using random isolated schemas that self-clean; `ALLOW_SUPABASE_AUTH_SMOKE=true npm run test:auth-smoke` PASS on the user's authorized current project, including trigger bootstrap, password login, ACTIVE/LOCKED runtime check and user cleanup. Migration static checks 5 pass/3 remote-state tests skipped. Bootstrap migration applied and remote trigger security properties verified. Migration-safety unit tests 4/4; backend typecheck/lint pass after adding guarded deploy script. User-provided Dashboard screenshot identifies the project as `main / PRODUCTION`; `.env` now labels it `production`; migration and remote-test flags remain false. | Google/SMTP settings and OTP/Google/recovery/COD end-to-end remain unverified; provider configuration and real test inboxes still needed |

## Locked contract decisions

- Email/password plus Google OAuth; email signup confirmation uses six-digit OTP, password recovery uses a reset link.
- First-time account role is always BUYER at auth bootstrap. Seller onboarding creates one PENDING shop; Seller business endpoints require that shop to be ACTIVE.
- Onboarding retry with matching role/shop data returns current state; conflicting role/shop data returns 409.
- `shops.owner_id` uniqueness is enforced in PostgreSQL and treated as the race-condition backstop.
- PostgreSQL integration tests use a real isolated test database; no database mocks for TASK-01/02/07/09/10.
- COD is in scope; online payment providers and avatar upload are outside this Buyer completion slice. Review text/rating, notifications, and review-media persistence are implemented; real Supabase Storage/browser acceptance remains open.
- Frontend 3000, backend 3001. Secrets remain in provider settings/secret stores, never Git.
- User may delete an address because orders store address snapshots; checkout reads and snapshots the chosen address in its transaction.

## Current implementation evidence and remaining acceptance

- Latest PostgreSQL integrations use real isolated schemas. No task is marked `DONE` except baseline TASK-00 because the plan requires provider smoke tests, controlled migration acceptance, focused auth tests and full COD flow before closure.
- Backend address `setDefault` failure was observed before the transaction fix and then verified to roll back. TASK-07/09/01 red evidence was recorded against missing read methods/DTO fields/migration respectively; TASK-02 red evidence was missing service implementation.
- Google Cloud CLI is authenticated for project `e-commerce-740639`, but the browser Google Console session is signed out. No OAuth client key was created because Console sign-in cannot be automated here and persistent-key creation requires immediate confirmation. Use callback `https://putywqmxtjttfdezlswf.supabase.co/auth/v1/callback`; add `http://localhost:3000` as origin. Supabase provider/templates/redirect allowlist and Gmail SMTP remain external setup. Never paste Client Secret or Gmail's 16-character app password into this repo or chat.
- Gmail SMTP is suitable for demo only (roughly 500 messages/day); use a transactional mail provider and review Supabase custom SMTP rate limits before production. Set Supabase minimum password to 8 to match frontend validation.
- TASK-04 does not yet use `@supabase/ssr`; its browser client persists PKCE session in browser storage. Revisit cookie-backed SSR before production deployment.

## Acceptance update (2026-10-02)

This update supersedes only the latest-evidence claims above; older baseline counts remain historical. Admin work in the shared checkout is outside this Buyer journal.

| Gate | Command / observed result | Status |
|---|---|---|
| Review media implementation | Focused backend, frontend, and isolated PostgreSQL evidence is recorded in the final-slice update below. Browser tests mock the HTTP/Storage boundary; no live Storage object upload was run. | Implemented; live Storage/browser acceptance open |
| Frontend suite | `frontend: npm test -- --reporter=dot` — **56 files / 293 tests pass** | PASS on 2026-10-01 |
| Frontend static/build gates | `npm run typecheck`, `npm run lint`, `npm run build` in `frontend` — exit 0; build generated 26 pages | PASS on 2026-10-01 |
| Backend unit/route suite | `backend: npm run test:node` — **650 pass / 1 fail** (651 total). Failure: `test/modules/order/admin-order-reason.spec.ts` expected a missing reason rejection but concurrent Admin order code did not reject | NOT PASS; failure is in Admin scope and was left untouched |
| Backend static/build gates | `npm run typecheck`, `npm run lint`, `npm run build` in `backend` — exit 0 | PASS on 2026-10-01 |
| Buyer/Seller PostgreSQL acceptance | On the user-confirmed in-progress Supabase project, isolated-schema runs: 8 files / 27 tests pass (`onboarding`, `address`, `cart-read`, `category`, Seller shop/voucher/report, order query); Shop-logo/media suites 2 files / 19 pass; Seller variant add/remove/history run 1 file with 2 selected tests pass. Fixture test schemas are absent. The variant run temporarily used its fixed-ID rows in `public`; read-only post-check confirms app/auth users, shops, categories, products, variants, images and buyer orders for every fixture ID are all **0**. | PASS for selected suites; fixture cleanup verified |
| Remaining DB/provider/browser gates | Selected checkout runtime/PostgreSQL suites passed in isolated schemas (36 tests). Google/SMTP provider smoke and live browser flows were not run. No migration/reset/seed was run. | OPEN |

### Remaining Buyer acceptance

- Google OAuth provider is enabled and its authorize endpoint successfully redirects to Google; full account consent/callback/onboarding still needs an interactive browser sign-in. OTP signup/resend and password recovery still need a controlled test inbox and delivered-code/link evidence.
- Checkout/order lifecycle and ownership/concurrency need a confirmed isolated PostgreSQL test project plus live browser flow.
- Review photo implementation and database persistence are verified; the full live browser/Storage flow is still open:
  - Backend presign supports purpose `review_image` / `REVIEW` with UUID `review_id` validation and signed URL generation (`test/platform/buyer-review-media.spec.ts` — 5/5 pass).
  - Backend review creation attaches finalized media in a transaction and validates owner, status, and review path. Mocked backend behavior tests pass; isolated PostgreSQL transaction tests verify rollback/commit and the persisted URL.
  - Frontend `ReviewScreen` unlocks `ReviewMediaUpload` in live mode and submits `image_media_ids` with `review_id`. Focused review/auth suite results are recorded below; the Storage HTTP requests are mocked in browser component tests.
- Guest public/private access boundaries, full Buyer browser journey, and live runtime deployment checks remain open.

## Continuation update (2026-10-02)

- Latest selected DB acceptance on the user-authorized in-progress Supabase project: 13 files / 84 tests passed (8 isolated-schema files / 27 tests; Shop-logo/media 2 files / 19 tests; catalog variant add/remove/history 2 selected tests; checkout runtime + PostgreSQL 2 files / 36 tests). The checkout suites completed successfully using their isolated-schema harness.
- Post-run cleanup: removed 14 exact-match `p5_checkout_<32 hex>` schemas and one exact-match `p4_checkout_e2e_<32 hex>` schema after verifying their full table sets matched the checkout test fixture. Final read-only checks show no matching test schemas and all fixed catalog test fixture IDs have zero rows across Auth/app users, shops, categories, products, variants, and Buyer orders. The transient fixed-ID catalog fixtures in `public` were absent at final verification.
- No migration, reset, seed, OTP/Google/recovery provider smoke, or full live browser journey was run in this acceptance pass. Review media backend and persistence are implemented; real Storage/provider acceptance remains open.
- Scope note: no Admin source or Admin progress document was edited by this Buyer/Seller pass. Shared-workspace Admin changes remain untouched.

- Backend Node unit/route suite rerun on the current workspace: `backend: npm run test:node` — **657/657 pass**. The previous 650/651 result was superseded; the Admin order-reason failure now passes in the current concurrent workspace state.
- Database suites used UUID-isolated schemas where available. One stale onboarding fixture schema found during verification contained only `app_users`, `shops`, and `user_profiles`; it was removed and rechecked. After the user confirmed the in-progress Supabase environment was empty and authorized cleanup, the two Seller variant tests ran against their fixed-ID `public` fixtures; a read-only post-check verified all related fixture-row counts are zero. Checkout runtime and PostgreSQL integration were subsequently run in isolated schemas (36 tests pass); matching leftover checkout schemas were verified and removed.
- Frontend rerun on the newer shared workspace: **294 tests passed**, with one Admin suite failing collection because `test/admin-campaigns-screen.spec.tsx` imports missing `src/features/admin/admin-campaigns-screen`. Two Admin/Seller UI tests that initially timed out under parallel build load passed when run focused (**4/4**). Frontend build/typecheck pass; lint excluding Admin exits 0 (two warnings in the Admin campaigns test). Full lint currently fails on `react-hooks/set-state-in-effect` in the concurrent `admin-vouchers-screen.tsx`; Admin remains out of scope and was not changed here.

## Continuation update (2026-09-29)

- Consolidated environment configuration into one root `.env`/`.env.example`: removed duplicate `backend/.env.example` and `frontend/.env.example`, removed the temporary `frontend/.env.local`, and updated docs. Backend server/Prisma/Vitest/deployment scripts load root `.env`; Next.js reads the same file and only inlines explicit public `NEXT_PUBLIC_*` values. Actual root credentials were preserved; Supabase URL/anon fallbacks were removed from frontend source.
- Added missing optional runtime settings to root `.env` and `.env.example` (`SUPABASE_JWT_AUDIENCE`, DB pool/timeouts, `TRUST_PROXY`) and a dashboard-only checklist for Google callback/redirects, SMTP fields, and secret placement. Provider secrets intentionally are not env keys because Supabase stores them in Auth settings.
- Added root migration-safety keys: `DATABASE_ENVIRONMENT=test`, blank `EXPECTED_SUPABASE_PROJECT_REF`, and `ALLOW_MIGRATION_DEPLOY=false` (also kept storage/seed deploy flags false). User must confirm the target project ref from Supabase Dashboard before any migration deployment.
- `cd backend; npx prisma migrate status` first reported only `20260929120000_auth_user_bootstrap` pending. After target verification, the guarded `npm run db:ci:migrate` applied it with a process-only allow flag; `.env` keeps `ALLOW_MIGRATION_DEPLOY=false`. Follow-up status says schema up to date, and a read-only catalog query verified trigger security settings. Supabase Auth provider/email settings are still unchanged.
- The user's later Dashboard screenshot shows the configured project on `main` with a `PRODUCTION` badge. The local `.env` had incorrectly been labeled `DATABASE_ENVIRONMENT=test` when the migration ran. It is now set to `production`; `ALLOW_MIGRATION_DEPLOY=false` and `RUN_REMOTE_DB_TESTS=false`. The bootstrap migration is already present on this project and was not rolled back. User subsequently explicitly authorized direct tests here because the database has no user data. The real-PostgreSQL suites only create and drop isolated random schemas; one narrowly scoped Auth smoke created a random user and removed it, verifying cleanup. Do not infer that broad destructive migrations/seeds are authorized from this test permission.

## Continuation update (2026-09-29)

- Fixed the frontend runtime error where Supabase URL/key were blank in the client bundle despite being present in root `.env`. Next loads frontend env first and `@next/env` caches that first directory; the subsequent root env load in `next.config.ts` previously reused the empty cache. It now forces a reload of the shared root env.
- Regression test `frontend/test/next-root-env.spec.ts`: red before fix (`url:false`, `key:false` after Next config load), green after fix (Supabase URL/key present and API URL `http://localhost:3001/api/v1`). Command: `cd frontend; npm run test -- --reporter=dot test/next-root-env.spec.ts` — 1/1 PASS.
- Restarted the stale process on port 3000, which was serving an old client config with blank Supabase values and API URL `http://localhost:3000/api/v1`, then launched `npm run dev` from `frontend/`. The `/login` route returns HTTP 200 and renders the login form; latest dev-server output has no missing-env warning. Frontend typecheck passes. Targeted ESLint command stalled without output and was interrupted; lint is not claimed.
- Investigated the user's Google OAuth callback screenshot. The configured API URL was correctly `http://localhost:3001/api/v1`, but no backend process was listening there. Confirmed the user's Google Auth account had been created and the database trigger had made an active BUYER `app_users` row; `user_profiles` was still absent because callback onboarding could not reach `/auth/me`. Started the backend on port 3001; health check returned HTTP 200 and PostgreSQL healthy. Callback now relies on Supabase `detectSessionInUrl` for hash/PKCE processing (avoids exchanging a one-time code twice) and surfaces async errors even during React Strict Mode effect replay. Before fix, local callback with no session stayed on spinner; after fix it displays the actionable session error. Frontend typecheck passes. User must reload the original callback now that both services are running; full Google onboarding is pending that final browser step.

## Continuation update (2026-09-29)

- Diagnosed the unexpected order history screenshot: `frontend/src/lib/config/features.ts` forced `ordersMock()` to return true with `envConfig.useMock || true`, so the orders page always selected `mockOrderRepository` and rendered fixture shops/items regardless of root `.env`. Removed the forced mock override; live mode now selects the API repository when `NEXT_PUBLIC_USE_MOCK=false`.
- Added `frontend/test/feature-mock-flags.spec.ts` to prove live mode disables the order mock and explicit mock mode keeps it. Made `frontend/test/orders.spec.ts` explicitly opt into mock mode because its lifecycle assertions intentionally exercise fixtures.
- Evidence: `cd frontend; npm run test -- --reporter=dot test/feature-mock-flags.spec.ts test/orders.spec.ts` — 2 files, 6 tests PASS. `cd frontend; npm run typecheck` — PASS. The first sandboxed test attempt hit Windows `spawn EPERM`; rerunning the same focused test command with the approved external process permission passed.
- These orders were frontend demo fixtures; they were not evidence of orders created for the new Supabase account. With live mode configured, the order page now reads the backend and should be empty until the buyer places an order.

## Continuation update (2026-09-29)

- Added `backend/scripts/seed-demo-accounts.ts`, guarded by an explicit one-run environment flag and exact project-ref checks. It refuses collisions before writing, creates confirmed Auth users, completes Buyer/Seller profiles through the onboarding service, creates Seller shops as `PENDING`, grants `ADMIN` only to the requested seed admin through the trusted database connection, verifies final role/profile/shop counts, and cleans up its newly created rows if seeding fails.
- Executed against Supabase project `putywqmxtjttfdezlswf` after the user requested the demo dataset. Result: 26 accounts created and verified (20 SELLER, 5 BUYER, 1 ADMIN), all with profiles, 20 seller shops in PENDING state. Seed emails use `seller01`–`seller20`, `buyer01`–`buyer05`, and `admin` at `dino-demo.test`. At the user's request, the shared password and account list are now saved in the Git-ignored local file `docs/demo-seed-accounts.local.md`; it is not tracked or pushed.
- Evidence: `cd backend; npm run typecheck` — PASS. The seed's post-write query returned 26 rows, 26 profiles, exactly 20 shops, and the expected 20/5/1 role split. No orders or products were created.
- Follow-up demo catalog: added `backend/scripts/seed-demo-products.ts` and `db:seed:demo-products`. It creates 12 active products per seeded shop, two active variants and one Unsplash image per product, across 11 active categories. Exact project guarded; deterministic IDs make repeat execution safe. Evidence: backend typecheck PASS; focused ESLint PASS; seed execution returned 240 products, 480 variants, 240 images, 11 categories, and all 20 shops still PENDING.
- Automatic approval review rejected the separate request embedded in the first seed draft to set the 20 PENDING shops to ACTIVE, because this also grants Seller permissions. The successful seed preserves PENDING shop status. Products are stored as ACTIVE but remain hidden from the public catalog until Admin approves each shop; no shop status was changed.

## Continuation update (2026-10-02) — Buyer MVP completion slices (Slices 1 to 5)

### Final-slice verification — 2026-10-02

- Fixed `PostgresReviewRepository` to use a checked-out `PoolClient` for the full review/media transaction; verify Buyer ownership, `FINALIZED` state, and exact review path prefix; rollback on failure and release the client. Runtime wiring now passes the configured `SUPABASE_URL`; review image URLs no longer use a generic hard-coded host.
- Added `tests/db/review-media-transaction.integration.test.ts`. Against the authorized Supabase project it created and dropped a random isolated schema. Both real PostgreSQL checks passed: mismatched review path rolled back the review and kept media `FINALIZED`; valid media committed the review, `ATTACHED` state, `review_images`, and a URL under the configured project host. Read-only cleanup verification found **0** remaining `review_media_<uuid>` schemas.
- Verification: backend review platform tests **17/17 pass**; isolated PostgreSQL tests **2/2 pass**; frontend review/auth tests **18/18 pass**; frontend typecheck pass; targeted Buyer backend/frontend lint pass; `git diff --check` pass.
- Full backend typecheck is currently blocked by existing errors in concurrent Admin files (`admin-routes.ts` and `admin-user-shop-query.spec.ts`); no Admin files were changed. The true live Seller fulfillment → Buyer review browser flow and an actual Supabase Storage upload remain unverified.

- **Slice 1 — Review Media Presign (TDD)**:
  - Presign endpoint `POST /api/v1/media/uploads/presign` hỗ trợ purpose `review_image` / `REVIEW`.
  - Canonical storage path: `users/:userId/reviews/:reviewId/:mediaId.:ext`. Bắt buộc gửi `review_id` chuẩn UUID.
  - Evidence: `cd backend; npx tsx --test test/platform/buyer-review-media.spec.ts` — 5/5 PASS.
- **Slice 2 — Atomic Review Creation with Media (TDD + DB)**:
  - Cập nhật DTO `validateCreateReviewDTO` hỗ trợ `review_id` và `image_media_ids` (tối đa 3 ảnh theo P-607c).
  - ReviewService và PostgresReviewRepository kiểm tra media thuộc buyer, status `FINALIZED`, cập nhật `ATTACHED` và insert vào `review_images` trong cùng transaction.
  - Evidence: `cd backend; npx tsx --test test/platform/buyer-review-creation.spec.ts` — 6/6 PASS; real transaction rollback/commit acceptance is in `tests/db/review-media-transaction.integration.test.ts` — 2/2 PASS.
- **Slice 3 — Review UI & Media Integration (/ui-ux-pro-max + TDD)**:
  - Mở khóa upload ảnh và toggle review ẩn danh trên Live mode (`features.useMock() === false`).
  - Mở rộng touch target cho nút xóa ảnh $\ge 44 \times 44\text{pt}$ (WCAG AAA) qua pseudo-element `before:-inset-2.5`.
  - Evidence: review component/screen tests pass within the focused 18/18 Buyer review/auth run.
- **Slice 4 — Auth OTP & Password Recovery UI (TDD & UI/UX Pro Max)**:
  - Tests cover VerifyEmailPage six-digit validation and resend countdown, ForgotPasswordPage neutral response, and ResetPasswordPage minimum/matching password checks.
  - Evidence: `cd frontend; npx vitest run test/auth-otp-and-recovery.spec.tsx` — 8/8 PASS.
- **Slice 5 — Buyer Review Route Flow Integration**:
  - Route-flow test covers review eligibility guard, review-media presign ID linkage, duplicate-review guard (RB-LB09), and public catalog response using in-memory repositories. It does not execute Seller fulfillment or a live end-to-end journey.
  - Sửa `GET /api/v1/products/:product_id/reviews` để ánh xạ snake_case (`review_id`, `order_item_id`, `product_id`, `buyer_id`, `created_at`, `updated_at`) đồng bộ conventions.
  - Evidence: `cd backend; npx tsx --test test/platform/buyer-seller-lifecycle-review.spec.ts` — 6/6 PASS.

### Latest acceptance update — 2026-10-02

This entry supersedes earlier statements in this journal that the real review-media Storage upload had not been exercised. It does not close OTP/Google provider smoke or the full live browser lifecycle.

- Buyer/Seller frontend behavior selection: **25 files / 144 tests passed**. This is a scoped run, not the entire frontend suite.
- Seller/checkout real-PostgreSQL acceptance: **8 files / 50 tests passed** on the user-authorized Supabase project, using isolated test schemas. Covered Shop, voucher, reporting, Product image update, Shop logo/media, order query and checkout. Read-only post-run verification found no schemas matching the selected test prefixes.
- Live review-media smoke: `cd backend; npm run test:review-media-smoke` — PASS against the configured Supabase project. It created a temporary Auth Buyer, requested a review-image presign from the API, uploaded a PNG to Supabase Storage, finalized through the API, verified `FINALIZED`, and removed the object, upload row, Buyer row and Auth user in cleanup. The smoke verifies media upload/finalization, not review submission or the full browser journey.
- Added guarded runner `backend/scripts/review-media-live-smoke.ts`; it requires a process-only opt-in and exact expected Supabase project reference. ESLint passed for the runner and touched Buyer runtime files. Backend full typecheck still reports errors in concurrent Admin files; no Admin source was changed for this work.
- Still open: OTP signup and password-recovery delivery/verification with a controlled test inbox; completing Google OAuth consent/callback/onboarding interactively; full live browser flow spanning Shop approval, Product/media, Buyer checkout, Seller fulfillment, Buyer confirmation and reporting.
- Google authorize status was rechecked on 2026-10-02: Supabase reports Google and Email enabled, signup enabled, autoconfirm disabled; a real authorize request returned 302 to `accounts.google.com`. This is initiation evidence only; the full consent callback has not been completed.
- Added `frontend/e2e/guest-access-live.spec.ts`, intentionally independent of the destructive shared E2E reset fixture. `$env:E2E_BASE_URL='http://localhost:3000'; npx playwright test e2e/guest-access-live.spec.ts` — **1/1 PASS**: public catalog route renders for a guest and `/cart` redirects to login. The check used `localhost`; the initial `127.0.0.1` probe was invalid because Next dev blocked cross-origin HMR and left client auth unhydrated.
- Scope remains Buyer/Seller only. The shared Supabase project was left without the isolated test schemas or temporary review-media/Auth records created by these runs. No broad migration, reset or seed was run in this acceptance pass.

