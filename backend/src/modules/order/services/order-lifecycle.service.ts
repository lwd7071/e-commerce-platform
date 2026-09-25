import type { Pool, PoolClient } from 'pg';
import type { IOrderRepository, OrderRecord } from '../domain/repositories.ts';
import type { OrderActor, OrderStatus } from '../domain/types.ts';
import { transitionOrder } from '../domain/order-state-machine.ts';
import { createOrderStatusHistoryRecord } from '../domain/order-snapshot.ts';
import { OrderDomainError } from '../domain/errors.ts';
import { withTransaction } from '../../../../db/transaction.ts';

export type UUID = string;

export interface IRestockHandler {
  (variantId: UUID, quantity: number, client?: PoolClient): Promise<void>;
}

export interface OrderLifecycleDependencies {
  readonly pool?: Pool;
  readonly orderRepo: IOrderRepository;
  readonly restockHandler?: IRestockHandler;
}

export class OrderLifecycleService {
  private pool?: Pool;
  private orderRepo: IOrderRepository;
  private restockHandler?: IRestockHandler;

  constructor(deps: OrderLifecycleDependencies) {
    this.pool = deps.pool;
    this.orderRepo = deps.orderRepo;
    this.restockHandler = deps.restockHandler;
  }

  /**
   * Cancels an order, updates status history, and atomically restocks variants exactly once (QD12, QD13).
   */
  public async cancelOrder(
    orderId: UUID,
    actor: OrderActor,
    reason: string,
  ): Promise<void> {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new OrderDomainError('REASON_REQUIRED', 'A non-blank reason is required to cancel an order.');
    }

    const executeCancel = async (client?: PoolClient): Promise<void> => {
      const order = await this.orderRepo.findById(orderId, client);
      if (!order) {
        throw new OrderDomainError('RESOURCE_NOT_FOUND', 'Order was not found.');
      }

      // Check transition eligibility via state machine
      transitionOrder(
        { status: order.status, buyerId: order.buyerId, shopId: order.shopId },
        { to: 'CANCELLED', actor, reason: trimmedReason },
      );

      // Create history record
      const history = createOrderStatusHistoryRecord({
        orderId,
        oldStatus: order.status,
        newStatus: 'CANCELLED',
        changedBy: 'userId' in actor ? actor.userId : null,
        reason: trimmedReason,
      });

      // Update Order status in DB
      await this.orderRepo.updateStatus(orderId, 'CANCELLED', history, client);

      // Restock items if handler is provided
      if (this.restockHandler) {
        const items = await this.orderRepo.findItemsByOrderId(orderId, client);
        for (const item of items) {
          await this.restockHandler(item.variantId, item.quantity, client);
        }
      }
    };

    if (this.pool) {
      await withTransaction(this.pool, (client) => executeCancel(client));
    } else {
      await executeCancel();
    }
  }

  /**
   * Confirms a pending order by SELLER (matching shop) or ADMIN (QD11, QD13).
   */
  public async confirmOrder(orderId: UUID, actor: OrderActor): Promise<OrderRecord> {
    const executeConfirm = async (client?: PoolClient): Promise<OrderRecord> => {
      const order = await this.orderRepo.findById(orderId, client);
      if (!order) {
        throw new OrderDomainError('RESOURCE_NOT_FOUND', 'Order was not found.');
      }
      if (actor.kind === 'SELLER' && actor.shopId !== order.shopId) {
        throw new OrderDomainError('RESOURCE_FORBIDDEN', 'Seller cannot confirm order of another shop.');
      }

      transitionOrder(
        { status: order.status, buyerId: order.buyerId, shopId: order.shopId },
        { to: 'CONFIRMED', actor, processingEligible: true },
      );

      const history = createOrderStatusHistoryRecord({
        orderId,
        oldStatus: order.status,
        newStatus: 'CONFIRMED',
        changedBy: 'userId' in actor ? actor.userId : null,
      });

      await this.orderRepo.updateStatus(orderId, 'CONFIRMED', history, client);
      const updated = await this.orderRepo.findById(orderId, client);
      return updated ?? { ...order, status: 'CONFIRMED' };
    };

    if (this.pool) {
      return await withTransaction(this.pool, (client) => executeConfirm(client));
    }
    return await executeConfirm();
  }

  /**
   * Advances order status according to full state machine rules and options.
   */
  public async transitionOrder(
    orderId: UUID,
    actor: OrderActor,
    options: {
      to: OrderStatus;
      reason?: string;
      processingEligible?: boolean;
      exceptionalCancellation?: boolean;
      shipmentStatus?: 'PENDING' | 'HANDED_OVER' | 'SHIPPING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
    },
  ): Promise<OrderRecord> {
    const executeTransition = async (client?: PoolClient): Promise<OrderRecord> => {
      const order = await this.orderRepo.findById(orderId, client);
      if (!order) {
        throw new OrderDomainError('RESOURCE_NOT_FOUND', 'Order was not found.');
      }

      const decision = transitionOrder(
        { status: order.status, buyerId: order.buyerId, shopId: order.shopId },
        {
          to: options.to,
          actor,
          reason: options.reason,
          processingEligible: options.processingEligible ?? true,
          exceptionalCancellation: options.exceptionalCancellation,
          shipmentStatus: options.shipmentStatus as any,
        },
      );

      const history = createOrderStatusHistoryRecord({
        orderId,
        oldStatus: order.status,
        newStatus: decision.to,
        changedBy: 'userId' in actor ? actor.userId : null,
        reason: decision.reason ?? null,
      });

      await this.orderRepo.updateStatus(orderId, decision.to, history, client);

      // If cancelled, restock if needed
      if (decision.to === 'CANCELLED' && this.restockHandler) {
        const items = await this.orderRepo.findItemsByOrderId(orderId, client);
        for (const item of items) {
          await this.restockHandler(item.variantId, item.quantity, client);
        }
      }

      const updated = await this.orderRepo.findById(orderId, client);
      return updated ?? { ...order, status: decision.to };
    };

    if (this.pool) {
      return await withTransaction(this.pool, (client) => executeTransition(client));
    }
    return await executeTransition();
  }

  /**
   * Advances order status according to state machine rules.
   */
  public async transitionStatus(
    orderId: UUID,
    newStatus: OrderStatus,
    actor: OrderActor,
    reason?: string,
    processingEligible?: boolean,
  ): Promise<void> {
    await this.transitionOrder(orderId, actor, {
      to: newStatus,
      reason,
      processingEligible,
    });
  }
}
