import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type {
  IShopRepository,
  ICategoryRepository,
  IProductRepository,
} from '../../../src/modules/catalog/domain/repositories.ts';
import {
  InMemoryShopRepository,
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
} from '../../../src/modules/catalog/repositories/in-memory-catalog.repository.ts';

describe('Catalog Domain Repositories (Node native spec)', () => {
  let shopRepo: IShopRepository;
  let categoryRepo: ICategoryRepository;
  let productRepo: IProductRepository;
  let variantRepo: InMemoryProductVariantRepository;

  beforeEach(() => {
    shopRepo = new InMemoryShopRepository();
    categoryRepo = new InMemoryCategoryRepository();
    variantRepo = new InMemoryProductVariantRepository();
    productRepo = new InMemoryProductRepository(shopRepo, categoryRepo, variantRepo);
  });

  describe('Shop & Category Repositories', () => {
    it('creates and finds shop by ID and owner ID', async () => {
      const shop = await shopRepo.create({
        shopId: 's-1',
        ownerId: 'o-1',
        shopName: 'Shop One',
        description: null,
        logoUrl: null,
        pickupAddress: 'Street 1',
        contactPhone: '0901234567',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const found = await shopRepo.findById('s-1');
      assert.deepEqual(found, shop);
    });

    it('creates category tree with roots and children', async () => {
      await categoryRepo.create({
        categoryId: 'cat-root',
        parentCategoryId: null,
        categoryName: 'Tech',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await categoryRepo.create({
        categoryId: 'cat-child',
        parentCategoryId: 'cat-root',
        categoryName: 'Laptops',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const roots = await categoryRepo.findRoots();
      assert.equal(roots.length, 1);
      const children = await categoryRepo.findChildren('cat-root');
      assert.equal(children.length, 1);
    });
  });

  describe('Product Query & Visibility', () => {
    it('filters active products and excludes locked shops', async () => {
      await shopRepo.create({
        shopId: 's-active',
        ownerId: 'o-1',
        shopName: 'Active Shop',
        description: null,
        logoUrl: null,
        pickupAddress: 'Addr',
        contactPhone: '0901234567',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await shopRepo.create({
        shopId: 's-locked',
        ownerId: 'o-2',
        shopName: 'Locked Shop',
        description: null,
        logoUrl: null,
        pickupAddress: 'Addr',
        contactPhone: '0901234567',
        status: 'LOCKED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await categoryRepo.create({
        categoryId: 'cat-active',
        parentCategoryId: null,
        categoryName: 'Active Cat',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await productRepo.create(
        {
          productId: 'p-act',
          shopId: 's-active',
          categoryId: 'cat-active',
          productName: 'Visible Product',
          description: null,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        [
          {
            variantId: 'v-act',
            productId: 'p-act',
            variantName: 'Default',
            variantValue: 'Default',
            sku: 'VIS-01',
            price: '150.00',
            stockQuantity: 10,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]
      );

      await productRepo.create(
        {
          productId: 'p-lock',
          shopId: 's-locked',
          categoryId: 'cat-active',
          productName: 'Hidden Product',
          description: null,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        [
          {
            variantId: 'v-lock',
            productId: 'p-lock',
            variantName: 'Default',
            variantValue: 'Default',
            sku: 'HID-01',
            price: '200.00',
            stockQuantity: 5,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]
      );

      const res = await productRepo.queryPublic({});
      assert.equal(res.total, 1);
      assert.equal(res.items[0].productId, 'p-act');
    });
  });
});
