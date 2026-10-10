import { expect, test } from './fixtures';

test('Buyer can create, edit, default, delete, and validate an address against the live API', async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error('E2E_SEED_PASSWORD is required for the Buyer address path');

  await page.goto('/login?returnTo=%2Fprofile');
  await page.getByLabel('Địa chỉ Email').fill('buyer@dino-e2e.test');
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);

  const result = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('ecommerce_sb_session') ?? '{}') as { access_token?: string };
    if (!session.access_token) throw new Error('Supabase access token is missing');
    const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
    const base = 'http://localhost:3001/api/v1/addresses';
    const invalid = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ recipientName: '', phone: 'bad', province: '', ward: '', detailAddress: '' }) });
    const created = await fetch(base, { method: 'POST', headers, body: JSON.stringify({
      recipientName: 'E2E Address Candidate', phone: '0900000002', province: 'TP Hồ Chí Minh', district: 'Quận 1',
      ward: 'Bến Nghé', detailAddress: '9 Dino E2E Street', isDefault: true,
    }) });
    const createdBody = await created.json() as { data?: { addressId?: string; address_id?: string } };
    const addressId = createdBody.data?.addressId ?? createdBody.data?.address_id;
    if (!addressId) throw new Error('Live address creation returned no address ID');
    const updated = await fetch(`${base}/${addressId}`, { method: 'PATCH', headers, body: JSON.stringify({ recipientName: 'E2E Address Updated' }) });
    const defaulted = await fetch(`${base}/${addressId}/default`, { method: 'PATCH', headers, body: '{}' });
    const beforeDelete = await fetch(base, { headers }).then((response) => response.json()) as { data: Array<{ addressId?: string; address_id?: string; isDefault?: boolean; is_default?: boolean }> };
    const deleted = await fetch(`${base}/${addressId}`, { method: 'DELETE', headers });
    const afterDelete = await fetch(base, { headers }).then((response) => response.json()) as { data: Array<{ isDefault?: boolean; is_default?: boolean }> };
    return {
      invalidStatus: invalid.status,
      createStatus: created.status,
      updateStatus: updated.status,
      defaultStatus: defaulted.status,
      defaultCountBeforeDelete: beforeDelete.data.filter((address) => address.isDefault ?? address.is_default).length,
      deleteStatus: deleted.status,
      remainingCount: afterDelete.data.length,
      remainingDefaultCount: afterDelete.data.filter((address) => address.isDefault ?? address.is_default).length,
    };
  });

  expect(result).toEqual({
    invalidStatus: 422,
    createStatus: 201,
    updateStatus: 200,
    defaultStatus: 200,
    defaultCountBeforeDelete: 1,
    deleteStatus: 204,
    remainingCount: 1,
    remainingDefaultCount: 1,
  });
});
