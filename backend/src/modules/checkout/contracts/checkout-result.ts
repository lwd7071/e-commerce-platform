/** Proposed payload for data in the platform-owned API envelope. */
export interface CheckoutOrderResult {
  readonly order_id: string;
  readonly shop_id: string;
  readonly status: 'PENDING_CONFIRMATION';
  readonly total_amount: string;
  readonly payment_id: string;
}

/** Nonempty, atomic result: never a mixture of successful and failed shops. */
export interface CheckoutResult {
  readonly orders: readonly [CheckoutOrderResult, ...CheckoutOrderResult[]];
}
