export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DELIVERY_FAILED';

export interface OrderState {
  readonly status: OrderStatus;
  readonly buyerId: string;
  readonly shopId: string;
}

/** Trusted caller context; never construct this from a client-supplied role. */
export type OrderActor =
  | { readonly kind: 'BUYER'; readonly userId: string }
  | { readonly kind: 'SELLER'; readonly userId: string; readonly shopId: string }
  | { readonly kind: 'ADMIN'; readonly userId: string }
  | { readonly kind: 'SHIPMENT_INTEGRATION' };

export interface OrderTransitionCommand {
  readonly to: OrderStatus;
  readonly actor: OrderActor;
  readonly processingEligible?: boolean;
  readonly reason?: string;
  /** Verified exception eligibility from the caller's policy, not client input. */
  readonly exceptionalCancellation?: boolean;
  readonly shipmentStatus?: 'PENDING' | 'HANDED_OVER' | 'SHIPPING' | 'DELIVERED' | 'FAILED';
}

/** A decision only: the caller must persist state/history/audit atomically. */
export interface OrderTransition {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly reason?: string;
}
