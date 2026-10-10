import type { Cart, CartItem, Voucher, VoucherUsage, UUID } from '../../../src/modules/buyer/domain/types';
import type { ICartRepository, IVoucherRepository } from '../../../src/modules/buyer/domain/repositories';

export class InMemoryCartRepository implements ICartRepository {
  private carts: Map<UUID, Cart> = new Map();
  private items: Map<UUID, CartItem> = new Map();

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
    this.items.set(item.cartItemId, item);
    return item;
  }

  async updateItem(item: CartItem): Promise<CartItem> {
    this.items.set(item.cartItemId, item);
    return item;
  }

  async removeItem(cartItemId: UUID): Promise<void> {
    this.items.delete(cartItemId);
  }

  async clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void> {
    for (const id of cartItemIds) {
      this.items.delete(id);
    }
  }
}

export class InMemoryVoucherRepository implements IVoucherRepository {
  public vouchers: Map<UUID, Voucher> = new Map();
  public usages: Map<UUID, VoucherUsage> = new Map();

  async findById(voucherId: UUID): Promise<Voucher | null> {
    return this.vouchers.get(voucherId) ?? null;
  }

  async findByCode(code: string): Promise<Voucher | null> {
    const normalized = code.trim().toUpperCase();
    for (const v of this.vouchers.values()) {
      if (v.code.trim().toUpperCase() === normalized) return v;
    }
    return null;
  }

  async listActive(scope?: 'PLATFORM' | 'SHOP', shopId?: UUID): Promise<Voucher[]> {
    return Array.from(this.vouchers.values()).filter(v => {
      if (v.status !== 'ACTIVE') return false;
      if (scope && v.scope !== scope) return false;
      if (shopId && v.shopId !== shopId) return false;
      return true;
    });
  }

  async create(voucher: Voucher): Promise<Voucher> {
    this.vouchers.set(voucher.voucherId, voucher);
    return voucher;
  }

  async decrementQuantity(voucherId: UUID): Promise<boolean> {
    const v = this.vouchers.get(voucherId);
    if (!v || v.quantity <= 0) return false;
    v.quantity -= 1;
    return true;
  }

  async incrementQuantity(voucherId: UUID): Promise<boolean> {
    const v = this.vouchers.get(voucherId);
    if (!v) return false;
    v.quantity += 1;
    return true;
  }

  async recordUsage(usage: VoucherUsage): Promise<VoucherUsage> {
    this.usages.set(usage.usageId, usage);
    return usage;
  }
}
