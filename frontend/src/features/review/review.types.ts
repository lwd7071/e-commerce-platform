/**
 * Review domain types for Dino E-Commerce (Người 5 - O-507 & P-607c).
 * Follows QD14 (Review eligibility), RB-LB09 (No duplicate reviews),
 * and P-607c (Media preview upload).
 */

export interface ReviewItemInput {
  order_item_id: string;
  product_id?: string;
  product_name: string;
  variant_name?: string;
  price?: string;
  image_url?: string | null;
  rating: number; // 1..5
  comment: string; // 10..500 chars
  review_id?: string;
  images: string[];
  image_media_ids?: string[];
  is_anonymous: boolean;
}

export interface CreateReviewPayload {
  order_id: string;
  reviews: ReviewItemInput[];
}

export interface ReviewRecord {
  id: string;
  order_id: string;
  order_item_id: string;
  product_id?: string;
  product_name: string;
  variant_name?: string;
  rating: number;
  comment: string;
  images: string[];
  is_anonymous: boolean;
  created_at: string;
}

export interface ReviewResult {
  success: boolean;
  message: string;
  data: ReviewRecord[];
}

export const RATING_LABELS: Record<number, string> = {
  1: "Rất tệ - Không hài lòng về sản phẩm",
  2: "Chưa tốt - Sản phẩm dưới kỳ vọng",
  3: "Bình thường - Đúng như mô tả cơ bản",
  4: "Hài lòng - Chất lượng tốt",
  5: "Tuyệt vời - Rất hài lòng, vượt mong đợi",
};
