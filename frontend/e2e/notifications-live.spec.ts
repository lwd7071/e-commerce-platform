import { expect, test } from './fixtures';

const buyerEmail = 'buyer@dino-e2e.test';

test('seeded Buyer reads a real notification and the change survives reload', async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error('E2E_SEED_PASSWORD is required for the seeded notification path');

  await page.goto('/login?returnTo=%2Fnotifications');
  await page.getByLabel('Địa chỉ Email').fill(buyerEmail);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/notifications$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible();

  const notification = page.getByRole('listitem').filter({ hasText: 'Đơn hàng đang được chuẩn bị' });
  await expect(notification).toBeVisible();
  const listResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/notifications') && response.request().method() === 'GET', { timeout: 20_000 });
  await page.reload();
  expect((await listResponse).status()).toBe(200);

  const reloadedNotification = page.getByRole('listitem').filter({ hasText: 'Đơn hàng đang được chuẩn bị' });
  await expect(reloadedNotification.getByText('Đã đọc', { exact: true })).toHaveCount(0);
  const markReadResponse = page.waitForResponse((response) =>
    /\/api\/v1\/notifications\/[0-9a-f-]+\/read$/.test(response.url()) && response.request().method() === 'PATCH');
  await reloadedNotification.getByRole('button', { name: 'Đánh dấu đã đọc' }).click();
  expect((await markReadResponse).status()).toBe(200);
  await expect(reloadedNotification.getByText('Đã đọc', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: 'Đơn hàng đang được chuẩn bị' }).getByText('Đã đọc', { exact: true })).toBeVisible();
});
