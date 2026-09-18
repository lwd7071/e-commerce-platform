import type { Pool } from 'pg';
import type { RequestContext } from '../../../contracts/request-context.contract.ts';
import { withTransaction } from '../../../../db/transaction.ts';
import { PgAddressRepository, PgCartRepository, PgVoucherRepository } from '../repositories/pg-buyer.repository.ts';
import { VoucherPortService } from './voucher-port.service.ts';

export class PgBuyerHttpService {
  constructor(private readonly pool: Pool) {}

  async listAddresses(context: RequestContext): Promise<unknown[]> {
    return new PgAddressRepository(this.pool).findByUserId(context.user_id);
  }

  async createAddress(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    const required = ['recipient_name', 'phone', 'province', 'district', 'ward', 'detail_address'];
    for (const field of required) if (typeof input[field] !== 'string' || !(input[field] as string).trim()) throw new Error(`Invalid ${field}`);
    return new PgAddressRepository(this.pool).create({
      addressId: crypto.randomUUID(), userId: context.user_id,
      recipientName: String(input.recipient_name).trim(), phone: String(input.phone).trim(), province: String(input.province).trim(),
      district: String(input.district).trim(), ward: String(input.ward).trim(), detailAddress: String(input.detail_address).trim(),
      isDefault: input.is_default === true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }

  async getCart(context: RequestContext): Promise<unknown> {
    const repo = new PgCartRepository(this.pool); const cart = await repo.findByBuyerId(context.user_id);
    return cart ? { cart_id: cart.cartId, buyer_id: cart.buyerId, items: (await repo.getItems(cart.cartId)).map(item => ({ cart_item_id: item.cartItemId, variant_id: item.variantId, quantity: item.quantity, is_selected: item.isSelected })) } : { cart_id: null, buyer_id: context.user_id, items: [] };
  }

  async addCartItem(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    return withTransaction(this.pool, async (client) => {
      const repo = new PgCartRepository(client); let cart = await repo.findByBuyerId(context.user_id);
      if (!cart) cart = await repo.createCart({ cartId: crypto.randomUUID(), buyerId: context.user_id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const item = await repo.addItem(cart.cartId, { cartItemId: crypto.randomUUID(), cartId: cart.cartId, variantId: String(input.variant_id), quantity: Number(input.quantity), isSelected: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return { cart_item_id: item.cartItemId, variant_id: item.variantId, quantity: item.quantity, is_selected: item.isSelected };
    });
  }

  async updateCartItem(context: RequestContext, itemId: string, input: Record<string, unknown>): Promise<unknown> {
    const repo = new PgCartRepository(this.pool); const cart = await repo.findByBuyerId(context.user_id); if (!cart) throw new Error('Cart not found');
    const items = await repo.getItems(cart.cartId); const current = items.find(item => item.cartItemId === itemId); if (!current) throw new Error('Cart item not found');
    const item = await repo.updateItem({ ...current, quantity: input.quantity === undefined ? current.quantity : Number(input.quantity), isSelected: input.is_selected === undefined ? current.isSelected : Boolean(input.is_selected) });
    return { cart_item_id: item.cartItemId, variant_id: item.variantId, quantity: item.quantity, is_selected: item.isSelected };
  }

  async deleteCartItem(context: RequestContext, itemId: string): Promise<void> {
    const repo = new PgCartRepository(this.pool); const cart = await repo.findByBuyerId(context.user_id); if (cart) await repo.removeItem(itemId);
  }

  async applicableVouchers(_context: RequestContext, input: Record<string, unknown>): Promise<unknown[]> {
    return new PgVoucherRepository(this.pool).listActive(input.scope as 'PLATFORM' | 'SHOP' | undefined, input.shop_id as string | undefined);
  }

  async evaluateVoucher(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    const subtotal = String(input.order_subtotal ?? '0.00');
    const service = new VoucherPortService(new PgVoucherRepository(this.pool));
    return service.evaluateVoucher({ code: String(input.code ?? ''), buyerId: context.user_id, shopId: String(input.shop_id ?? ''), orderSubtotal: subtotal });
  }
}
