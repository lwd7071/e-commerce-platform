import { expect, test } from '@playwright/test';
import path from 'node:path';

const sellerEmail = process.env.E2E_SELLER_EMAIL;
const sellerPassword = process.env.E2E_SELLER_PASSWORD;

test('B-206: seller uploads to Supabase, creates product, edits stock, and hides/shows it', async ({ page }) => {
  test.skip(!sellerEmail || !sellerPassword, 'Set E2E_SELLER_EMAIL and E2E_SELLER_PASSWORD for the live Seller smoke.');

  const productName = `B206 E2E ${Date.now()}`;
  const sku = `B206-${Date.now()}`;

  await page.goto('/login?returnTo=%2Fseller%2Fproducts');
  await page.getByLabel('Địa chỉ Email').fill(sellerEmail!);
  await page.getByLabel('Mật khẩu').fill(sellerPassword!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\/products(?:\?|$)/, { timeout: 30_000 });

  await page.getByRole('link', { name: /Thêm sản phẩm mới/i }).click();
  await expect(page.getByRole('heading', { name: 'Thêm Sản Phẩm Mới' })).toBeVisible();
  await page.getByLabel('Tên sản phẩm').fill(productName);
  await page.locator('#variant-sku-var-1').fill(sku);

  const presignResponse = page.waitForResponse((response) =>
    response.url().includes('/media/uploads/presign') && response.request().method() === 'POST');
  const uploadResponse = page.waitForResponse((response) =>
    response.url().includes('/storage/v1/object/upload/sign/') && response.request().method() === 'PUT');
  const finalizeResponse = page.waitForResponse((response) =>
    /\/media\/uploads\/[0-9a-f-]+\/finalize/.test(response.url()) && response.request().method() === 'POST');

  await page.locator('#product-file-upload').setInputFiles(path.resolve(process.cwd(), '..', 'lvvd.jpg'));

  const presign = await presignResponse;
  expect(presign.status()).toBe(201);
  const presignPayload = await presign.json();
  const mediaId = presignPayload.data.media_id as string;
  const objectPath = presignPayload.data.storage_path as string;
  const upload = await uploadResponse;
  expect(upload.ok(), `Supabase Storage PUT failed: ${upload.status()}`).toBe(true);
  const finalized = await finalizeResponse;
  expect(finalized.status()).toBe(200);
  const finalizedPayload = await finalized.json();
  const imageUrl = finalizedPayload.data.public_url as string;
  expect(imageUrl).toContain('/storage/v1/object/public/product-media/');
  const storedImage = await page.request.get(imageUrl);
  expect(storedImage.status(), 'Finalized image must be publicly readable from the project Storage bucket').toBe(200);

  const createResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/products') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Tạo sản phẩm/i }).click();
  const created = await createResponsePromise;
  expect(created.status()).toBe(201);
  const createdPayload = await created.json();
  const createdProductId = createdPayload.data.product_id as string;
  expect(objectPath).toContain(`/products/${createdProductId}/`);
  expect(createdPayload.data.images?.[0]?.image_url ?? imageUrl).toContain('/storage/v1/object/public/product-media/');
  test.info().annotations.push({ type: 'cleanup-product-id', description: createdProductId });
  test.info().annotations.push({ type: 'cleanup-media-id', description: mediaId });

  await expect(page.getByRole('heading', { name: 'Quản lý sản phẩm' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: productName });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Chỉnh tồn kho' }).click();
  await page.locator('#variant-stock-input').fill('17');
  const stockResponse = page.waitForResponse((response) =>
    response.url().includes('/product-variants/') && response.url().endsWith('/stock') && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  expect((await stockResponse).ok()).toBe(true);

  const hideResponse = page.waitForResponse((response) =>
    response.url().includes(`/products/${createdProductId}/status`) && response.request().method() === 'PATCH');
  await row.getByRole('button', { name: 'Ẩn', exact: true }).click();
  expect((await hideResponse).ok()).toBe(true);
  await expect(row.getByText('Đã ẩn')).toBeVisible();

  const showResponse = page.waitForResponse((response) =>
    response.url().includes(`/products/${createdProductId}/status`) && response.request().method() === 'PATCH');
  await row.getByRole('button', { name: 'Hiện', exact: true }).click();
  expect((await showResponse).ok()).toBe(true);
  await expect(row.getByText('Đang bán')).toBeVisible();
});
