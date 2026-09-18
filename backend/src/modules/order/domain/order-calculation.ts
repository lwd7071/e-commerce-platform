import { OrderDomainError } from './errors.ts';

const DECIMAL_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;
const MAX_CENTS = 999_999_999_999_999n;

export interface OrderLineCalculationInput {
  readonly unit_price: string;
  readonly quantity: number;
}

export interface OrderCalculationInput {
  readonly lines: readonly OrderLineCalculationInput[];
  readonly discount_amount: string;
  readonly shipping_fee: string;
}

export interface OrderCalculationResult {
  readonly line_totals: readonly string[];
  readonly subtotal: string;
  readonly discount_amount: string;
  readonly shipping_fee: string;
  readonly total_amount: string;
}

function invalid(message: string): never {
  throw new OrderDomainError('ORDER_TOTAL_INVALID', message);
}

function parseCents(value: string, field: string, allowZero: boolean): bigint {
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
    invalid(`${field} must be a NUMERIC(15,2) decimal string.`);
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if ((!allowZero && cents <= 0n) || (allowZero && cents < 0n) || cents > MAX_CENTS) {
    invalid(`${field} is outside the NUMERIC(15,2) range.`);
  }
  return cents;
}

function formatCents(cents: bigint): string {
  if (cents < 0n || cents > MAX_CENTS) invalid('Order total is outside the NUMERIC(15,2) range.');
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export function calculateOrderTotals(input: OrderCalculationInput): OrderCalculationResult {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    invalid('At least one Order line is required.');
  }

  const lineTotals = input.lines.map((line, index) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 2_147_483_647) {
      invalid(`lines[${index}].quantity must be a positive PostgreSQL INTEGER.`);
    }
    const unitPrice = parseCents(line.unit_price, `lines[${index}].unit_price`, false);
    const lineTotal = unitPrice * BigInt(line.quantity);
    if (lineTotal > MAX_CENTS) invalid(`lines[${index}] exceeds the NUMERIC(15,2) range.`);
    return lineTotal;
  });

  const subtotal = lineTotals.reduce((sum, lineTotal) => sum + lineTotal, 0n);
  if (subtotal > MAX_CENTS) invalid('Subtotal is outside the NUMERIC(15,2) range.');
  const discount = parseCents(input.discount_amount, 'discount_amount', true);
  const shipping = parseCents(input.shipping_fee, 'shipping_fee', true);
  if (discount > subtotal) invalid('Discount cannot exceed subtotal.');

  const total = subtotal + shipping - discount;
  if (total < 0n || total > MAX_CENTS) invalid('Total amount is outside the NUMERIC(15,2) range.');

  return {
    line_totals: lineTotals.map(formatCents),
    subtotal: formatCents(subtotal),
    discount_amount: formatCents(discount),
    shipping_fee: formatCents(shipping),
    total_amount: formatCents(total),
  };
}
