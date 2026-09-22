import type { ReviewOrderItemContext } from '../domain/review';
import type { UUID } from '../domain/types';

/**
 * Temporary internal stub port for Person 4 T2 testing.
 * Will be COMPLETELY DISCARDED AND REPLACED once Person 5 delivers the official Order Query contract.
 * Note: hasExistingReview is handled directly by IReviewRepository in Buyer domain.
 */
export interface IOrderQueryPort {
  getOrderItemContext(orderItemId: UUID): Promise<Omit<ReviewOrderItemContext, 'hasExistingReview'> | null>;
}
