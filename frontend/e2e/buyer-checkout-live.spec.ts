import { expect, test } from './fixtures';

const buyerEmail = 'buyer@dino-e2e.test';
const shopId = 'e2000000-0000-4000-8000-000000000003';

test('seeded Buyer checks out one Shop with a live voucher and COD', async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error('E2E_SEED_PASSWORD is required for the seeded checkout path');

  await page.goto('/login?returnTo=%2Fcart');
  await page.getByLabel('Địa chỉ Email').fill(buyerEmail);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);

  await expect(page.getByRole('link', { name: 'E2E Product' }).first()).toBeVisible();
  const regularItem = page.locator('article').filter({ hasText: 'Regular' }).first();
  const regularQuantity = (item: typeof regularItem) => item.locator('button[aria-label="Giảm số lượng"] + span');
  const increaseResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/cart/items/') && response.request().method() === 'PATCH',
  );
  await regularItem.getByRole('button', { name: 'Tăng số lượng' }).click();
  expect((await increaseResponse).status()).toBe(200);
  await expect(regularQuantity(regularItem)).toHaveText('2');
  await page.reload();
  const reloadedRegularItem = page.locator('article').filter({ hasText: 'Regular' }).first();
  await expect(regularQuantity(reloadedRegularItem)).toHaveText('2');
  const decreaseResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/cart/items/') && response.request().method() === 'PATCH',
  );
  await reloadedRegularItem.getByRole('button', { name: 'Giảm số lượng' }).click();
  expect((await decreaseResponse).status()).toBe(200);
  await expect(regularQuantity(reloadedRegularItem)).toHaveText('1');

  const productSelections = page.getByRole('checkbox', { name: 'Chọn sản phẩm E2E Product' });
  await expect(productSelections).toHaveCount(2);
  await expect(productSelections.nth(1)).not.toBeChecked();
  const selectionResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/cart/items/') && response.request().method() === 'PATCH',
  );
  await productSelections.nth(1).check();
  expect((await selectionResponse).status()).toBe(200);
  await page.reload();
  const reloadedSelections = page.getByRole('checkbox', { name: 'Chọn sản phẩm E2E Product' });
  await expect(reloadedSelections.nth(1)).toBeChecked();
  const unselectResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/cart/items/') && response.request().method() === 'PATCH',
  );
  await reloadedSelections.nth(1).uncheck();
  expect((await unselectResponse).status()).toBe(200);

  const invalidQuantities = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('ecommerce_sb_session') ?? '{}') as { access_token?: string };
    if (!session.access_token) throw new Error('Supabase access token is missing');
    const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
    const item = 'e2000000-0000-4000-8000-000000000011';
    const attempts = await Promise.all([0, -1, 26].map((quantity) => fetch(
      `http://localhost:3001/api/v1/cart/items/${item}`,
      { method: 'PATCH', headers, body: JSON.stringify({ quantity }) },
    )));
    return attempts.map((response) => response.status);
  });
  console.log('T2_P2_INVALID_CART_QUANTITY_STATUSES', invalidQuantities.join(','));
  expect(invalidQuantities.every((status) => status >= 400)).toBe(true);

  await page.getByRole('button', { name: /Mua hàng/ }).click();
  await expect(page.getByRole('heading', { name: 'Thanh toán đơn hàng' })).toBeVisible();
  await expect(page.getByText('1 Dino E2E Street').first()).toBeVisible();

  const voucher = page.locator(`#voucher-${shopId}`);
  await voucher.fill('E2E-SAVE');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByText(/Mã E2E-SAVE:/)).toBeVisible();
  await page.getByRole('radio', { name: /COD/ }).check();

  const checkoutResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/checkout') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Đặt hàng ngay/ }).click();
  const response = await checkoutResponse;
  expect(response.status()).toBe(201);

  const request = response.request().postDataJSON();
  expect(request).toMatchObject({
    address_id: 'e2000000-0000-4000-8000-000000000007',
    payment_method: 'COD',
    vouchers: [{ shop_id: shopId, code: 'E2E-SAVE' }],
  });
  expect(response.request().headers()['idempotency-key']).toBeTruthy();

  const body = await response.json() as { data: { orders: Array<{ order_id: string; status: string; total_amount: string }> } };
  expect(body.data.orders).toHaveLength(1);
  expect(body.data.orders[0]).toMatchObject({ status: 'PENDING_CONFIRMATION' });
  expect(Number(body.data.orders[0]?.total_amount)).toBeGreaterThan(0);
  console.log(`T2_P2_ORDER_ID=${body.data.orders[0]?.order_id}`);
  await expect(page).toHaveURL(/\/orders\?created=/);
});

test('live voucher validation rejects expired, exhausted, wrong-Shop, and below-minimum codes', async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error('E2E_SEED_PASSWORD is required for the Buyer voucher path');

  await page.goto('/login?returnTo=%2Fcart');
  await page.getByLabel('Địa chỉ Email').fill(buyerEmail);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole('button', { name: /Mua hàng/ }).click();
  await expect(page.getByRole('heading', { name: 'Thanh toán đơn hàng' })).toBeVisible();

  let checkoutRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/checkout') && request.method() === 'POST') checkoutRequests += 1;
  });
  const voucher = page.locator(`#voucher-${shopId}`);
  for (const code of ['E2E-EXPIRED', 'E2E-EXHAUSTED', 'E2E-WRONG-SHOP', 'E2E-MINIMUM']) {
    await voucher.fill(code);
    const evaluation = page.waitForResponse((response) =>
      response.url().includes('/api/v1/vouchers/evaluate') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    const response = await evaluation;
    expect(response.status()).toBe(200);
    const body = await response.json() as { data?: { isValid?: boolean } };
    expect(body.data?.isValid).toBe(false);
    await expect(page.getByRole('alert').first()).toBeVisible();
  }
  expect(checkoutRequests).toBe(0);
});
