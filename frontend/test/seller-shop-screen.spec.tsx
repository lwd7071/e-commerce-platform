// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SellerShopScreen } from '@/features/seller/seller-shop-screen';
import { sellerShopApi, type SellerShopProfile } from '@/lib/api/seller-shop.api';
import { uploadMediaAsset } from '@/lib/api/media.api';

vi.mock('@/lib/api/seller-shop.api', () => ({
  sellerShopApi: {
    get: vi.fn(),
    update: vi.fn(),
    updateLogo: vi.fn(),
  },
}));

vi.mock('@/lib/api/media.api', () => ({
  uploadMediaAsset: vi.fn(),
}));

vi.mock('@/lib/api/locations.api', () => ({
  locationsApi: {
    provinces: vi.fn().mockResolvedValue([{ code: '79', name: 'Hồ Chí Minh' }]),
    wards: vi.fn().mockResolvedValue([{ code: '25747', name: 'Thủ Dầu Một', province_code: '79' }]),
  },
}));

const mockShop: SellerShopProfile = {
  shop_id: '00000000-0000-0000-0000-000000000001',
  shop_name: 'Dino Official Store',
  description: 'Gian hàng chính hãng',
  pickup_address: '123 Đường Công Nghệ, Q.1, TP.HCM',
  pickup_province: 'Hồ Chí Minh',
  pickup_province_code: '79',
  pickup_ward: 'Thủ Dầu Một',
  pickup_ward_code: '25747',
  contact_phone: '0901234567',
  logo_url: null,
  status: 'PENDING',
  updated_at: '2026-10-01T00:00:00.000Z',
};

describe('SellerShopScreen UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders shop profile data when loaded', async () => {
    vi.mocked(sellerShopApi.get).mockResolvedValueOnce(mockShop);

    render(<SellerShopScreen />);

    expect(await screen.findByDisplayValue('Dino Official Store')).toBeTruthy();
    expect(screen.getByDisplayValue('123 Đường Công Nghệ, Q.1, TP.HCM')).toBeTruthy();
    expect(screen.getByDisplayValue('0901234567')).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(screen.getByText(/Hãy điền địa chỉ shop/)).toBeTruthy();
  });


  it('allows saving updated shop details', async () => {
    vi.mocked(sellerShopApi.get).mockResolvedValueOnce(mockShop);
    vi.mocked(sellerShopApi.update).mockResolvedValueOnce({
      ...mockShop,
      shop_name: 'Dino Premium Store',
      status: 'ACTIVE',
    });

    const user = userEvent.setup();
    render(<SellerShopScreen />);

    const nameInput = await screen.findByDisplayValue('Dino Official Store');
    await user.clear(nameInput);
    await user.type(nameInput, 'Dino Premium Store');

    const saveButton = screen.getByRole('button', { name: 'Lưu hồ sơ' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(sellerShopApi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          shop_name: 'Dino Premium Store',
          pickup_province_code: '79',
          pickup_ward_code: '25747',
        }),
      );
    });
    expect(await screen.findByText('Đã lưu hồ sơ gian hàng.')).toBeTruthy();
  });

  it('uploads logo and updates shop profile', async () => {
    vi.mocked(sellerShopApi.get).mockResolvedValueOnce(mockShop);
    vi.mocked(uploadMediaAsset).mockResolvedValueOnce({
      mediaId: 'logo-media-123',
      url: 'https://cdn.example.com/logo.png',
    });
    vi.mocked(sellerShopApi.updateLogo).mockResolvedValueOnce({
      ...mockShop,
      logo_url: 'https://cdn.example.com/logo.png',
    });

    const user = userEvent.setup();
    render(<SellerShopScreen />);

    await screen.findByDisplayValue('Dino Official Store');

    const file = new File(['fake-image'], 'logo.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Tải ảnh logo gian hàng');

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(uploadMediaAsset).toHaveBeenCalledWith(file, { purpose: 'shop_logo' });
      expect(sellerShopApi.updateLogo).toHaveBeenCalledWith('logo-media-123');
    });

    expect(await screen.findByText('Đã cập nhật logo gian hàng thành công.')).toBeTruthy();
  });
});
