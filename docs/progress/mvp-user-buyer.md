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

| Task | Trạng thái | Dependency | Thay đổi | Test/Evidence | Blocker |
|---|---|---|---|---|---|
| TASK-00 Baseline + contract | DONE | — | Required docs read in order; baseline and runtime gap/target contract captured here | Backend `test:node` 600/600; frontend `test` 149/149; backend typecheck/lint/build PASS; frontend typecheck/lint/build PASS. Full backend Vitest baseline was interrupted and is not claimed as pass. | — |
| TASK-01 Auth user bootstrap trigger | IN_PROGRESS | TASK-00 | Added additive migration `20260929120000_auth_user_bootstrap`, SECURITY DEFINER trigger, safe backfill, actual initial-schema PostgreSQL fixture; added guarded migration deploy command | Red/green integration evidence remains as above. Deploy: `cd backend; $env:ALLOW_MIGRATION_DEPLOY='true'; npm run db:ci:migrate` — applied successfully; process-only allow flag removed afterward. Verify: `cd backend; npx prisma migrate status` — database schema up to date. Read-only PostgreSQL catalog query confirms trigger exists, SECURITY DEFINER, locked search_path, and no direct anon/authenticated EXECUTE. After the user explicitly authorized testing this project, `cd backend; $env:ALLOW_SUPABASE_AUTH_SMOKE='true'; npm run test:auth-smoke` — PASS; creates one random confirmed Auth user through Supabase Admin API, verifies trigger-created BUYER/ACTIVE `app_users`, password sign-in and runtime ACTIVE/LOCKED authorization, then deletes both test records. The smoke script now requires explicit process-only opt-in and matching `EXPECTED_SUPABASE_PROJECT_REF`; migration test flags remain false in `.env`. | Signup OTP and Google provider smoke are separate and remain blocked on provider configuration/test inbox; this smoke uses confirmed admin-created user, not the OTP signup UI |
| TASK-02 Onboarding API | IN_PROGRESS | TASK-01 | Transactional Buyer/Seller onboarding, retry conflict 409, unique owner protection, active-shop route guard and sensitive endpoint rate limits | Red: onboarding integration initially failed to import missing `PgOnboardingService`. Green: `cd backend; npm run test:vitest -- --reporter=dot tests/db/onboarding.integration.test.ts` — 8 real PostgreSQL tests pass, including Buyer/Seller pending shop, API route, matching retry, conflicting role/shop, validation and concurrent retry. Rate-limit boundary covered by `cd backend; npm run test:node` (599 pass). | External provider signup smoke pending |
| TASK-03 Supabase Google/OTP/email setup | IN_PROGRESS | TASK-01 | Confirmed active Google Cloud identity and project `e-commerce-740639`; configured project host is `putywqmxtjttfdezlswf.supabase.co`. Migration is applied. | Read-only Auth settings check: Email provider enabled, signup enabled, autoconfirm off; Google provider disabled. No provider/settings changed. Required Google callback is `https://putywqmxtjttfdezlswf.supabase.co/auth/v1/callback`; local origin `http://localhost:3000`; redirects `/auth/callback`, `/reset-password`, and local wildcard. | Need Google OAuth Web Client ID/secret and Gmail app password; user creates/enters credentials directly in provider settings. Then configure templates/redirects/minimum password and run OTP/Google/recovery smoke. Gmail SMTP is demo-only; use a transactional provider before production. |
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
- COD is in scope; online payment providers, avatar upload, reviews and notifications are out of scope.
- Frontend 3000, backend 3001. Secrets remain in provider settings/secret stores, never Git.
- User may delete an address because orders store address snapshots; checkout reads and snapshots the chosen address in its transaction.

## Current implementation evidence and remaining acceptance

- Latest PostgreSQL integrations use real isolated schemas. No task is marked `DONE` except baseline TASK-00 because the plan requires provider smoke tests, controlled migration acceptance, focused auth tests and full COD flow before closure.
- Backend address `setDefault` failure was observed before the transaction fix and then verified to roll back. TASK-07/09/01 red evidence was recorded against missing read methods/DTO fields/migration respectively; TASK-02 red evidence was missing service implementation.
- Google Cloud CLI is authenticated for project `e-commerce-740639`, but the browser Google Console session is signed out. No OAuth client key was created because Console sign-in cannot be automated here and persistent-key creation requires immediate confirmation. Use callback `https://putywqmxtjttfdezlswf.supabase.co/auth/v1/callback`; add `http://localhost:3000` as origin. Supabase provider/templates/redirect allowlist and Gmail SMTP remain external setup. Never paste Client Secret or Gmail's 16-character app password into this repo or chat.
- Gmail SMTP is suitable for demo only (roughly 500 messages/day); use a transactional mail provider and review Supabase custom SMTP rate limits before production. Set Supabase minimum password to 8 to match frontend validation.
- TASK-04 does not yet use `@supabase/ssr`; its browser client persists PKCE session in browser storage. Revisit cookie-backed SSR before production deployment.

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
