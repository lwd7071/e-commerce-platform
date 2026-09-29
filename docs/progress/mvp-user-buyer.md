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

Current confirmed runtime gaps from contract audit: onboarding/auth provisioning, profile routes, categories route, enriched cart, order GET stubs, address item routes. Baseline files `env_vercel` and `frontend/env_vercel` were already untracked and are left untouched.

## Work tracker

| Task | Trạng thái | Dependency | Thay đổi | Test/Evidence | Blocker |
|---|---|---|---|---|---|
| TASK-00 Baseline + contract | DONE | — | Required docs read in order; baseline and runtime gap/target contract captured here | Backend `test:node` 600/600; frontend `test` 149/149; backend typecheck/lint/build PASS; frontend typecheck/lint/build PASS. Full backend Vitest baseline was interrupted and is not claimed as pass. | — |
| TASK-01 Auth user bootstrap trigger | IN_PROGRESS | TASK-00 | Added additive migration, SECURITY DEFINER trigger, backfill and isolated PostgreSQL integration suite | Red: `npm run test:vitest -- tests/db/auth-user-bootstrap.integration.test.ts` failed because expected migration file was absent (ENOENT). Green: same command, 5/5 real PostgreSQL tests pass. Added migration replay contract assertion; still need run it, clean replay acceptance and Supabase email/Google signup smoke. | Provider signup smoke not yet run; migration replay assertion pending |
| TASK-02 Onboarding API | TODO | TASK-01 | Transactional Buyer/Seller onboarding, active-shop authorization, rate limit | TDD red/green and real PostgreSQL evidence required | — |
| TASK-03 Supabase Google/OTP/email setup | TODO | TASK-01 | Provider/template/redirect guidance and safe public env contract | Config and Supabase smoke evidence; no secrets in repo | External Google/Supabase/Gmail access may be needed |
| TASK-04 Frontend auth foundation | TODO | TASK-02, TASK-03 | SSR clients, callback/session and auth API adapter | New tests + typecheck/build evidence | — |
| TASK-05 Auth screens and flows | TODO | TASK-04 | Register, OTP, Google, forgot/reset, complete profile | New tests + typecheck/build evidence | External OAuth/email configuration |
| TASK-06 Profile API + UI | TODO | TASK-02 | GET/PATCH profile, validation/rate limit, FE adapter | New tests + checks evidence | — |
| TASK-07 Order reads | TODO | TASK-00 | Runtime query wiring, real DTO, ownership, FE adapter | TDD red/green, PostgreSQL integration evidence | Test runner currently blocked |
| TASK-08 Public categories | TODO | TASK-00 | GET categories/OpenAPI/FE adapter | New tests + checks evidence | — |
| TASK-09 Enriched cart | TODO | TASK-00 | PostgreSQL read model and FE adapter | TDD red/green, PostgreSQL integration evidence | Test runner currently blocked |
| TASK-10 Address CRUD | TODO | TASK-00 | Owner-scoped item routes/default/delete semantics + FE | TDD red/green, PostgreSQL integration evidence | Test runner currently blocked |
| TASK-11 Contract/security alignment | TODO | TASK-04..10 | JWKS docs, OpenAPI and gap/mapping cleanup | Contract/security tests + checks evidence | — |
| TASK-12 Acceptance + docs | TODO | All | Full quality gates, smoke tests, final traceability | Full test and external smoke evidence | Test runner and provider credentials may block acceptance |

## Locked contract decisions

- Email/password plus Google OAuth; email signup confirmation uses six-digit OTP, password recovery uses a reset link.
- First-time account role is always BUYER at auth bootstrap. Seller onboarding creates one PENDING shop; Seller business endpoints require that shop to be ACTIVE.
- Onboarding retry with matching role/shop data returns current state; conflicting role/shop data returns 409.
- `shops.owner_id` uniqueness is enforced in PostgreSQL and treated as the race-condition backstop.
- PostgreSQL integration tests use a real isolated test database; no database mocks for TASK-01/02/07/09/10.
- COD is in scope; online payment providers, avatar upload, reviews and notifications are out of scope.
- Frontend 3000, backend 3001. Secrets remain in provider settings/secret stores, never Git.
- User may delete an address because orders store address snapshots; checkout reads and snapshots the chosen address in its transaction.
