/**
 * Re-export chính thức IOrderQueryPort từ Người 5 (Transaction Core).
 * Thay thế hoàn toàn stub port nội bộ T2 — sẵn sàng đấu nối thật.
 * Nguồn: backend/src/modules/order/contracts/order-query.contract.ts
 */
export type {
  IOrderQueryPort,
  ReviewOrderItemDTO,
  OrderSummaryDTO,
  UUID,
} from '../../order/contracts/order-query.contract.ts';
