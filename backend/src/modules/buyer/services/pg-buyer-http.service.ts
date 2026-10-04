import type { Pool } from 'pg';
import type { RequestContext } from '../../../contracts/request-context.contract.ts';
import { withTransaction } from '../../../../db/transaction.ts';
import { PgAddressRepository, PgCartRepository, PgVoucherRepository } from '../repositories/pg-buyer.repository.ts';
import { VoucherPortService } from './voucher-port.service.ts';
import { validateAddToCartDTO, validateCreateAddressDTO, validateUpdateCartItemDTO } from '../contracts/buyer.dto.ts';
import { InventoryInsufficientError, ResourceNotFoundError } from '../domain/errors.ts';

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
      provinceCode: validated.provinceCode ?? null, district: validated.district ?? null, ward: validated.ward.trim(), wardCode: validated.wardCode ?? null, detailAddress: validated.detailAddress.trim(),
      isDefault: validated.isDefault === true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }

  async getCart(context: RequestContext): Promise<unknown> {
    const cart = await this.pool.query<{ cart_id: string }>('SELECT cart_id FROM carts WHERE buyer_id=$1', [context.user_id]);
    if (!cart.rows[0]) return { cart_id: null, buyer_id: context.user_id, items: [] };
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ci.cart_item_id,ci.variant_id,p.product_id,p.product_name,
              concat_ws(' ',nullif(btrim(v.variant_name),''),nullif(btrim(v.variant_value),'')) AS variant_name,
              v.price::text AS price,v.stock_quantity,s.shop_id,s.shop_name,
              primary_image.image_url,
              CASE WHEN p.status='ACTIVE' THEN 'ACTIVE' ELSE 'INACTIVE' END AS product_status,
              v.status AS variant_status,s.status AS shop_status,
              (p.status='ACTIVE' AND v.status='ACTIVE' AND s.status='ACTIVE' AND v.stock_quantity>=ci.quantity) AS is_available,
              ci.quantity,ci.is_selected
       FROM cart_items ci
       JOIN product_variants v ON v.variant_id=ci.variant_id
       JOIN products p ON p.product_id=v.product_id
       JOIN shops s ON s.shop_id=p.shop_id
       LEFT JOIN LATERAL (
         SELECT image_url FROM product_images pi WHERE pi.product_id=p.product_id ORDER BY pi.sort_order,pi.image_id LIMIT 1
       ) primary_image ON TRUE
       WHERE ci.cart_id=$1
       ORDER BY ci.created_at,ci.cart_item_id`, [cart.rows[0].cart_id],
    );
    return {
      cart_id: cart.rows[0].cart_id,
      buyer_id: context.user_id,
      items: result.rows.map(row => ({
        cart_item_id: String(row.cart_item_id),
        variant_id: String(row.variant_id),
        product_id: String(row.product_id),
        product_name: String(row.product_name),
        variant_name: String(row.variant_name ?? ''),
        price: String(row.price),
        stock_quantity: Number(row.stock_quantity),
        shop_id: String(row.shop_id),
        shop_name: String(row.shop_name),
        image_url: row.image_url == null ? null : String(row.image_url),
        product_status: row.product_status as 'ACTIVE' | 'INACTIVE',
        variant_status: row.variant_status as 'ACTIVE' | 'INACTIVE',
        shop_status: String(row.shop_status),
        is_available: row.is_available === true,
        quantity: Number(row.quantity),
        is_selected: row.is_selected === true,
      })),
    };
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
    return withTransaction(this.pool, async (client) => {
      const repo = new PgCartRepository(client);
      const cart = await repo.findByBuyerId(context.user_id);
      if (!cart) throw new ResourceNotFoundError('Cart not found');
      const items = await repo.getItems(cart.cartId);
      const current = items.find(item => item.cartItemId === itemId);
      if (!current) throw new ResourceNotFoundError('Cart item not found');

      if (validated.quantity !== undefined) {
        const variant = await client.query<{ stock_quantity: number }>(
          'SELECT stock_quantity FROM product_variants WHERE variant_id=$1 FOR UPDATE',
          [current.variantId],
        );
        if (!variant.rows[0]) throw new ResourceNotFoundError('Product variant not found');
        const stock = Number(variant.rows[0].stock_quantity);
        if (validated.quantity > stock) {
          throw new InventoryInsufficientError('Requested cart quantity exceeds available stock.', {
            variantId: current.variantId,
            requested: validated.quantity,
            available: stock,
          });
        }
      }

      const item = await repo.updateItem({
        ...current,
        quantity: validated.quantity ?? current.quantity,
        isSelected: validated.isSelected ?? current.isSelected,
      });
      return { cart_item_id: item.cartItemId, variant_id: item.variantId, quantity: item.quantity, is_selected: item.isSelected };
    });
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
