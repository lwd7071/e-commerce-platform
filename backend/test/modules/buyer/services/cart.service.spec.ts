import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CartService } from '../../../../src/modules/buyer/services/cart.service';
import {
  ResourceNotFoundError,
  ValidationError,
  InventoryInsufficientError,
} from '../../../../src/modules/buyer/domain/errors';
import type { ICartRepository } from '../../../../src/modules/buyer/domain/repositories';
import type { Cart, CartItem, UUID } from '../../../../src/modules/buyer/domain/types';
import type {
  ICatalogPort,
  VariantPriceAndStockDTO,
  LockVariantResultDTO,
} from '../../../../src/contracts/catalog.port';
import { mockBuyerId } from '../fixtures';

class MockCartRepository implements ICartRepository {
  public carts: Map<UUID, Cart> = new Map();
  public items: Map<UUID, CartItem> = new Map();

  async findByBuyerId(buyerId: UUID): Promise<Cart | null> {
    for (const cart of this.carts.values()) {
      if (cart.buyerId === buyerId) return cart;
    }
    return null;
  }

  async createCart(cart: Cart): Promise<Cart> {
    this.carts.set(cart.cartId, cart);
    return cart;
  }

  async getItems(cartId: UUID): Promise<CartItem[]> {
    return Array.from(this.items.values()).filter(item => item.cartId === cartId);
  }

  async addItem(cartId: UUID, item: CartItem): Promise<CartItem> {
    this.items.set(item.cartItemId, { ...item, cartId });
    return item;
  }

  async updateItem(item: CartItem): Promise<CartItem> {
    this.items.set(item.cartItemId, item);
    return item;
  }

  async removeItem(cartItemId: UUID): Promise<void> {
    this.items.delete(cartItemId);
  }

  async clearCheckedOutItems(_buyerId: UUID, cartItemIds: UUID[]): Promise<void> {
    for (const id of cartItemIds) {
      this.items.delete(id);
    }
  }
}

class MockCatalogPort implements ICatalogPort {
  public variants: Map<UUID, VariantPriceAndStockDTO> = new Map();

  setVariant(variant: VariantPriceAndStockDTO): void {
    this.variants.set(variant.variantId, variant);
  }

  async getVariantPriceAndStock(variantId: UUID): Promise<VariantPriceAndStockDTO> {
    const v = this.variants.get(variantId);
    if (!v) {
      throw new Error(`Variant not found: ${variantId}`);
    }
    return v;
  }

  async lockVariant(variantId: UUID, quantity: number): Promise<LockVariantResultDTO> {
    const v = this.variants.get(variantId);
    if (!v) throw new Error('Variant not found');
    return {
      variantId,
      requestedQuantity: quantity,
      priceSnapshot: v.price,
      remainingStock: v.stockQuantity - quantity,
    };
  }

  async checkShopActive(_shopId: UUID): Promise<boolean> {
    return true;
  }
}

