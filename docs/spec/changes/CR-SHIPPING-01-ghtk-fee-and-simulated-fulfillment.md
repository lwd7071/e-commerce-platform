# CR-SHIPPING-01 — GHTK fee quote and simulated fulfillment

## Status

**Approved — 2026-10-02, project owner approval recorded from the direct instruction “oke làm đi” in the Codex conversation.** Approval covers the scope and decisions in this CR.

## Owner and review

- Owner: Project owner.
- Technical reviewer: Not yet performed; do not imply a technical review.
- Approval date: 2026-10-02.

## Reason

Checkout currently stores `shipping_fee = 0.00`, buyer and seller addresses require free-text province/district/ward values, and product records have no package weight. The project needs a usable shipping estimate while keeping fulfillment simulated for the school project.

## Approved-scope proposal

1. Use one platform-owned GHTK API token only for fee calculation. Never create a real GHTK shipment, request GHTK tracking status, or configure a GHTK webhook under this CR. Default the provider to `mock`; select GHTK only when server configuration explicitly sets `SHIPPING_PROVIDER=ghtk`. Keep the API token and base URL server-side.
2. Use the official 2026 two-level administrative catalog (province/city and ward/commune/special unit) for buyer and shop address selection. Store stable catalog codes and display names. Preserve existing district values for old addresses/orders; allow district to be null for new records. Do not delete user data or historical order snapshots.
3. Add `products.weight_grams INTEGER NOT NULL DEFAULT 200` with a named positive-value check. Existing products receive 200g through the migration; seller product create/edit forms expose the weight so the seller can replace the fallback with the actual item weight.
4. Add structured pickup province/ward codes and names plus pickup detail address to the shop profile. Preserve the existing free-text pickup address during migration and editing until the seller supplies structured data. A shop without a valid structured pickup location cannot get a live GHTK quote.
5. Add public catalog endpoints `GET /api/v1/locations/provinces` and `GET /api/v1/locations/provinces/{province_code}/wards`; add authenticated `POST /api/v1/shipping/quote`. The quote endpoint uses the buyer's saved address and selected cart, groups by shop, aggregates product weight by quantity, and returns a shipping quote for each shop. No client-supplied amount is authoritative.
6. Extend checkout with the expected per-shop quote amounts returned by the quote endpoint. Before opening the checkout transaction, backend recalculates the quote for the current address/cart. If a quote differs, respond `409 SHIPPING_QUOTE_CHANGED` with refreshed quotes; create no order and consume no voucher/stock. Buyer must confirm the updated total and submit with a new idempotency key. Inside the transaction, persist only the backend-calculated shipping fee in each immutable order total. Never call GHTK from inside a database transaction.
7. Keep simulated fulfillment on the existing order/shipment state model. Seller can confirm, prepare, then mark handover (`PREPARING` → `SHIPPING`, simulated shipment `HANDED_OVER`). Seller cannot mark delivered or completed. Buyer confirmation while `SHIPPING` marks the simulated shipment `DELIVERED` and order `COMPLETED` atomically, with order history written once. Repeated confirmation is idempotent or returns the existing conflict contract without duplicate history.
8. Use only GHTK's fee endpoint for live quotes. Charge the freight amount `fee.fee`; do not request declared-value coverage or add `insurance_fee`/optional surcharges in v1. Reject a quote when GHTK reports `delivery=false`. Do not silently replace a failed live quote with a mock quote; return a dependency-unavailable error and allow retry.
9. API, migration and fixture changes must preserve existing user/order data. Update API/OpenAPI and frontend contracts; do not edit Schema Freeze v1.

## Interfaces and data flow

- Address APIs return the official administrative code/name pair used in the selection controls; no district selector is shown for new/edited addresses.
- Quote response contains a quote per shop, the backend-calculated fee as a decimal string, and the total weight used. Checkout receives those expected fees only for change detection; it independently recalculates and persists its own values.
- Configuration: `SHIPPING_PROVIDER=mock|ghtk` (default `mock`), `GHTK_API_BASE_URL`, and `GHTK_API_TOKEN`. Missing or invalid GHTK config fails startup validation when GHTK is selected; it must never leak to frontend or logs.
- Mock mode returns a clearly identified simulated estimate and creates no real carrier side effect. Both modes use the same address, cart, quote, checkout, and simulated handover flow.

## Rules and documents to update after approval

- `docs/architecture/rules/order-workflow-transactions.md`: quote-before-transaction behavior, immutable calculated shipping fee, simulated handover and buyer completion semantics.
- `docs/architecture/rules/db-schema-rules.md`, `business-rules.md`, and `error-observability.md`: weight/address schema, validation, shipping quote conflict and provider failure.
- `docs/frontend-spec/02-pages-and-user-flow.md`, `04-data-model.md`, `05-api-contract.md`, `06-fe-be-mapping.md`, and relevant UI implementation notes.
- OpenAPI, migration, product/address/checkout/seller/buyer UI and runtime provider configuration.
- Do not change `docs/spec/schema-freeze-v1.md`.

## Test seams and acceptance criteria

Tests use the previously agreed public seams: location APIs, quote/checkout APIs, seller order command, buyer received command, and end-to-end frontend user flow. Follow the `tdd` skill's one-test/one-implementation red-green slices; use `ui-ux-pro-max` for touched UI and follow `frontend/AGENTS.md` and current Next.js documentation before frontend edits.

- Migration from an empty DB succeeds; pre-existing products receive weight 200g; invalid/non-positive weight is rejected; historical district and order snapshots remain readable.
- Location APIs expose the approved two-level catalog; address ownership and invalid codes are rejected.
- GHTK adapter sends province/ward names and total grams to the fee endpoint, includes the token only in the server request, handles timeout/provider errors, and refuses undeliverable locations.
- Mock is the default and makes no network call. GHTK mode without credentials fails configuration validation.
- Quotes group multi-shop cart items correctly. Changed quote produces `409 SHIPPING_QUOTE_CHANGED` without creating orders, reserving stock, or consuming vouchers; retry with a new quote/key stores the server amount.
- Seller A cannot hand over Seller B's order; seller cannot complete an order. Handover creates/updates the simulated shipment and transitions to `SHIPPING` atomically.
- Only the owning buyer can confirm receipt; confirmation transitions shipment and order to delivered/completed atomically; retry cannot duplicate order history.
- Relevant backend unit, PostgreSQL integration, API contract, frontend unit and browser-flow checks pass; no skipped tests are added to obtain a green quality gate.

## Risks and compatibility

- The 200g value is a migration compatibility fallback, not a measured weight; product UI must let sellers correct it. Quotes may be inaccurate until corrected.
- GHTK fee API requires a token and may reject address labels even when they exist in the official catalog. Report that error to the buyer/shop without substituting a different fee.
- Checkout request fingerprint changes when quote amounts change; the frontend must use a new idempotency key after buyer reconfirms a refreshed quote.
- Existing address and order district values remain untouched; district becomes optional only for new two-level addresses.
