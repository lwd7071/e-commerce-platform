export type FlashSaleSlotStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';
export type CompensationStatus = 'PENDING' | 'APPLIED' | 'FAILED';

export interface FlashSaleSession {
  slot_id: string;
  slot_name: string;
  start_time: string;
  end_time: string;
  status: FlashSaleSlotStatus;
  created_at: string;
  updated_at: string;
}

export interface FlashSaleItem {
  item_id: string;
  slot_id: string;
  product_id: string;
  variant_id: string;
  original_price: string;
  flash_sale_price: string;
  allocated_stock: number;
  available_stock?: number;
  created_at: string;
  updated_at: string;
}

export interface FlashSaleCompensationLog {
  compensation_id: string;
  slot_id: string;
  item_id: string;
  user_id: string;
  reason: string;
  status: CompensationStatus;
  created_at: string;
  updated_at: string;
}

export interface PendingReservationPayload {
  idemp_key: string;
  user_id: string;
  slot_id: string;
  item_id: string;
  voucher_code: string;
  created_at: number;
}

export enum FlashSaleLuaCode {
  SUCCESS = 1,
  PRODUCT_OUT_OF_STOCK = 0,
  SLOT_NOT_ACTIVE = -1,
  USER_PURCHASE_LIMIT_EXCEEDED = -2,
  VOUCHER_ALREADY_USED_BY_USER = -3,
  VOUCHER_OUT_OF_STOCK = -4,
}

export interface PurchaseFlashSaleCommand {
  idempotency_key: string;
  user_id: string;
  slot_id: string;
  item_id: string;
  voucher_code?: string;
  recipient_name: string;
  recipient_phone: string;
  province: string;
  district: string;
  ward: string;
  delivery_address: string;
}

export interface PurchaseFlashSaleResult {
  success: boolean;
  order_id?: string;
  code: FlashSaleLuaCode;
  message: string;
  is_replay?: boolean;
}

export interface ReconciliationReport {
  slot_id: string;
  slot_name: string;
  allocated_stock: number;
  remaining_redis_stock: number;
  sold_via_redis: number;
  valid_orders_in_db: number;
  compensation_applied_count: number;
  discrepancy: number;
  is_balanced: boolean;
  timestamp: string;
}