describe('CartService Tests (TDD - Variant, Stock & Ownership)', () => {
  let cartRepo: MockCartRepository;
  let catalogPort: MockCatalogPort;
  let cartService: CartService;

  const activeVariantId = 'baaa1111-1111-4111-8111-111111111111';
  const inactiveVariantId = 'baaa2222-2222-4222-8222-222222222222';
  const otherBuyerId = '77777777-7777-4777-8777-777777777777';

  beforeEach(() => {
    cartRepo = new MockCartRepository();
    catalogPort = new MockCatalogPort();
    cartService = new CartService(cartRepo, catalogPort);

    catalogPort.setVariant({
      variantId: activeVariantId,
      productId: 'prod1111-1111-4111-8111-111111111111',
      variantName: 'Màu Đỏ',
      variantValue: 'Red-XL',
      price: '150000.00',
      stockQuantity: 10,
      status: 'ACTIVE',
    });

    catalogPort.setVariant({
      variantId: inactiveVariantId,
      productId: 'prod2222-2222-4222-8222-222222222222',
      variantName: 'Màu Xanh',
      variantValue: 'Blue-L',
      price: '120000.00',
      stockQuantity: 5,
      status: 'INACTIVE',
    });
  });

  describe('getCart', () => {
    it('tự động tạo cart mới nếu buyer chưa có giỏ hàng', async () => {
      const result = await cartService.getCart(mockBuyerId);
      assert.ok(result.cart);
      assert.equal(result.cart.buyerId, mockBuyerId);
      assert.deepEqual(result.items, []);
    });

    it('trả về cart và danh sách items khi đã có giỏ hàng', async () => {
      const cart = await cartRepo.createCart({
        cartId: 'cccc1111-1111-4111-8111-111111111111',
        buyerId: mockBuyerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await cartRepo.addItem(cart.cartId, {
        cartItemId: 'ciii1111-1111-4111-8111-111111111111',
        cartId: cart.cartId,
        variantId: activeVariantId,
        quantity: 2,
        isSelected: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await cartService.getCart(mockBuyerId);
      assert.equal(result.cart.cartId, cart.cartId);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].quantity, 2);
    });
  });

  describe('addItem', () => {
    it('thêm item mới vào giỏ khi variant ACTIVE và tồn kho đủ', async () => {
      const item = await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 3,
      });

      assert.equal(item.variantId, activeVariantId);
      assert.equal(item.quantity, 3);
      assert.equal(item.isSelected, true);

      const items = await cartRepo.getItems(item.cartId);
      assert.equal(items.length, 1);
    });

    it('cộng dồn số lượng khi variant đã có trong giỏ hàng', async () => {
      await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 2,
      });

      const updated = await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 3,
      });

      assert.equal(updated.quantity, 5);

      const cart = await cartRepo.findByBuyerId(mockBuyerId);
      const items = await cartRepo.getItems(cart!.cartId);
      assert.equal(items.length, 1);
      assert.equal(items[0].quantity, 5);
    });

    it('[RB-MG05] ném VALIDATION_FAILED khi quantity < 1', async () => {
      await assert.rejects(
        async () => cartService.addItem(mockBuyerId, {
          variantId: activeVariantId,
          quantity: 0,
        }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('ném VALIDATION_FAILED khi variant không tồn tại trong Catalog', async () => {
      await assert.rejects(
        async () => cartService.addItem(mockBuyerId, {
          variantId: 'baaa9999-9999-4999-8999-999999999999',
          quantity: 1,
        }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('ném VALIDATION_FAILED khi variant có status là INACTIVE', async () => {
      await assert.rejects(
        async () => cartService.addItem(mockBuyerId, {
          variantId: inactiveVariantId,
          quantity: 1,
        }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('ném 409 INVENTORY_INSUFFICIENT khi số lượng thêm vượt quá tồn kho', async () => {
      // Tồn kho activeVariantId là 10, yêu cầu 11
      await assert.rejects(
        async () => cartService.addItem(mockBuyerId, {
          variantId: activeVariantId,
          quantity: 11,
        }),
        (err: unknown) => err instanceof InventoryInsufficientError && err.code === 'INVENTORY_INSUFFICIENT'
      );
    });

    it('ném 409 INVENTORY_INSUFFICIENT khi cộng dồn vượt quá tồn kho', async () => {
      // Đã có 6 trong giỏ, thêm 5 (tổng 11 > tồn 10)
      await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 6,
      });

      await assert.rejects(
        async () => cartService.addItem(mockBuyerId, {
          variantId: activeVariantId,
          quantity: 5,
        }),
        (err: unknown) => err instanceof InventoryInsufficientError && err.code === 'INVENTORY_INSUFFICIENT'
      );
    });
  });

  describe('updateItem', () => {
    it('cập nhật số lượng và isSelected thành công khi tồn kho đủ', async () => {
      const added = await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 2,
      });

      const updated = await cartService.updateItem(mockBuyerId, added.cartItemId, {
        quantity: 8,
        isSelected: false,
      });

      assert.equal(updated.quantity, 8);
      assert.equal(updated.isSelected, false);
    });

    it('[auth-rbac-rls.md §3] ném 404 RESOURCE_NOT_FOUND khi cartItemId thuộc về giỏ của người khác', async () => {
      // Tạo item trong giỏ của buyer khác
      const otherItem = await cartService.addItem(otherBuyerId, {
        variantId: activeVariantId,
        quantity: 2,
      });

      await assert.rejects(
        async () => cartService.updateItem(mockBuyerId, otherItem.cartItemId, {
          quantity: 3,
        }),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });

    it('ném 409 INVENTORY_INSUFFICIENT khi updateItem vượt tồn kho', async () => {
      const added = await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 2,
      });

      // Tồn kho là 10, update thành 15
      await assert.rejects(
        async () => cartService.updateItem(mockBuyerId, added.cartItemId, {
          quantity: 15,
        }),
        (err: unknown) => err instanceof InventoryInsufficientError && err.code === 'INVENTORY_INSUFFICIENT'
      );
    });

    it('ném VALIDATION_FAILED khi variant chuyển sang INACTIVE lúc update', async () => {
      const added = await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 2,
      });

      // Chuyển variant sang INACTIVE
      catalogPort.setVariant({
        variantId: activeVariantId,
        productId: 'prod1111-1111-4111-8111-111111111111',
        variantName: 'Màu Đỏ',
        variantValue: 'Red-XL',
        price: '150000.00',
        stockQuantity: 10,
        status: 'INACTIVE',
      });

      await assert.rejects(
        async () => cartService.updateItem(mockBuyerId, added.cartItemId, {
          quantity: 3,
        }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('removeItem', () => {
    it('xoá thành công item trong giỏ của mình', async () => {
      const added = await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 2,
      });

      await cartService.removeItem(mockBuyerId, added.cartItemId);

      const cart = await cartRepo.findByBuyerId(mockBuyerId);
      const items = await cartRepo.getItems(cart!.cartId);
      assert.equal(items.length, 0);
    });

    it('[auth-rbac-rls.md §3] ném 404 RESOURCE_NOT_FOUND khi xoá item thuộc giỏ của buyer khác', async () => {
      const otherItem = await cartService.addItem(otherBuyerId, {
        variantId: activeVariantId,
        quantity: 2,
      });

      await assert.rejects(
        async () => cartService.removeItem(mockBuyerId, otherItem.cartItemId),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });
  });

  describe('clearCheckedOutItems', () => {
    it('xoá danh sách các item đã checkout của buyer', async () => {
      const item1 = await cartService.addItem(mockBuyerId, {
        variantId: activeVariantId,
        quantity: 1,
      });

      await cartService.clearCheckedOutItems(mockBuyerId, [item1.cartItemId]);

      const cart = await cartRepo.findByBuyerId(mockBuyerId);
      const items = await cartRepo.getItems(cart!.cartId);
      assert.equal(items.length, 0);
    });
  });
});
