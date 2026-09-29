import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PostgresAddressRepository } from '../../src/modules/buyer/infrastructure/postgres-address.repository.ts';
import { AddressService } from '../../src/modules/buyer/services/address.service.ts';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Address CRUD runtime (real PostgreSQL)', () => {
  const schema = `address_runtime_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let service: AddressService;
  let ownerId: string;
  let otherId: string;
  let addressIds: string[];

  const createAddress = (recipientName: string) => service.createAddress(ownerId, {
    recipientName, phone: '0901234567', province: 'Hà Nội', district: 'Ba Đình', ward: 'Điện Biên', detailAddress: '1 Độc Lập',
  });

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 8, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE ${schema}.app_users (user_id uuid PRIMARY KEY);
      CREATE TABLE ${schema}.addresses (
        address_id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES ${schema}.app_users(user_id),
        recipient_name varchar(150) NOT NULL, phone varchar(20) NOT NULL, province varchar(100) NOT NULL,
        district varchar(100) NOT NULL, ward varchar(100) NOT NULL, detail_address varchar(255) NOT NULL,
        is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX uq_addresses__one_default_per_user ON ${schema}.addresses(user_id) WHERE is_default;
      CREATE TABLE ${schema}.order_address_snapshots (order_id uuid PRIMARY KEY, address_snapshot jsonb NOT NULL);
    `);
    service = new AddressService(new PostgresAddressRepository(pool));
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await pool.end(); }
    }
  }, 20_000);

  beforeEach(async () => {
    ownerId = randomUUID(); otherId = randomUUID(); addressIds = [];
    await pool.query(`INSERT INTO ${schema}.app_users VALUES ($1),($2)`, [ownerId, otherId]);
  });

  it('scopes address read, update, delete, and default changes to the owner', async () => {
    const address = await createAddress('Nguyễn Văn A');
    addressIds.push(address.addressId);
    await expect(service.getAddressById(otherId, address.addressId)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    await expect(service.updateAddress(otherId, address.addressId, { recipientName: 'Người khác' })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    await expect(service.deleteAddress(otherId, address.addressId)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    await expect(service.setDefault(otherId, address.addressId)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect((await service.getAddresses(otherId))).toHaveLength(0);
  });

  it('serializes concurrent default changes so exactly one address remains default', async () => {
    const first = await createAddress('Nguyễn Văn A');
    const second = await service.createAddress(ownerId, { recipientName: 'Nguyễn Văn B', phone: '0901234568', province: 'Hà Nội', district: 'Ba Đình', ward: 'Điện Biên', detailAddress: '2 Độc Lập' });
    addressIds.push(first.addressId, second.addressId);
    const results = await Promise.allSettled([
      service.setDefault(ownerId, first.addressId),
      service.setDefault(ownerId, second.addressId),
    ]);
    expect(results.every(result => result.status === 'fulfilled')).toBe(true);
    const defaults = await pool.query(`SELECT address_id FROM ${schema}.addresses WHERE user_id=$1 AND is_default`, [ownerId]);
    expect(defaults.rows).toHaveLength(1);
  });

  it('keeps the existing default if setting the replacement fails midway', async () => {
    const first = await createAddress('Nguyễn Văn A');
    const second = await service.createAddress(ownerId, { recipientName: 'Nguyễn Văn B', phone: '0901234568', province: 'Hà Nội', district: 'Ba Đình', ward: 'Điện Biên', detailAddress: '2 Độc Lập' });
    await pool.query(`CREATE FUNCTION ${schema}.reject_default_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.address_id = '${second.addressId}'::uuid AND NEW.is_default THEN RAISE EXCEPTION 'injected update failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER reject_default_change BEFORE UPDATE ON ${schema}.addresses FOR EACH ROW EXECUTE FUNCTION ${schema}.reject_default_change()`);
    await expect(service.setDefault(ownerId, second.addressId)).rejects.toThrow('injected update failure');
    const defaults = await pool.query(`SELECT address_id FROM ${schema}.addresses WHERE user_id=$1 AND is_default`, [ownerId]);
    expect(defaults.rows).toEqual([{ address_id: first.addressId }]);
  });

  it('allows deleting an address while an order retains its saved address snapshot', async () => {
    const address = await createAddress('Nguyễn Văn A');
    const orderId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.order_address_snapshots VALUES ($1,$2::jsonb)`, [orderId, JSON.stringify({ recipient_name: address.recipientName, province: address.province, detail_address: address.detailAddress })]);
    await service.deleteAddress(ownerId, address.addressId);
    expect(await service.getAddressById(ownerId, address.addressId).catch(() => null)).toBeNull();
    const snapshot = await pool.query(`SELECT address_snapshot FROM ${schema}.order_address_snapshots WHERE order_id=$1`, [orderId]);
    expect(snapshot.rows[0].address_snapshot).toEqual({ recipient_name: 'Nguyễn Văn A', province: 'Hà Nội', detail_address: '1 Độc Lập' });
  });
});
