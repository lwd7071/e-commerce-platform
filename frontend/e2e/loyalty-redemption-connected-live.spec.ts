import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { assertMallTestEnvironment } from './mall-environment';

test.skip(process.env.RUN_LOYALTY_LIVE_E2E !== 'true', 'Needs disposable rewards/refund fixtures in a dedicated test project');
function required(name: string) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name]!;
}
async function login(page: Page, role: 'BUYER' | 'ADMIN', destination: string) {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Địa chỉ Email').fill(required(`E2E_${role}_EMAIL`));
  await page.getByLabel('Mật khẩu', { exact: true }).fill(required(`E2E_${role}_PASSWORD`));
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}(?:\\?|$)`));
}
test.beforeAll(() => {
  assertMallTestEnvironment(process.env);
  for (const key of ['E2E_BUYER_EMAIL','E2E_BUYER_PASSWORD','E2E_ADMIN_EMAIL','E2E_ADMIN_PASSWORD','E2E_LOYALTY_REFUND_ORDER_ID']) required(key);
});
test('Buyer đổi voucher thật; Admin ghi nhận hoàn thành công; Buyer thấy điểm âm và bị chặn đổi', async ({ browser, baseURL }) => {
  const buyer = await browser.newContext({ baseURL });
  const admin = await browser.newContext({ baseURL });
  try {
    const buyerPage = await buyer.newPage();
    const adminPage = await admin.newPage();
    await login(buyerPage, 'BUYER', '/profile');
    const card = buyerPage.getByTestId('buyer-loyalty-card');
    await expect(card.getByTestId('loyalty-points-badge').getByText('100 điểm', { exact: true })).toBeVisible();
    const redemption = buyerPage.waitForResponse(r => r.url().endsWith('/buyer/loyalty/redeem') && r.request().method() === 'POST');
    await card.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' }).click();
    const result = await redemption;
    expect(result.status()).toBe(201);
    const reward = (await result.json()).data;
    await expect(card.getByText(reward.code, { exact: true })).toBeVisible();
    await expect(card.getByTestId('loyalty-points-badge').getByText('0 điểm', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' })).toBeDisabled();
    await login(adminPage, 'ADMIN', '/admin/orders');
    const orderId = required('E2E_LOYALTY_REFUND_ORDER_ID');
    await adminPage.locator('tr').filter({ hasText: orderId }).getByRole('button', { name: 'Mở', exact: true }).click();
    await adminPage.getByRole('textbox', { name: 'Tiền hàng đủ điều kiện đã hoàn (đ)', exact: true }).fill('1000000.00');
    await adminPage.getByRole('textbox', { name: 'Mã đối soát khoản hoàn thành công', exact: true }).fill(`e2e-${randomUUID()}`);
    await adminPage.getByRole('textbox', { name: 'Lý do và bằng chứng đối soát', exact: true }).fill('Khoản hoàn thử nghiệm đã đối soát thành công');
    const refund = adminPage.waitForResponse(r => r.url().endsWith(`/orders/${orderId}/loyalty-refunds`) && r.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Ghi nhận thu hồi điểm', exact: true }).click();
    expect((await refund).status()).toBe(200);
    await expect(adminPage.getByRole('status').filter({ hasText: 'Đã ghi nhận thu hồi điểm' })).toBeVisible();
    await buyerPage.reload();
    await expect(card.getByTestId('loyalty-points-badge').getByText('-100 điểm', { exact: true })).toBeVisible();
    await expect(card.getByText('Thu hồi sau hoàn tiền', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' })).toBeDisabled();
  } finally { await Promise.all([buyer.close(), admin.close()]); }
});
