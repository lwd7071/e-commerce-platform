import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateReviewRating, checkReviewEligibility } from '../../../src/modules/buyer/domain/review.ts';
import { ValidationError, ReviewNotEligibleError, ReviewAlreadyExistsError } from '../../../src/modules/buyer/domain/errors.ts';
import { mockBuyerId } from './fixtures.ts';

describe('Review Domain Tests (QD14, QD15, RB-MG08, RB-LB09)', () => {

  describe('Slice 1: Rating boundary (QD15, RB-MG08)', () => {
    it('[QD15, RB-MG08] validateRating(0) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateReviewRating(0),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[QD15, RB-MG08] validateRating(6) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateReviewRating(6),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[QD15, RB-MG08] validateRating(3.5) -> reject VALIDATION_FAILED (không phải số nguyên)', () => {
      assert.throws(
        () => validateReviewRating(3.5),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[QD15, RB-MG08] validateRating(5) -> accept', () => {
      assert.doesNotThrow(() => validateReviewRating(5));
      assert.doesNotThrow(() => validateReviewRating(1));
    });
  });

  describe('Slice 2: Review Eligibility (QD14) & Duplicate (RB-LB09)', () => {
    const validOrderItem = {
      orderItemId: 'OI1',
      orderId: 'order-1',
      productId: 'prod-1',
      buyerId: 'B1',
      orderStatus: 'COMPLETED',
      hasExistingReview: false,
    };

    it('[QD14] checkReviewEligibility(order.status=PENDING, buyer=B1) -> reject REVIEW_NOT_ELIGIBLE', () => {
      assert.throws(
        () => checkReviewEligibility({ ...validOrderItem, orderStatus: 'PENDING' }, 'B1'),
        (err: any) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
      );
    });

    it('[QD14] checkReviewEligibility(order.status=COMPLETED, buyer=B2, orderOwner=B1) -> reject REVIEW_NOT_ELIGIBLE (sai buyer)', () => {
      assert.throws(
        () => checkReviewEligibility(validOrderItem, 'B2'),
        (err: any) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
      );
    });

    it('[RB-LB09] checkReviewEligibility(order.status=COMPLETED, buyer=B1, orderItemId=OI1 đã có review) -> reject REVIEW_ALREADY_EXISTS', () => {
      assert.throws(
        () => checkReviewEligibility({ ...validOrderItem, hasExistingReview: true }, 'B1'),
        (err: any) => err instanceof ReviewAlreadyExistsError && err.code === 'REVIEW_ALREADY_EXISTS'
      );
    });

    it('[QD14, RB-LB09] checkReviewEligibility(order.status=COMPLETED, buyer=B1, orderItemId=OI2 chưa có review) -> accept', () => {
      assert.doesNotThrow(() => {
        checkReviewEligibility(validOrderItem, 'B1');
      });
    });
  });

});
