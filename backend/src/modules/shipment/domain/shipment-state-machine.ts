import type { ShipmentStatus, ShipmentTransition } from './types.ts';

const transitions: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  PENDING: ['HANDED_OVER'],
  HANDED_OVER: ['SHIPPING', 'FAILED'],
  SHIPPING: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
};

/** Pure decision. Callback deduplication and Order updates belong to the caller's transaction. */
export function transitionShipment(
  shipment: { readonly status: ShipmentStatus },
  to: ShipmentStatus,
): ShipmentTransition {
  if (!Object.hasOwn(transitions, shipment.status) || !Object.hasOwn(transitions, to)) {
    return { allowed: false, reason: 'INVALID_STATUS' };
  }
  if (!transitions[shipment.status].includes(to)) {
    return { allowed: false, reason: 'INVALID_TRANSITION' };
  }
  return { allowed: true, from: shipment.status, to };
}
