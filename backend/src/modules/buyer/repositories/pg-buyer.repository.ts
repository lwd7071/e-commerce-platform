import type { Pool, PoolClient } from 'pg';
import type { Address, Cart, CartItem, UUID, Voucher, VoucherUsage } from '../domain/types.ts';
import type { IAddressRepository, ICartRepository, IVoucherRepository } from '../domain/repositories.ts';

type Runner = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);

const mapAddress = (row: any): Address => ({
  addressId: row.address_id, userId: row.user_id, recipientName: row.recipient_name, phone: row.phone,
  province: row.province, district: row.district, ward: row.ward, detailAddress: row.detail_address,
  isDefault: row.is_default, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
});

const mapCart = (row: any): Cart => ({ cartId: row.cart_id, buyerId: row.buyer_id, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const mapItem = (row: any): CartItem => ({
  cartItemId: row.cart_item_id, cartId: row.cart_id, variantId: row.variant_id, quantity: Number(row.quantity),
  isSelected: row.is_selected, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
});
const mapVoucher = (row: any): Voucher => ({
  voucherId: row.voucher_id, code: row.code, voucherName: row.voucher_name, scope: row.scope, shopId: row.shop_id,
  discountType: row.discount_type, discountValue: String(row.discount_value), maxDiscount: row.max_discount == null ? null : String(row.max_discount),
  minOrderValue: String(row.min_order_value), quantity: Number(row.quantity), startAt: iso(row.start_at), endAt: iso(row.end_at),
  status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
});

export class PgAddressRepository implements IAddressRepository {
  constructor(private readonly db: Runner) {}
  async findById(addressId: UUID): Promise<Address | null> {
    const result = await this.db.query('SELECT * FROM addresses WHERE address_id = $1', [addressId]);
    return result.rows[0] ? mapAddress(result.rows[0]) : null;
  }
  async findOwnedSnapshot(userId: UUID, addressId: UUID): Promise<Address | null> {
    const result = await this.db.query('SELECT * FROM addresses WHERE address_id = $1 AND user_id = $2', [addressId, userId]);
    return result.rows[0] ? mapAddress(result.rows[0]) : null;
  }
  async findByUserId(userId: UUID): Promise<Address[]> {
    const result = await this.db.query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC', [userId]);
    return result.rows.map(mapAddress);
  }
  async create(address: Address): Promise<Address> {
    const result = await this.db.query(
      `INSERT INTO addresses (address_id,user_id,recipient_name,phone,province,district,ward,detail_address,is_default,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [address.addressId, address.userId, address.recipientName, address.phone, address.province, address.district, address.ward, address.detailAddress, address.isDefault, address.createdAt],
    );
    return mapAddress(result.rows[0]);
  }
  async update(address: Address): Promise<Address> { throw new Error('Address update is outside T1'); }
  async delete(_addressId: UUID): Promise<void> { throw new Error('Address delete is outside T1'); }
  async setDefault(_userId: UUID, _targetAddressId: UUID): Promise<void> { throw new Error('Address set-default is outside T1'); }
}

export class PgCartRepository implements ICartRepository {
  constructor(private readonly db: Runner) {}
  async findByBuyerId(buyerId: UUID): Promise<Cart | null> {
    const result = await this.db.query('SELECT * FROM carts WHERE buyer_id = $1', [buyerId]);
    return result.rows[0] ? mapCart(result.rows[0]) : null;
  }
  async createCart(cart: Cart): Promise<Cart> {
    const result = await this.db.query('INSERT INTO carts (cart_id,buyer_id,created_at,updated_at) VALUES ($1,$2,$3,$3) RETURNING *', [cart.cartId, cart.buyerId, cart.createdAt]);
    return mapCart(result.rows[0]);
  }
  async getItems(cartId: UUID): Promise<CartItem[]> {
    const result = await this.db.query('SELECT * FROM cart_items WHERE cart_id = $1 ORDER BY created_at ASC', [cartId]);
    return result.rows.map(mapItem);
  }
  async addItem(cartId: UUID, item: CartItem): Promise<CartItem> {
    const result = await this.db.query(
      `INSERT INTO cart_items (cart_item_id,cart_id,variant_id,quantity,is_selected,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       ON CONFLICT (cart_id,variant_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()
       RETURNING *`,
      [item.cartItemId, cartId, item.variantId, item.quantity, item.isSelected, item.createdAt],
    );
    return mapItem(result.rows[0]);
  }
  async updateItem(item: CartItem): Promise<CartItem> {
    const result = await this.db.query('UPDATE cart_items SET quantity=$1,is_selected=$2,updated_at=now() WHERE cart_item_id=$3 RETURNING *', [item.quantity, item.isSelected, item.cartItemId]);
    return mapItem(result.rows[0]);
  }
  async removeItem(cartItemId: UUID): Promise<void> { await this.db.query('DELETE FROM cart_items WHERE cart_item_id = $1', [cartItemId]); }
  async clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void> {
    await this.db.query('DELETE FROM cart_items ci USING carts c WHERE ci.cart_id=c.cart_id AND c.buyer_id=$1 AND ci.cart_item_id = ANY($2::uuid[])', [buyerId, cartItemIds]);
  }
}

export class PgVoucherRepository implements IVoucherRepository {
  constructor(private readonly db: Runner) {}
  async findById(voucherId: UUID): Promise<Voucher | null> { const r = await this.db.query('SELECT * FROM vouchers WHERE voucher_id=$1', [voucherId]); return r.rows[0] ? mapVoucher(r.rows[0]) : null; }
  async findByCode(code: string): Promise<Voucher | null> { const r = await this.db.query('SELECT * FROM vouchers WHERE upper(code)=upper($1)', [code]); return r.rows[0] ? mapVoucher(r.rows[0]) : null; }
  async listActive(scope?: 'PLATFORM' | 'SHOP', shopId?: UUID): Promise<Voucher[]> {
    const args: unknown[] = []; const where = ["status='ACTIVE'", 'start_at <= now()', 'end_at >= now()', 'quantity > 0'];
    if (scope) { args.push(scope); where.push(`scope=$${args.length}`); }
    if (shopId) { args.push(shopId); where.push(`(scope='PLATFORM' OR shop_id=$${args.length})`); }
    const r = await this.db.query(`SELECT * FROM vouchers WHERE ${where.join(' AND ')} ORDER BY end_at ASC`, args); return r.rows.map(mapVoucher);
  }
  async create(): Promise<Voucher> { throw new Error('Voucher creation is outside T1'); }
  async decrementQuantity(voucherId: UUID): Promise<boolean> { const r = await this.db.query('UPDATE vouchers SET quantity=quantity-1,updated_at=now() WHERE voucher_id=$1 AND quantity>0 RETURNING voucher_id', [voucherId]); return r.rowCount === 1; }
  async incrementQuantity(voucherId: UUID): Promise<boolean> { const r = await this.db.query('UPDATE vouchers SET quantity=quantity+1,updated_at=now() WHERE voucher_id=$1 RETURNING voucher_id', [voucherId]); return r.rowCount === 1; }
  async recordUsage(usage: VoucherUsage): Promise<VoucherUsage> {
    const r = await this.db.query('INSERT INTO voucher_usages (usage_id,voucher_id,order_id,buyer_id,discount_amount,used_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [usage.usageId, usage.voucherId, usage.orderId, usage.buyerId, usage.discountAmount, usage.usedAt]);
    const row = r.rows[0]; return { usageId: row.usage_id, voucherId: row.voucher_id, orderId: row.order_id, buyerId: row.buyer_id, discountAmount: String(row.discount_amount), usedAt: iso(row.used_at) };
  }
}
