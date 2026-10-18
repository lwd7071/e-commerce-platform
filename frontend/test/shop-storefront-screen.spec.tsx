// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopStorefrontScreen } from '@/features/catalog/shop-storefront-screen';

const mocks = vi.hoisted(() => ({ getPublicShop: vi.fn(), getProductsPaginated: vi.fn() }));

vi.mock('@/lib/repositories/repository-factory', () => ({
  repositories: { catalog: () => mocks },
}));

describe('Shop storefront', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicShop.mockResolvedValue({ shop_id: 'shop-1', shop_name: 'Dino Shop', shop_tier: 'PREFERRED' });
    mocks.getProductsPaginated.mockResolvedValue({
      data: [{ product_id: 'product-1', product_name: 'Hạt điều rang', shop_id: 'shop-1', category_id: 'food', min_price: '45000', max_price: '45000', total_stock: 12, image_url: null, created_at: '2026-01-01' }],
      meta: { limit: 20, has_more: false, next_cursor: null },
    });
  });

  afterEach(() => cleanup());

  it('shows the shop identity and only requests products scoped to that shop', async () => {
    render(<ShopStorefrontScreen shopId="shop-1" />);

    expect(await screen.findByRole('heading', { name: 'Dino Shop' })).toBeTruthy();
    expect(screen.getByText('Yêu thích')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Chi tiết sản phẩm Hạt điều rang' })).toBeTruthy();
    expect(mocks.getProductsPaginated).toHaveBeenCalledWith({ shop_id: 'shop-1', limit: 20, sort: 'created_at_desc' });
  });

  it('shows a clear empty state when the shop has no active products', async () => {
    mocks.getPublicShop.mockResolvedValueOnce({ shop_id: 'empty-shop-1', shop_name: 'Shop mới', shop_tier: 'STANDARD' });
    mocks.getProductsPaginated.mockResolvedValueOnce({
      data: [],
      meta: { limit: 20, has_more: false, next_cursor: null },
    });
    render(<ShopStorefrontScreen shopId="empty-shop-1" />);

    expect(await screen.findByRole('heading', { name: 'Shop chưa có sản phẩm đang bán' })).toBeTruthy();
  });

  it('does not request products for a missing or inactive shop', async () => {
    mocks.getPublicShop.mockRejectedValueOnce(new Error('Not found'));
    render(<ShopStorefrontScreen shopId="missing-shop" />);

    expect(await screen.findByRole('heading', { name: 'Không tìm thấy gian hàng' })).toBeTruthy();
    expect(mocks.getProductsPaginated).not.toHaveBeenCalled();
  });
});
