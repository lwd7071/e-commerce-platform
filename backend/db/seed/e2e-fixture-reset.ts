type FixtureResetQueryable = {
  query(text: string, values?: unknown[]): Promise<unknown>;
};

export type E2EAddressFixture = {
  buyerId: string;
  addressId: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
};

export async function resetE2EBuyerAddress(
  client: FixtureResetQueryable,
  address: E2EAddressFixture,
): Promise<void> {
  await client.query(
    'DELETE FROM addresses WHERE user_id=$1 AND address_id<>$2',
    [address.buyerId, address.addressId],
  );
  await client.query(`
    INSERT INTO addresses(address_id,user_id,recipient_name,phone,province,district,ward,detail_address,is_default)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)
    ON CONFLICT(address_id) DO UPDATE SET user_id=EXCLUDED.user_id,recipient_name=EXCLUDED.recipient_name,
      phone=EXCLUDED.phone,province=EXCLUDED.province,district=EXCLUDED.district,ward=EXCLUDED.ward,
      detail_address=EXCLUDED.detail_address,is_default=true,updated_at=now()
  `, [
    address.addressId, address.buyerId, address.recipientName, address.phone,
    address.province, address.district, address.ward, address.detailAddress,
  ]);
}

export async function resetE2EBuyerCart(
  client: FixtureResetQueryable,
  cart: { buyerId: string; cartId: string },
): Promise<void> {
  // carts.cart_id is referenced by cart_items with ON DELETE CASCADE.
  await client.query('DELETE FROM carts WHERE buyer_id=$1', [cart.buyerId]);
  await client.query('INSERT INTO carts(cart_id,buyer_id) VALUES($1,$2)', [cart.cartId, cart.buyerId]);
}
