import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { assertMallTestEnvironment } from './mall-environment';

test.skip(process.env.RUN_MALL_LIVE_E2E !== 'true', 'Provision a dedicated test project and disposable accounts first');
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
async function login(page: Page, email: string, password: string, destination: string) {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Địa chỉ Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}(?:\\?|$)`));
}
async function submit(page: Page, reason: string): Promise<string> {
  await page.getByLabel(/Đường dẫn hồ sơ chứng minh/).fill('https://example.com/mall-test-evidence');
  await page.getByLabel(/Lý do \/ Giới thiệu/).fill(reason);
  const response = page.waitForResponse(r => r.url().endsWith('/seller/shop/mall-requests') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Gửi yêu cầu nâng hạng/ }).click();
  const result = await response;
  expect(result.status()).toBe(201);
  const body = await result.json();
  expect(body.data.request_id).toBeTruthy();
  await expect(page.getByText('⏳ Đang chờ duyệt', { exact: true })).toBeVisible();
  return body.data.request_id;
}
async function review(page: Page, id: string, reason: string, action: 'approve' | 'reject') {
  await page.getByRole('button', { name: /Yêu cầu lên Dino Mall/ }).click();
  const row = page.locator('tr').filter({ hasText: reason });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: action === 'approve' ? 'Duyệt Mall' : 'Từ chối', exact: true }).click();
  await page.locator(action === 'approve' ? '#approve-mall-note' : '#reject-mall-reason')
    .fill(action === 'approve' ? 'Đã kiểm tra hồ sơ thử nghiệm hợp lệ' : 'Cần bổ sung hồ sơ thử nghiệm');
  const response = page.waitForResponse(r => r.url().endsWith(`/mall-requests/${id}/${action}`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: action === 'approve' ? 'Xác nhận duyệt Mall' : 'Xác nhận từ chối', exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect((await result.json()).data.status).toBe(action === 'approve' ? 'APPROVED' : 'REJECTED');
}
test.beforeAll(() => {
  assertMallTestEnvironment(process.env);
  for (const name of ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_MALL_SELLER_PASSWORD',
    'E2E_MALL_APPROVE_SELLER_EMAIL', 'E2E_MALL_REJECT_SELLER_EMAIL', 'E2E_MALL_CANCEL_SELLER_EMAIL',
    'E2E_BUYER_EMAIL', 'E2E_BUYER_PASSWORD', 'E2E_MALL_PRODUCT_ID', 'E2E_MALL_PRODUCT_NAME']) required(name);
  expect(new Set(['APPROVE', 'REJECT', 'CANCEL'].map(kind => required(`E2E_MALL_${kind}_SELLER_EMAIL`))).size).toBe(3);
});
test('Seller gửi → Admin duyệt → Seller thấy MALL → Buyer thấy badge đúng sản phẩm', async ({ browser, baseURL }) => {
  const seller = await browser.newContext({ baseURL });
  const admin = await browser.newContext({ baseURL });
  const buyer = await browser.newContext({ baseURL });
  try {
    const sellerPage = await seller.newPage();
    const adminPage = await admin.newPage();
    const buyerPage = await buyer.newPage();
    await login(sellerPage, required('E2E_MALL_APPROVE_SELLER_EMAIL'), required('E2E_MALL_SELLER_PASSWORD'), '/seller/shop');
    await expect(sellerPage.getByRole('heading', { name: 'Hồ sơ gian hàng', exact: true })).toBeVisible();
    const reason = `Hồ sơ kiểm chứng Mall ${randomUUID()}`;
    const id = await submit(sellerPage, reason);
    await login(adminPage, required('E2E_ADMIN_EMAIL'), required('E2E_ADMIN_PASSWORD'), '/admin/shops');
    await review(adminPage, id, reason, 'approve');
    await sellerPage.getByRole('button', { name: 'Làm mới trạng thái gian hàng' }).click();
    await expect(sellerPage.getByText('✓ Đã là Dino Mall', { exact: true })).toBeVisible();
    await login(buyerPage, required('E2E_BUYER_EMAIL'), required('E2E_BUYER_PASSWORD'), '/products');
    await buyerPage.goto(`/products?search=${encodeURIComponent(required('E2E_MALL_PRODUCT_NAME'))}`);
    const card = buyerPage.locator('article').filter({ has: buyerPage.locator(`a[href="/products/${required('E2E_MALL_PRODUCT_ID')}"]`) });
    await expect(card).toHaveCount(1);
    await expect(card.locator('[aria-label="Mall"]')).toBeVisible();
  } finally {
    await Promise.all([seller.close(), admin.close(), buyer.close()]);
  }
});
test('Seller nhận lý do từ chối và thực sự nộp lại hồ sơ mới', async ({ browser, baseURL }) => {
  const seller = await browser.newContext({ baseURL });
  const admin = await browser.newContext({ baseURL });
  try {
    const sellerPage = await seller.newPage();
    const adminPage = await admin.newPage();
    await login(sellerPage, required('E2E_MALL_REJECT_SELLER_EMAIL'), required('E2E_MALL_SELLER_PASSWORD'), '/seller/shop');
    const reason = `Hồ sơ cần bổ sung ${randomUUID()}`;
    const id = await submit(sellerPage, reason);
    await login(adminPage, required('E2E_ADMIN_EMAIL'), required('E2E_ADMIN_PASSWORD'), '/admin/shops');
    await review(adminPage, id, reason, 'reject');
    await sellerPage.getByRole('button', { name: 'Làm mới trạng thái gian hàng' }).click();
    await expect(sellerPage.getByText(/Cần bổ sung hồ sơ thử nghiệm/)).toBeVisible();
    const newId = await submit(sellerPage, `Hồ sơ bổ sung ${randomUUID()}`);
    expect(newId).not.toBe(id);
  } finally {
    await Promise.all([seller.close(), admin.close()]);
  }
});
test('Seller hủy yêu cầu PENDING qua xác nhận trình duyệt', async ({ page }) => {
  await login(page, required('E2E_MALL_CANCEL_SELLER_EMAIL'), required('E2E_MALL_SELLER_PASSWORD'), '/seller/shop');
  const id = await submit(page, `Hồ sơ sẽ hủy ${randomUUID()}`);
  page.once('dialog', dialog => dialog.accept());
  const response = page.waitForResponse(r => r.url().endsWith(`/mall-requests/${id}/cancel`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Hủy yêu cầu', exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect((await result.json()).data.status).toBe('CANCELLED');
  await expect(page.getByRole('button', { name: 'Hủy yêu cầu', exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Đường dẫn hồ sơ chứng minh/)).toBeEnabled();
});
