import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUpdateProfileDTO,
  validateCreateAddressDTO,
  validateAddToCartDTO,
  validateUpdateCartItemDTO,
  validateCreateReviewDTO,
  validateUpdateNotificationDTO,
} from '../../../src/modules/buyer/contracts/buyer.dto';
import { ValidationError } from '../../../src/modules/buyer/domain/errors';

describe('Buyer DTO & Validation Tests (api-conventions.md §2: reject unknown fields, format checks)', () => {

  describe('UpdateProfileDTO Validation', () => {
    it('chấp nhận payload hợp lệ', () => {
      const valid = { fullName: 'Nguyễn Văn A', phone: '0901234567' };
      assert.deepEqual(validateUpdateProfileDTO(valid), valid);
    });

    it('reject unknown fields với VALIDATION_FAILED (api-conventions.md §2)', () => {
      assert.throws(
        () => validateUpdateProfileDTO({ fullName: 'Nguyễn Văn A', hackField: 'malicious' }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('reject null hoặc non-object body với 422 VALIDATION_FAILED', () => {
      assert.throws(
        () => validateUpdateProfileDTO(null),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('chấp nhận input snake_case từ client', () => {
      const parsed = validateUpdateProfileDTO({ full_name: 'Nguyễn Văn A', phone: '0901234567' });
      assert.equal(parsed.fullName, 'Nguyễn Văn A');
    });
  });

  describe('CreateAddressDTO Validation', () => {
    it('chấp nhận địa chỉ hợp lệ', () => {
      const valid = {
        recipientName: 'Trần Thị B',
        phone: '0912345678',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng',
        detailAddress: 'Số 10 Phạm Văn Đồng',
        isDefault: true,
      };
      assert.deepEqual(validateCreateAddressDTO(valid), valid);
    });

    it('thiếu trường bắt buộc -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateCreateAddressDTO({ recipientName: 'Trần Thị B', phone: '0912345678' }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('chấp nhận snake_case payload', () => {
      const parsed = validateCreateAddressDTO({
        recipient_name: 'Trần Thị B',
        phone: '0912345678',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng',
        detail_address: 'Số 10 Phạm Văn Đồng',
        is_default: true,
      });
      assert.equal(parsed.recipientName, 'Trần Thị B');
      assert.equal(parsed.isDefault, true);
    });
  });

  describe('AddToCartDTO Validation', () => {
    it('chấp nhận variantId hợp lệ và quantity >= 1', () => {
      const valid = { variantId: '11111111-1111-4111-8111-111111111111', quantity: 2 };
      assert.deepEqual(validateAddToCartDTO(valid), valid);
    });

    it('variantId không phải UUID -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateAddToCartDTO({ variantId: 'invalid-uuid', quantity: 2 }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('UpdateCartItemDTO Validation', () => {
    it('chấp nhận quantity và is_selected hợp lệ', () => {
      const parsed = validateUpdateCartItemDTO({ quantity: 3, is_selected: true });
      assert.deepEqual(parsed, { quantity: 3, isSelected: true });
    });

    it('reject unknown fields', () => {
      assert.throws(
        () => validateUpdateCartItemDTO({ quantity: 3, extra: 'bad' }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('CreateReviewDTO Validation', () => {
    it('chấp nhận rating và content hợp lệ', () => {
      const parsed = validateCreateReviewDTO({ rating: 5, content: 'Tốt', images: ['https://example.com/img.jpg'] });
      assert.deepEqual(parsed, { rating: 5, content: 'Tốt', images: ['https://example.com/img.jpg'] });
    });

    it('reject rating ngoài miền 1..5', () => {
      assert.throws(
        () => validateCreateReviewDTO({ rating: 6 }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('UpdateNotificationDTO Validation (Resource-based PATCH)', () => {
    it('chấp nhận body {"is_read": true}', () => {
      const valid = { isRead: true };
      assert.deepEqual(validateUpdateNotificationDTO(valid), valid);
    });

    it('chấp nhận snake_case {"is_read": true}', () => {
      const parsed = validateUpdateNotificationDTO({ is_read: true });
      assert.equal(parsed.isRead, true);
    });

    it('reject unknown fields ví dụ action hay readAt trong client body', () => {
      assert.throws(
        () => validateUpdateNotificationDTO({ isRead: true, action: 'read' }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

});
