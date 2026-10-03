import { describe, it, expect, beforeEach } from 'vitest';
import type {
  IShopRepository,
  ICategoryRepository,
  IProductRepository,
  IProductVariantRepository,
} from '../../../src/modules/catalog/domain/repositories.ts';
import {
  InMemoryShopRepository,
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
} from '../../../src/modules/catalog/repositories/in-memory-catalog.repository.ts';

describe('Catalog Domain Repositories (TDD)', () => {
  let shopRepo: IShopRepository;
  let categoryRepo: ICategoryRepository;
  let productRepo: IProductRepository;
  let variantRepo: IProductVariantRepository;

  beforeEach(() => {
    shopRepo = new InMemoryShopRepository();
    categoryRepo = new InMemoryCategoryRepository();
    variantRepo = new InMemoryProductVariantRepository();
    productRepo = new InMemoryProductRepository(shopRepo, categoryRepo, variantRepo);
  });

  describe('ShopRepository', () => {
    it('creates and finds shop by ID and by owner ID', async () => {
      const shop = await shopRepo.create({
        shopId: 'shop-1',
        ownerId: 'owner-1',
        shopName: 'Test Shop 1',
        description: 'Description 1',
        logoUrl: 'https://example.com/logo.png',
        pickupAddress: '123 Test St',
        contactPhone: '0901234567',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const foundById = await shopRepo.findById('shop-1');
      expect(foundById).toEqual(shop);

      const foundByOwner = await shopRepo.findByOwnerId('owner-1');
      expect(foundByOwner).toEqual(shop);
    });

    it('updates shop status', async () => {
      await shopRepo.create({
        shopId: 'shop-2',
        ownerId: 'owner-2',
        shopName: 'Test Shop 2',
        description: null,
        logoUrl: null,
        pickupAddress: '456 Test St',
        contactPhone: '0907654321',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const updated = await shopRepo.updateStatus('shop-2', 'LOCKED');
      expect(updated.status).toBe('LOCKED');

      const found = await shopRepo.findById('shop-2');
      expect(found?.status).toBe('LOCKED');
    });
  });

  describe('CategoryRepository', () => {
    it('creates roots and child categories up to 2 levels', async () => {
      const root = await categoryRepo.create({
        categoryId: 'cat-root',
        parentCategoryId: null,
        categoryName: 'Electronics',
        description: 'Electronic gadgets',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const child = await categoryRepo.create({
        categoryId: 'cat-child',
        parentCategoryId: 'cat-root',
        categoryName: 'Smartphones',
        description: 'Mobile phones',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const roots = await categoryRepo.findRoots();
      expect(roots).toHaveLength(1);
      expect(roots[0].categoryId).toBe('cat-root');
      expect(root.categoryName).toBe('Electronics');

      const children = await categoryRepo.findChildren('cat-root');
      expect(children).toHaveLength(1);
      expect(children[0].categoryId).toBe('cat-child');
      expect(child.categoryName).toBe('Smartphones');
    });
  });

  describe('ProductRepository & Public Query/Filter/Sort/Visibility', () => {
    beforeEach(async () => {
      // Setup active shop and categories
      await shopRepo.create({
        shopId: 's-active',
        ownerId: 'u-1',
        shopName: 'Active Shop',
        description: null,
        logoUrl: null,
        pickupAddress: 'Address',
        contactPhone: '0123456789',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await shopRepo.create({
        shopId: 's-locked',
        ownerId: 'u-2',
        shopName: 'Locked Shop',
        description: null,
        logoUrl: null,
        pickupAddress: 'Address',
        contactPhone: '0123456789',
        status: 'LOCKED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await categoryRepo.create({
        categoryId: 'c-phones',
        parentCategoryId: null,
        categoryName: 'Phones',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await categoryRepo.create({
        categoryId: 'c-laptops',
        parentCategoryId: null,
        categoryName: 'Laptops',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Product 1: Active in Active Shop ()
      await productRepo.create(
        {
          productId: 'p-1',
          shopId: 's-active',
          categoryId: 'c-phones',
          productName: 'iPhone 15 Pro',
          description: 'Flagship phone',
          status: 'ACTIVE',
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
        },
        [
          {
            variantId: 'v-1',
            productId: 'p-1',
            variantName: '128GB',
            variantValue: 'Black',
            sku: 'IPHONE15-128',
            price: '100.00',
            stockQuantity: 10,
            status: 'ACTIVE',
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-01T10:00:00.000Z',
          },
        ]
      );

      // Product 2: Active in Active Shop ()
      await productRepo.create(
        {
          productId: 'p-2',
          shopId: 's-active',
          categoryId: 'c-laptops',
          productName: 'MacBook Air M2',
          description: 'Slim laptop',
          status: 'ACTIVE',
          createdAt: '2026-09-02T10:00:00.000Z',
          updatedAt: '2026-09-02T10:00:00.000Z',
        },
        [
          {
            variantId: 'v-2',
            productId: 'p-2',
            variantName: '256GB',
            variantValue: 'Silver',
            sku: 'MACBOOK-256',
            price: '250.00',
            stockQuantity: 5,
            status: 'ACTIVE',
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
          },
        ]
      );

      // Product 3: INACTIVE product in Active Shop ()
      await productRepo.create(
        {
          productId: 'p-3',
          shopId: 's-active',
          categoryId: 'c-phones',
          productName: 'Old Phone',
          description: null,
          status: 'INACTIVE',
          createdAt: '2026-09-03T10:00:00.000Z',
          updatedAt: '2026-09-03T10:00:00.000Z',
        },
        [
          {
            variantId: 'v-3',
            productId: 'p-3',
            variantName: 'Default',
            variantValue: null,
            sku: 'OLDPHONE',
            price: '50.00',
            stockQuantity: 0,
            status: 'ACTIVE',
            createdAt: '2026-09-03T10:00:00.000Z',
            updatedAt: '2026-09-03T10:00:00.000Z',
          },
        ]
      );

      // Product 4: Active product in LOCKED Shop ()
      await productRepo.create(
        {
          productId: 'p-4',
          shopId: 's-locked',
          categoryId: 'c-phones',
          productName: 'Locked Shop Phone',
          description: null,
          status: 'ACTIVE',
          createdAt: '2026-09-04T10:00:00.000Z',
          updatedAt: '2026-09-04T10:00:00.000Z',
        },
        [
          {
            variantId: 'v-4',
            productId: 'p-4',
            variantName: 'Default',
            variantValue: null,
            sku: 'LOCKED-P',
            price: '300.00',
            stockQuantity: 5,
            status: 'ACTIVE',
            createdAt: '2026-09-04T10:00:00.000Z',
            updatedAt: '2026-09-04T10:00:00.000Z',
          },
        ]
      );
    });

    it('visibility rule: returns only ACTIVE products from ACTIVE shops', async () => {
      const result = await productRepo.queryPublic({});
      expect(result.total).toBe(2);
      const productIds = result.items.map((p) => p.productId);
      expect(productIds).toContain('p-1');
      expect(productIds).toContain('p-2');
      expect(productIds).not.toContain('p-3'); // Inactive
      expect(productIds).not.toContain('p-4'); // Locked Shop
    });

    it('filters by categoryId', async () => {
      const result = await productRepo.queryPublic({ categoryId: 'c-phones' });
      expect(result.total).toBe(1);
      expect(result.items[0].productId).toBe('p-1');
    });

    it('filters by search keyword', async () => {
      const result = await productRepo.queryPublic({ search: 'macbook' });
      expect(result.total).toBe(1);
      expect(result.items[0].productId).toBe('p-2');
    });

    it('filters by price range', async () => {
      const result = await productRepo.queryPublic({ minPrice: 150, maxPrice: 300 });
      expect(result.total).toBe(1);
      expect(result.items[0].productId).toBe('p-2');
    });

    it('sorts by price asc and price desc', async () => {
      const asc = await productRepo.queryPublic({ sortBy: 'price_asc' });
      expect(asc.items[0].productId).toBe('p-1');
      expect(asc.items[1].productId).toBe('p-2');

      const desc = await productRepo.queryPublic({ sortBy: 'price_desc' });
      expect(desc.items[0].productId).toBe('p-2');
      expect(desc.items[1].productId).toBe('p-1');
    });

    it('supports pagination with limit and offset', async () => {
      const page1 = await productRepo.queryPublic({ limit: 1, offset: 0 });
      expect(page1.items).toHaveLength(1);
      expect(page1.total).toBe(2);

      const page2 = await productRepo.queryPublic({ limit: 1, offset: 1 });
      expect(page2.items).toHaveLength(1);
      expect(page2.total).toBe(2);
      expect(page2.items[0].productId).not.toBe(page1.items[0].productId);
    });
  });
});
