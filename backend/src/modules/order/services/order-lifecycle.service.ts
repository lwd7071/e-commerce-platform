import type { Pool, PoolClient } from 'pg';
import type { IOrderRepository } from '../domain/repositories.ts';
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
      const transition = transitionOrder(
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
   * Advances order status according to state machine rules.
   */
  public async transitionStatus(
    orderId: UUID,
    newStatus: OrderStatus,
    actor: OrderActor,
    reason?: string,
    processingEligible?: boolean,
  ): Promise<void> {
    const executeTransition = async (client?: PoolClient): Promise<void> => {
      const order = await this.orderRepo.findById(orderId, client);
      if (!order) {
        throw new OrderDomainError('RESOURCE_NOT_FOUND', 'Order was not found.');
      }

      transitionOrder(
        { status: order.status, buyerId: order.buyerId, shopId: order.shopId },
        { to: newStatus, actor, reason, processingEligible },
      );

      const history = createOrderStatusHistoryRecord({
        orderId,
        oldStatus: order.status,
        newStatus,
        changedBy: 'userId' in actor ? actor.userId : null,
        reason: reason || null,
      });

      await this.orderRepo.updateStatus(orderId, newStatus, history, client);
    };

    if (this.pool) {
      await withTransaction(this.pool, (client) => executeTransition(client));
    } else {
      await executeTransition();
    }
  }
}
