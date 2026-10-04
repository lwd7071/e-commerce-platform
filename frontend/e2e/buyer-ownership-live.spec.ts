import { expect, test } from './fixtures';

test('secondary Buyer cannot access the primary Buyer address, cart, order, or notification', async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error('E2E_SEED_PASSWORD is required for the Buyer ownership path');

  await page.goto('/login?returnTo=%2Fprofile');
  await page.getByLabel('Địa chỉ Email').fill('buyer-secondary@dino-e2e.test');
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);

  const results = await page.evaluate(async (ids) => {
    const session = JSON.parse(localStorage.getItem('ecommerce_sb_session') ?? '{}') as { access_token?: string };
    if (!session.access_token) throw new Error('Supabase access token is missing');
    const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
    const base = 'http://localhost:3001/api/v1';
    const calls = await Promise.all([
      fetch(`${base}/addresses/${ids.address}`, { headers }),
      fetch(`${base}/addresses/${ids.address}`, {
        method: 'PATCH', headers, body: JSON.stringify({ recipientName: 'Unauthorized edit' }),
      }),
      fetch(`${base}/cart/items/${ids.cartItem}`, {
        method: 'PATCH', headers, body: JSON.stringify({ quantity: 5 }),
      }),
      fetch(`${base}/orders/${ids.order}`, { headers }),
      fetch(`${base}/notifications/${ids.notification}`, { headers }),
      fetch(`${base}/cart`, { headers }),
    ]);
    const cart = await calls[5]!.json() as unknown;
    return {
      targetResourceStatuses: calls.slice(0, 5).map((response) => response.status),
      cartContainsPrimaryItem: JSON.stringify(cart).includes(ids.cartItem),
    };
  }, {
    address: 'e2000000-0000-4000-8000-000000000007',
    cartItem: 'e2000000-0000-4000-8000-000000000011',
    order: 'e2000000-0000-4000-8000-000000001001',
    notification: 'e2000000-0000-4000-8000-000000000010',
  });

  expect(results.targetResourceStatuses).toEqual([404, 404, 404, 404, 404]);
  expect(results.cartContainsPrimaryItem).toBe(false);
});
