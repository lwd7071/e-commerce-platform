export type ShopMallRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ShopMallRequest {
  request_id: string;
  shop_id: string;
  seller_id: string;
  admin_id: string | null;
  reason: string;
  document_url: string;
  status: ShopMallRequestStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopMallRequestListItem extends ShopMallRequest {
  shop_name?: string;
  seller_email?: string;
}

export interface SubmitMallRequestInput {
  reason: string;
  document_url: string;
}

export interface ApproveMallRequestInput {
  note: string;
}

export interface RejectMallRequestInput {
  reason: string;
}

export interface ListMallRequestsQuery {
  status?: ShopMallRequestStatus;
  cursor?: string;
  limit?: number;
}
