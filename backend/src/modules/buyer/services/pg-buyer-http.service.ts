import type { Pool } from 'pg';
import type { RequestContext } from '../../../contracts/request-context.contract.ts';
import { withTransaction } from '../../../../db/transaction.ts';
import { PgAddressRepository, PgCartRepository, PgVoucherRepository } from '../repositories/pg-buyer.repository.ts';
import { VoucherPortService } from './voucher-port.service.ts';
import { validateAddToCartDTO, validateCreateAddressDTO, validateUpdateCartItemDTO } from '../contracts/buyer.dto.ts';
import { ResourceNotFoundError } from '../domain/errors.ts';

export class PgBuyerHttpService {
  constructor(private readonly pool: Pool) {}

  async listAddresses(context: RequestContext): Promise<unknown[]> {
    return new PgAddressRepository(this.pool).findByUserId(context.user_id);
  }

  async createAddress(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    const validated = validateCreateAddressDTO(input);
    return new PgAddressRepository(this.pool).create({
      addressId: crypto.randomUUID(), userId: context.user_id,
      recipientName: validated.recipientName, phone: validated.phone.trim(), province: validated.province.trim(),
      district: validated.district.trim(), ward: validated.ward.trim(), detailAddress: validated.detailAddress.trim(),
      isDefault: validated.isDefault === true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }

  async getCart(context: RequestContext): Promise<unknown> {
    const repo = new PgCartRepository(this.pool); const cart = await repo.findByBuyerId(context.user_id);
    return cart ? { cart_id: cart.cartId, buyer_id: cart.buyerId, items: (await repo.getItems(cart.cartId)).map(item => ({ cart_item_id: item.cartItemId, variant_id: item.variantId, quantity: item.quantity, is_selected: item.isSelected })) } : { cart_id: null, buyer_id: context.user_id, items: [] };
  }

  async addCartItem(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    const validated = validateAddToCartDTO(input);
    return withTransaction(this.pool, async (client) => {
      const repo = new PgCartRepository(client); let cart = await repo.findByBuyerId(context.user_id);
      if (!cart) cart = await repo.createCart({ cartId: crypto.randomUUID(), buyerId: context.user_id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const item = await repo.addItem(cart.cartId, { cartItemId: crypto.randomUUID(), cartId: cart.cartId, variantId: validated.variantId, quantity: validated.quantity, isSelected: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return { cart_item_id: item.cartItemId, variant_id: item.variantId, quantity: item.quantity, is_selected: item.isSelected };
    });
  }

  async updateCartItem(context: RequestContext, itemId: string, input: Record<string, unknown>): Promise<unknown> {
    const validated = validateUpdateCartItemDTO(input);
    const repo = new PgCartRepository(this.pool); const cart = await repo.findByBuyerId(context.user_id); if (!cart) throw new ResourceNotFoundError('Cart not found');
    const items = await repo.getItems(cart.cartId); const current = items.find(item => item.cartItemId === itemId); if (!current) throw new ResourceNotFoundError('Cart item not found');
    const item = await repo.updateItem({ ...current, quantity: validated.quantity ?? current.quantity, isSelected: validated.isSelected ?? current.isSelected });
    return { cart_item_id: item.cartItemId, variant_id: item.variantId, quantity: item.quantity, is_selected: item.isSelected };
  }

  async deleteCartItem(context: RequestContext, itemId: string): Promise<void> {
    const repo = new PgCartRepository(this.pool); const cart = await repo.findByBuyerId(context.user_id); if (!cart) return;
    const items = await repo.getItems(cart.cartId);
    if (!items.some(item => item.cartItemId === itemId)) throw new ResourceNotFoundError('Cart item not found');
    await repo.removeItem(itemId);
  }

  async clearSelectedCartItems(context: RequestContext): Promise<void> {
    const repo = new PgCartRepository(this.pool);
    const cart = await repo.findByBuyerId(context.user_id);
    if (!cart) return;
    const selectedIds = (await repo.getItems(cart.cartId)).filter(item => item.isSelected).map(item => item.cartItemId);
    if (selectedIds.length > 0) await repo.clearCheckedOutItems(context.user_id, selectedIds);
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
