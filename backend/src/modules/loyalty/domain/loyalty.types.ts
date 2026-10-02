export type BuyerTier = 'STANDARD' | 'VIP';

export const VIP_THRESHOLD_CENTS = 500_000_000n; // 5,000,000.00 VNĐ
export const POINTS_UNIT_CENTS = 1_000_000n; // 10,000.00 VNĐ

const DECIMAL_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;
const MAX_CENTS = 999_999_999_999_999n;

export function parseCents(value: string | number | null | undefined, field = 'amount'): bigint {
  if (value === null || value === undefined) return 0n;
  const str = String(value).trim();
  if (!DECIMAL_PATTERN.test(str)) {
    throw new Error(`${field} must be a NUMERIC(15,2) decimal string.`);
  }
  const [whole, fraction = ''] = str.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents < 0n || cents > MAX_CENTS) {
    throw new Error(`${field} is outside valid money range.`);
  }
  return cents;
}

export function formatCents(cents: bigint): string {
  if (cents < 0n || cents > MAX_CENTS) {
    throw new Error('Cents outside valid money range.');
  }
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export interface LoyaltyCalculationInput {
  oldTotalSpentCents: bigint;
  oldTier: BuyerTier;
  subtotalCents: bigint;
  discountCents: bigint;
}

export interface LoyaltyCalculationResult {
  eligibleCents: bigint;
  pointsDelta: number;
  newTotalSpentCents: bigint;
  newTier: BuyerTier;
}

export function calculateLoyaltyAccrual(input: LoyaltyCalculationInput): LoyaltyCalculationResult {
  const eligibleCents = input.subtotalCents > input.discountCents
    ? input.subtotalCents - input.discountCents
    : 0n;

  const multiplier = input.oldTier === 'VIP' ? 2n : 1n;
  const pointsDeltaBig = (eligibleCents / POINTS_UNIT_CENTS) * multiplier;
  const pointsDelta = Number(pointsDeltaBig);

  const newTotalSpentCents = input.oldTotalSpentCents + eligibleCents;
  const newTier: BuyerTier = newTotalSpentCents >= VIP_THRESHOLD_CENTS ? 'VIP' : 'STANDARD';

  return {
    eligibleCents,
    pointsDelta,
    newTotalSpentCents,
    newTier,
  };
}

export interface LoyaltyInfo {
  tier: BuyerTier;
  total_spent: string;
  loyalty_points: number;
  vip_threshold: string;
  points_multiplier: number;
  next_tier: BuyerTier | null;
}

export interface LoyaltyTransaction {
  transaction_id: string;
  user_id: string;
  points_delta: number;
  reference_order_id: string | null;
  reason: string;
  created_at: string;
}

export interface PaginatedLoyaltyHistory {
  items: LoyaltyTransaction[];
  page: number;
  limit: number;
  total: number;
}
