import { randomUUID } from 'node:crypto';
import type { ICartRepository } from '../domain/repositories';
import type { Cart, CartItem, UUID } from '../domain/types';
import type { ICatalogPort, VariantPriceAndStockDTO } from '../../../contracts/catalog.port';
import {
  ResourceNotFoundError,
  ValidationError,
  InventoryInsufficientError,
} from '../domain/errors';
import {
  validateAddToCartDTO,
  validateUpdateCartItemDTO,
  type AddToCartDTO,
  type UpdateCartItemDTO,
} from '../contracts/buyer.dto';

/**
 * Service quản lý giỏ hàng của người mua (Cart & CartItem).
 * Áp dụng:
 * - [ICatalogPort]: Kiểm tra trạng thái ACTIVE và số lượng tồn kho trước khi thêm/sửa giỏ hàng.
 * - [INVENTORY_INSUFFICIENT (409)]: Khi số lượng vượt quá tồn kho (error-observability.md).
 * - [auth-rbac-rls.md §3]: Trả về 404 RESOURCE_NOT_FOUND khi cartItemId không thuộc về caller.
 */
export class CartService {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly catalogPort: ICatalogPort
  ) {}

  private async getOrCreateCart(buyerId: UUID): Promise<Cart> {
    const existing = await this.cartRepo.findByBuyerId(buyerId);
    if (existing) {
      return existing;
    }
    const now = new Date().toISOString();
    const newCart: Cart = {
      cartId: randomUUID(),
      buyerId,
      createdAt: now,
      updatedAt: now,
    };
    return this.cartRepo.createCart(newCart);
  }

  async getCart(buyerId: UUID): Promise<{ cart: Cart; items: CartItem[] }> {
    const cart = await this.getOrCreateCart(buyerId);
    const items = await this.cartRepo.getItems(cart.cartId);
    return { cart, items };
  }

  async addItem(buyerId: UUID, rawInput: unknown): Promise<CartItem> {
    const validated: AddToCartDTO = validateAddToCartDTO(rawInput);

    let variant: VariantPriceAndStockDTO;
    try {
      variant = await this.catalogPort.getVariantPriceAndStock(validated.variantId);
    } catch {
      throw new ValidationError('Variant không tồn tại trong hệ thống.', { variantId: validated.variantId });
    }

    if (!variant || variant.status !== 'ACTIVE') {
      throw new ValidationError('Variant không còn hoạt động hoặc không tồn tại.', {
        variantId: validated.variantId,
        status: variant?.status,
      });
    }

    const cart = await this.getOrCreateCart(buyerId);
    const existingItems = await this.cartRepo.getItems(cart.cartId);
    const existing = existingItems.find(i => i.variantId === validated.variantId);

    const totalQuantity = (existing?.quantity ?? 0) + validated.quantity;

    if (totalQuantity > variant.stockQuantity) {
      throw new InventoryInsufficientError('Số lượng yêu cầu vượt quá tồn kho hiện có.', {
        variantId: validated.variantId,
        requestedQuantity: totalQuantity,
        availableStock: variant.stockQuantity,
      });
    }

    const now = new Date().toISOString();
    if (existing) {
      const updatedItem: CartItem = {
        ...existing,
        quantity: totalQuantity,
        updatedAt: now,
      };
      return this.cartRepo.updateItem(updatedItem);
    }

    const newItem: CartItem = {
      cartItemId: randomUUID(),
      cartId: cart.cartId,
      variantId: validated.variantId,
      quantity: validated.quantity,
      isSelected: true,
      createdAt: now,
      updatedAt: now,
    };
    return this.cartRepo.addItem(cart.cartId, newItem);
  }

  async updateItem(buyerId: UUID, cartItemId: UUID, rawInput: unknown): Promise<CartItem> {
    const validated: UpdateCartItemDTO = validateUpdateCartItemDTO(rawInput);

    const cart = await this.cartRepo.findByBuyerId(buyerId);
    if (!cart) {
      throw new ResourceNotFoundError('Cart not found', { buyerId });
    }

    const items = await this.cartRepo.getItems(cart.cartId);
    const item = items.find(i => i.cartItemId === cartItemId);
    if (!item) {
      throw new ResourceNotFoundError('Cart item not found', { cartItemId });
    }

    if (validated.quantity !== undefined) {
      let variant: VariantPriceAndStockDTO;
      try {
        variant = await this.catalogPort.getVariantPriceAndStock(item.variantId);
      } catch {
        throw new ValidationError('Variant không tồn tại trong hệ thống.', { variantId: item.variantId });
      }

      if (!variant || variant.status !== 'ACTIVE') {
        throw new ValidationError('Variant không còn hoạt động hoặc không tồn tại.', {
          variantId: item.variantId,
          status: variant?.status,
        });
      }

      if (validated.quantity > variant.stockQuantity) {
        throw new InventoryInsufficientError('Số lượng yêu cầu vượt quá tồn kho hiện có.', {
          variantId: item.variantId,
          requestedQuantity: validated.quantity,
          availableStock: variant.stockQuantity,
        });
      }

      item.quantity = validated.quantity;
    }

    if (validated.isSelected !== undefined) {
      item.isSelected = validated.isSelected;
    }

    item.updatedAt = new Date().toISOString();
    return this.cartRepo.updateItem(item);
  }

  async removeItem(buyerId: UUID, cartItemId: UUID): Promise<void> {
    const cart = await this.cartRepo.findByBuyerId(buyerId);
    if (!cart) {
      throw new ResourceNotFoundError('Cart not found', { buyerId });
    }

    const items = await this.cartRepo.getItems(cart.cartId);
    const item = items.find(i => i.cartItemId === cartItemId);
    if (!item) {
      throw new ResourceNotFoundError('Cart item not found', { cartItemId });
    }

    await this.cartRepo.removeItem(cartItemId);
  }

  async clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void> {
    await this.cartRepo.clearCheckedOutItems(buyerId, cartItemIds);
  }
}
