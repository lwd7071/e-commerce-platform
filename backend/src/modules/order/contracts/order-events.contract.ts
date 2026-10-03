import type { OrderStatus } from '../domain/types.ts';

export type UUID = string;

export interface BaseTransactionEvent {
  readonly eventId: UUID;
  readonly occurredAt: string;
}

export interface OrderCreatedEvent extends BaseTransactionEvent {
  readonly type: 'ORDER_CREATED';
  readonly orderId: UUID;
  readonly buyerId: UUID;
  readonly shopId: UUID;
  readonly totalAmount: string;
}

export interface OrderStatusChangedEvent extends BaseTransactionEvent {
  readonly type: 'ORDER_STATUS_CHANGED';
  readonly orderId: UUID;
  readonly buyerId: UUID;
  readonly shopId: UUID;
  readonly oldStatus: OrderStatus;
  readonly newStatus: OrderStatus;
  readonly reason?: string | null;
}

export interface PaymentStatusChangedEvent extends BaseTransactionEvent {
  readonly type: 'PAYMENT_STATUS_CHANGED';
  readonly paymentId: UUID;
  readonly orderId: UUID;
  readonly status: 'PENDING' | 'SUCCESS' | 'FAILED';
  readonly amount: string;
  readonly transactionCode?: string | null;
}

export interface ShipmentStatusChangedEvent extends BaseTransactionEvent {
  readonly type: 'SHIPMENT_STATUS_CHANGED';
  readonly shipmentId: UUID;
  readonly orderId: UUID;
  readonly status: 'PENDING' | 'HANDED_OVER' | 'SHIPPING' | 'DELIVERED' | 'FAILED';
  readonly trackingCode?: string | null;
}

export type TransactionDomainEvent =
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | PaymentStatusChangedEvent
  | ShipmentStatusChangedEvent;
