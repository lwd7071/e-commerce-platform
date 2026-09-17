import type { IAddressRepository } from '../domain/repositories';
import type { UUID, Address } from '../domain/types';
import type { IDbClient } from './db-client';
import { mapAddress } from './row-mappers';

/**
 * SOLID Design Principles:
 * - Single Responsibility (S): Chuyên biệt quản lý Address aggregate persistence.
 * - Dependency Inversion (D): Nhận IDbClient trừu tượng qua constructor injection.
 * - Liskov Substitution (L): Tuân thủ hoàn toàn IAddressRepository interface contract.
 */
export class PostgresAddressRepository implements IAddressRepository {
  constructor(private readonly db: IDbClient) {}

  async findById(addressId: UUID): Promise<Address | null> {
    const sql = `
      SELECT address_id, user_id, recipient_name, phone, province, district, ward,
             detail_address, is_default, created_at, updated_at
      FROM addresses
      WHERE address_id = $1
    `;
    const result = await this.db.query(sql, [addressId]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapAddress(result.rows[0]);
  }

  async findByUserId(userId: UUID): Promise<Address[]> {
    const sql = `
      SELECT address_id, user_id, recipient_name, phone, province, district, ward,
             detail_address, is_default, created_at, updated_at
      FROM addresses
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC
    `;
    const result = await this.db.query(sql, [userId]);
    return (result.rows ?? []).map(mapAddress);
  }

  async create(address: Address): Promise<Address> {
    const sql = `
      INSERT INTO addresses (
        address_id, user_id, recipient_name, phone, province, district,
        ward, detail_address, is_default, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()), now())
      RETURNING address_id, user_id, recipient_name, phone, province, district,
                ward, detail_address, is_default, created_at, updated_at
    `;
    const params = [
      address.addressId,
      address.userId,
      address.recipientName,
      address.phone,
      address.province,
      address.district,
      address.ward,
      address.detailAddress,
      address.isDefault,
      address.createdAt ?? null,
    ];
    const result = await this.db.query(sql, params);
    return mapAddress(result.rows[0]);
  }

  async update(address: Address): Promise<Address> {
    const sql = `
      UPDATE addresses
      SET recipient_name = $2,
          phone = $3,
          province = $4,
          district = $5,
          ward = $6,
          detail_address = $7,
          is_default = $8,
          updated_at = now()
      WHERE address_id = $1
      RETURNING address_id, user_id, recipient_name, phone, province, district,
                ward, detail_address, is_default, created_at, updated_at
    `;
    const params = [
      address.addressId,
      address.recipientName,
      address.phone,
      address.province,
      address.district,
      address.ward,
      address.detailAddress,
      address.isDefault,
    ];
    const result = await this.db.query(sql, params);
    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Address not found: ${address.addressId}`);
    }
    return mapAddress(result.rows[0]);
  }

  async delete(addressId: UUID): Promise<void> {
    const sql = `DELETE FROM addresses WHERE address_id = $1`;
    await this.db.query(sql, [addressId]);
  }

  async setDefault(userId: UUID, targetAddressId: UUID): Promise<void> {
    // Bước 1: Gỡ cờ mặc định của tất cả địa chỉ hiện tại thuộc về user này
    const unsetSql = `
      UPDATE addresses
      SET is_default = FALSE,
          updated_at = now()
      WHERE user_id = $1 AND is_default = TRUE
    `;
    await this.db.query(unsetSql, [userId]);

    // Bước 2: Bật cờ mặc định cho địa chỉ được chỉ định
    const setSql = `
      UPDATE addresses
      SET is_default = TRUE,
          updated_at = now()
      WHERE address_id = $2 AND user_id = $1
    `;
    await this.db.query(setSql, [userId, targetAddressId]);
  }
}
