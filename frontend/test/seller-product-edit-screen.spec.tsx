// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SellerProductEditScreen } from '@/features/seller/seller-product-edit-screen';
import { repositories } from '@/lib/repositories/repository-factory';
import { categoryAdapter } from '@/lib/adapters/category.adapter';
import { uploadMediaAsset } from '@/lib/api/media.api';
import type { WireCatalogProductDetail } from '@/lib/api/catalog.api';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'prod-001' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/adapters/category.adapter', () => ({
  categoryAdapter: {
    getCategories: vi.fn(),
  },
}));

vi.mock('@/lib/api/media.api', () => ({
  uploadMediaAsset: vi.fn(),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => vi.fn(),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockCatalogRepo = {
  getSellerProductById: vi.fn(),
  updateSellerProduct: vi.fn(),
};

vi.mock('@/lib/repositories/repository-factory', () => ({
  repositories: {
    catalog: () => mockCatalogRepo,
  },
}));

const mockDetail: WireCatalogProductDetail = {
  product_id: 'prod-001',
  shop_id: 'shop-001',
  category_id: 'cat-001',
  product_name: 'Áo thun cotton',
  description: 'Chất liệu thoáng mát',
  status: 'ACTIVE',
  variants: [
    {
      variant_id: 'var-001',
      variant_name: 'Size',
      variant_value: 'L',
      sku: 'SKU-AO-L',
      price: '199000.00',
      stock_quantity: 20,
      status: 'ACTIVE',
    },
  ],
  images: [
    {
      image_id: 'img-uuid-001',
      image_url: 'https://cdn.example.com/shirt-1.png',
      sort_order: 0,
    },
  ],
};

describe('SellerProductEditScreen UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoryAdapter.getCategories).mockResolvedValue([
      { id: 'cat-001', name: 'Thời trang nam', level: 0 },
    ]);
  });

  it('renders existing product information including image gallery', async () => {
    mockCatalogRepo.getSellerProductById.mockResolvedValueOnce(mockDetail);

    render(<SellerProductEditScreen />);

    expect(await screen.findByDisplayValue('Áo thun cotton')).toBeTruthy();
    expect(screen.getByDisplayValue('Chất liệu thoáng mát')).toBeTruthy();
    expect(screen.getByDisplayValue('SKU-AO-L')).toBeTruthy();
    expect(screen.getByAltText('Ảnh sản phẩm 1')).toBeTruthy();
    expect(screen.getByText('Đã thêm: 1/5 ảnh')).toBeTruthy();
  });

  it('uploads a new product image and allows removing an existing image', async () => {
    mockCatalogRepo.getSellerProductById.mockResolvedValueOnce(mockDetail);
    vi.mocked(uploadMediaAsset).mockResolvedValueOnce({
      mediaId: 'img-uuid-002',
      url: 'https://cdn.example.com/shirt-2.png',
    });

    const user = userEvent.setup();
    render(<SellerProductEditScreen />);

    await screen.findByDisplayValue('Áo thun cotton');

    const file = new File(['image-content'], 'shirt2.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Tải ảnh sản phẩm');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(uploadMediaAsset).toHaveBeenCalledWith(file, {
        purpose: 'product_image',
        productId: 'prod-001',
      });
      expect(screen.getByText('Đã thêm: 2/5 ảnh')).toBeTruthy();
    });

    const removeBtn = screen.getByLabelText('Xóa ảnh 1');
    await user.click(removeBtn);

    expect(screen.getByText('Đã thêm: 1/5 ảnh')).toBeTruthy();
  });

  it('submits updated product with variants and images', async () => {
    mockCatalogRepo.getSellerProductById.mockResolvedValueOnce(mockDetail);
    mockCatalogRepo.updateSellerProduct.mockResolvedValueOnce({
      ...mockDetail,
      product_name: 'Áo thun cotton cao cấp',
    });

    const user = userEvent.setup();
    render(<SellerProductEditScreen />);

    const nameInput = await screen.findByDisplayValue('Áo thun cotton');
    await user.clear(nameInput);
    await user.type(nameInput, 'Áo thun cotton cao cấp');

    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(mockCatalogRepo.updateSellerProduct).toHaveBeenCalledWith(
        'prod-001',
        expect.objectContaining({
          product_name: 'Áo thun cotton cao cấp',
          images: [
            {
              media_id: 'img-uuid-001',
              image_url: 'https://cdn.example.com/shirt-1.png',
              sort_order: 0,
            },
          ],
        }),
      );
    });
  });
});
