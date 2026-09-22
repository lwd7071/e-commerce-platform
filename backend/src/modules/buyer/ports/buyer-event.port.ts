import type { UUID } from '../domain/types';

export type BuyerDomainEventType = 'ORDER_COMPLETED' | 'PAYMENT_SUCCESS' | 'SHIPMENT_DELIVERED';

export interface BuyerDomainEvent {
  eventId: UUID;
  type: BuyerDomainEventType;
  recipientId: UUID;
  orderId: UUID;
  title: string;
  content: string;
  occurredAt: string;
}

/**
 * Temporary internal stub port for Person 4 T2 testing.
 * Will be COMPLETELY DISCARDED AND REPLACED once Person 5 delivers the official Event Bus contract.
 */
export interface IBuyerEventPort {
  publish(event: BuyerDomainEvent): Promise<void>;
  subscribe(handler: (event: BuyerDomainEvent) => Promise<void>): void;
}
