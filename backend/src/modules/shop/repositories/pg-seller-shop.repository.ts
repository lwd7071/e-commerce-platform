import type { Pool } from 'pg';
import type { RequestContext } from '../../../platform/context/request-context.ts';
import type { ISellerShopRepository, SellerShop, SellerShopUpdate } from '../domain/shop.types.ts';

export class PgSellerShopRepository implements ISellerShopRepository {
  constructor(private readonly pool: Pool) {}

  async findOwned(context: RequestContext): Promise<SellerShop | null> {
    if (!context.shop_id) return null;
    const result = await this.pool.query(
      `SELECT shop_id, shop_name, description, pickup_address, contact_phone, status, updated_at
       FROM shops WHERE shop_id = $1 AND owner_id = $2`,
      [context.shop_id, context.user_id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async updateOwned(context: RequestContext, input: SellerShopUpdate): Promise<SellerShop | null> {
    if (!context.shop_id) return null;
    const columns: Record<keyof SellerShopUpdate, string> = {
      shop_name: 'shop_name', description: 'description', pickup_address: 'pickup_address', contact_phone: 'contact_phone',
    };
    const fields = Object.keys(input) as (keyof SellerShopUpdate)[];
    const values = fields.map((field) => input[field]);
    const setters = fields.map((field, index) => `${columns[field]} = $${index + 1}`);
    const pickupAddressValue = input.pickup_address === undefined ? 'pickup_address' : `$${fields.indexOf('pickup_address') + 1}`;
    const contactPhoneValue = input.contact_phone === undefined ? 'contact_phone' : `$${fields.indexOf('contact_phone') + 1}`;
    values.push(context.shop_id, context.user_id);
    const idParam = values.length - 1;
    const ownerParam = values.length;
    const result = await this.pool.query(
      `UPDATE shops SET ${setters.join(', ')}, updated_at = NOW()
       WHERE shop_id = $${idParam} AND owner_id = $${ownerParam} AND status IN ('PENDING', 'ACTIVE')
         AND (status <> 'ACTIVE' OR (
           NULLIF(BTRIM(${pickupAddressValue}), '') IS NOT NULL
           AND NULLIF(BTRIM(${contactPhoneValue}), '') IS NOT NULL
         ))
       RETURNING shop_id, shop_name, description, pickup_address, contact_phone, status, updated_at`,
      values,
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  private map(row: Record<string, unknown>): SellerShop {
    return {
      shop_id: String(row.shop_id), shop_name: String(row.shop_name),
      description: row.description == null ? null : String(row.description),
      pickup_address: row.pickup_address == null ? null : String(row.pickup_address),
      contact_phone: row.contact_phone == null ? null : String(row.contact_phone),
      status: row.status as SellerShop['status'], updated_at: new Date(row.updated_at as Date | string).toISOString(),
    };
  }
}
