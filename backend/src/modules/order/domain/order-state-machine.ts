import type { OrderState, OrderTransition, OrderTransitionCommand } from './types.ts';
import { OrderDomainError } from './errors.ts';

const transitions: Readonly<Record<OrderState['status'], readonly OrderState['status'][]>> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'DELIVERY_FAILED'],
  COMPLETED: [],
  CANCELLED: [],
  DELIVERY_FAILED: [],
};

export function transitionOrder(
  order: OrderState,
  command: OrderTransitionCommand,
): OrderTransition {
  if (!Object.hasOwn(transitions, order.status) || !Object.hasOwn(transitions, command.to)) {
    throw new OrderDomainError('VALIDATION_FAILED', 'Order status is invalid.');
  }
  const actor = command.actor;
  if (actor.kind === 'BUYER') {
    if (actor.userId !== order.buyerId) {
      throw new OrderDomainError('RESOURCE_NOT_FOUND', 'Order was not found.');
    }
    if (command.to !== 'CANCELLED') {
      throw new OrderDomainError('RESOURCE_FORBIDDEN', 'Buyer cannot perform this transition.');
    }
    if (order.status !== 'PENDING_CONFIRMATION') {
      throw new OrderDomainError('ORDER_CANCELLATION_NOT_ALLOWED', 'Buyer cannot cancel this Order.');
    }
  } else if (actor.kind === 'SELLER') {
    if (actor.shopId !== order.shopId || command.to === 'COMPLETED' || command.to === 'DELIVERY_FAILED') {
      throw new OrderDomainError('RESOURCE_FORBIDDEN', 'Seller cannot perform this transition.');
    }
  } else if (actor.kind === 'SHIPMENT_INTEGRATION') {
    if (command.to !== 'COMPLETED' && command.to !== 'DELIVERY_FAILED') {
      throw new OrderDomainError('RESOURCE_FORBIDDEN', 'Shipment integration cannot perform this transition.');
    }
  } else if (actor.kind !== 'ADMIN') {
    throw new OrderDomainError('RESOURCE_FORBIDDEN', 'Actor cannot perform this transition.');
  }
  if (!transitions[order.status].includes(command.to)) {
    throw new OrderDomainError('ORDER_INVALID_TRANSITION', 'Order transition is not allowed.');
  }
  if (command.to === 'CONFIRMED' && command.processingEligible !== true) {
    throw new OrderDomainError('ORDER_INVALID_TRANSITION', 'Order is not eligible for confirmation.');
  }
  if (order.status === 'PREPARING' && command.to === 'CANCELLED' && command.exceptionalCancellation !== true) {
    throw new OrderDomainError('ORDER_CANCELLATION_NOT_ALLOWED', 'Exceptional cancellation eligibility is required.');
  }
  if (command.to === 'SHIPPING' && command.shipmentStatus !== 'HANDED_OVER' && command.shipmentStatus !== 'SHIPPING') {
    throw new OrderDomainError('ORDER_INVALID_TRANSITION', 'Shipment has not been handed over.');
  }
  if (command.to === 'COMPLETED' && command.shipmentStatus !== 'DELIVERED') {
    throw new OrderDomainError('ORDER_INVALID_TRANSITION', 'Shipment has not been delivered.');
  }
  if (command.to === 'DELIVERY_FAILED' && command.shipmentStatus !== 'FAILED') {
    throw new OrderDomainError('ORDER_INVALID_TRANSITION', 'Shipment has not failed.');
  }
  const reason = command.reason?.trim();
  if ((command.to === 'CANCELLED' || command.to === 'DELIVERY_FAILED' || actor.kind === 'ADMIN') && !reason) {
    throw new OrderDomainError('REASON_REQUIRED', 'A nonblank reason is required.');
  }
  return { from: order.status, to: command.to, ...(reason ? { reason } : {}) };
}
