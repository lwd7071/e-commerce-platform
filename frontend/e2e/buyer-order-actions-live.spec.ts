import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

async function login(page: Page, email: string) {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error('E2E_SEED_PASSWORD is required for the Buyer order path');
  await page.goto('/login?returnTo=%2Forders');
  await page.getByLabel('Địa chỉ Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
}

test('Buyer cancellation requires a reason, rejects invalid states, and cannot restock twice', async ({ page }) => {
  await login(page, 'buyer@dino-e2e.test');
  const result = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('ecommerce_sb_session') ?? '{}') as { access_token?: string };
    if (!session.access_token) throw new Error('Supabase access token is missing');
    const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
    const base = 'http://localhost:3001/api/v1/orders';
    const pending = 'e2000000-0000-4000-8000-000000001001';
    const noReason = await fetch(`${base}/${pending}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: ' ' }) });
    const cancelled = await fetch(`${base}/${pending}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Buyer changed their mind for E2E' }) });
    const repeated = await fetch(`${base}/${pending}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Repeated E2E cancellation' }) });
    const confirmed = await fetch(`${base}/e2000000-0000-4000-8000-000000001002/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Attempt after seller confirmation' }) });
    return { noReason: noReason.status, cancelled: cancelled.status, repeated: repeated.status, confirmed: confirmed.status };
  });
  expect(result.noReason).toBe(422);
  expect(result.cancelled).toBe(200);
  expect(result.repeated).toBe(409);
  expect(result.confirmed).toBe(409);
});

test('only Buyer-owned COMPLETED OrderItems can receive one rating from 1 to 5', async ({ page }) => {
  await login(page, 'buyer@dino-e2e.test');
  const result = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('ecommerce_sb_session') ?? '{}') as { access_token?: string };
    if (!session.access_token) throw new Error('Supabase access token is missing');
    const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
    const base = 'http://localhost:3001/api/v1/order-items';
    const early = await fetch(`${base}/e2000000-0000-4000-8000-000000003004/review`, { method: 'POST', headers, body: JSON.stringify({ rating: 5, content: 'Too early' }) });
    const badRating = await fetch(`${base}/e2000000-0000-4000-8000-000000003005/review`, { method: 'POST', headers, body: JSON.stringify({ rating: 6, content: 'Invalid rating' }) });
    const valid = await fetch(`${base}/e2000000-0000-4000-8000-000000003005/review`, { method: 'POST', headers, body: JSON.stringify({ rating: 5, content: 'Verified E2E review' }) });
    const duplicate = await fetch(`${base}/e2000000-0000-4000-8000-000000003005/review`, { method: 'POST', headers, body: JSON.stringify({ rating: 4, content: 'Duplicate E2E review' }) });
    return { early: early.status, badRating: badRating.status, valid: valid.status, duplicate: duplicate.status };
  });
  expect(result).toMatchObject({ early: 422, badRating: 422, valid: 201, duplicate: 409 });

  const secondaryPage = await page.context().newPage();
  await login(secondaryPage, 'buyer-secondary@dino-e2e.test');
  const wrongOwnerStatus = await secondaryPage.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('ecommerce_sb_session') ?? '{}') as { access_token?: string };
    if (!session.access_token) throw new Error('Supabase access token is missing');
    const response = await fetch('http://localhost:3001/api/v1/order-items/e2000000-0000-4000-8000-000000003006/review', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, content: 'Wrong Buyer E2E review' }),
    });
    return response.status;
  });
  expect(wrongOwnerStatus).toBe(422);
  await secondaryPage.close();
});
