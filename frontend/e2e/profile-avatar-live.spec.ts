import path from 'node:path';
import { expect, test } from './fixtures';

const buyerEmail = 'buyer@dino-e2e.test';

test('seeded Buyer uploads an avatar to Storage and sees it after reload', async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error('E2E_SEED_PASSWORD is required for the seeded avatar path');

  await page.goto('/login?returnTo=%2Fprofile');
  await page.getByLabel('Địa chỉ Email').fill(buyerEmail);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Hồ sơ cá nhân' })).toBeVisible();

  const fullName = page.getByLabel('Họ và tên');
  const phone = page.getByLabel('Số điện thoại');
  await fullName.fill('E2E Buyer Round 2');
  await phone.fill('0900000009');
  const profileResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/profile') && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  expect((await profileResponse).status()).toBe(200);
  await expect(fullName).toHaveValue('E2E Buyer Round 2');
  await expect(phone).toHaveValue('0900000009');
  expect(await page.locator('#profile-email').evaluate((element) => (element as HTMLInputElement).readOnly)).toBe(true);
  expect(await page.locator('#profile-role').evaluate((element) => (element as HTMLInputElement).readOnly)).toBe(true);

  const presignResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/media/uploads/presign') && response.request().method() === 'POST');
  const attachResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/profile/avatar') && response.request().method() === 'PATCH');
  await page.getByTestId('profile-avatar-upload').setInputFiles(path.resolve(process.cwd(), '..', 'lvvd.jpg'));
  const presign = await presignResponse;
  expect(presign.status()).toBe(201);
  expect(presign.request().postDataJSON()).toMatchObject({ purpose: 'avatar_image', content_type: 'image/jpeg' });

  const attached = await attachResponse;
  expect(attached.status()).toBe(200);
  const avatar = page.getByRole('img', { name: 'Ảnh đại diện của E2E Buyer Round 2' });
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute('src', /^https:\/\/[^/]+\/storage\/v1\/object\/public\/profile-media\//);
  await expect.poll(async () => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByLabel('Họ và tên')).toHaveValue('E2E Buyer Round 2');
  await expect(page.getByLabel('Số điện thoại')).toHaveValue('0900000009');
  await expect(page.getByRole('img', { name: 'Ảnh đại diện của E2E Buyer Round 2' })).toHaveAttribute('src', /profile-media/);
});
