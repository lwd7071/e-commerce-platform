export type ShipmentStatus = 'PENDING' | 'HANDED_OVER' | 'SHIPPING' | 'DELIVERED' | 'FAILED';

export type ShipmentTransition =
  | { readonly allowed: true; readonly from: ShipmentStatus; readonly to: ShipmentStatus }
  | { readonly allowed: false; readonly reason: 'INVALID_TRANSITION' | 'INVALID_STATUS' };
