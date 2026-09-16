/** Proposed domain-owned contract; not a replacement for platform RequestContext. */
export interface CheckoutCommand {
  readonly address_id: string;
  readonly payment_method: 'COD' | 'ONLINE';
  readonly vouchers: readonly { readonly shop_id: string; readonly code: string }[];
  readonly idempotency_key: string;
}

function invalid(): never {
  throw Object.assign(new Error('Checkout fields are invalid.'), { code: 'VALIDATION_FAILED' });
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

export function parseCheckoutCommand(body: unknown, idempotencyKey: unknown): CheckoutCommand {
  if (idempotencyKey === undefined || idempotencyKey === null || idempotencyKey === '') {
    throw Object.assign(new Error('Idempotency-Key is required.'), { code: 'IDEMPOTENCY_KEY_REQUIRED' });
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    throw Object.assign(new Error('Idempotency-Key must have 16–128 characters.'), { code: 'VALIDATION_FAILED' });
  }
  const input = record(body);
  if (Object.keys(input).some(key => !['address_id', 'payment_method', 'vouchers'].includes(key))) invalid();
  if (!uuid(input.address_id) || (input.payment_method !== 'COD' && input.payment_method !== 'ONLINE')) invalid();
  const rawVouchers = input.vouchers === undefined ? [] : input.vouchers;
  if (!Array.isArray(rawVouchers)) invalid();
  const shops = new Set<string>();
  const vouchers = rawVouchers.map(raw => {
    const voucher = record(raw);
    if (Object.keys(voucher).some(key => !['shop_id', 'code'].includes(key))) invalid();
    if (!uuid(voucher.shop_id) || typeof voucher.code !== 'string' || !voucher.code.trim() || voucher.code.length > 50) invalid();
    if (shops.has(voucher.shop_id)) invalid();
    shops.add(voucher.shop_id);
    return { shop_id: voucher.shop_id, code: voucher.code };
  });
  return {
    address_id: input.address_id,
    payment_method: input.payment_method,
    vouchers,
    idempotency_key: idempotencyKey,
  };
}
