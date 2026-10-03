export interface ReviewInput {
  rating: number;
  comment?: string;
  media_urls?: string[];
}

export interface ReviewValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Kiểm tra đơn hàng có đủ điều kiện đánh giá không
 * Chỉ đơn COMPLETED mới được đánh giá
 */
export function isOrderEligibleForReview(orderStatus: string): boolean {
  return orderStatus === "COMPLETED";
}

/**
 * Kiểm tra dữ liệu form đánh giá sản phẩm
 */
export function validateReviewInput(input: ReviewInput): ReviewValidationResult {
  const errors: Record<string, string> = {};

  if (
    typeof input.rating !== "number" ||
    isNaN(input.rating) ||
    input.rating < 1 ||
    input.rating > 5 ||
    !Number.isInteger(input.rating)
  ) {
    errors.rating = "Vui lòng chọn số sao từ 1 đến 5 sao";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
