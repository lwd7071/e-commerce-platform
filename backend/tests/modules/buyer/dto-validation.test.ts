import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUpdateProfileDTO,
  validateCreateAddressDTO,
  validateAddToCartDTO,
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

  describe('UpdateNotificationDTO Validation (Resource-based PATCH)', () => {
    it('chấp nhận body {"is_read": true}', () => {
      const valid = { isRead: true };
      assert.deepEqual(validateUpdateNotificationDTO(valid), valid);
    });

    it('reject unknown fields ví dụ action hay readAt trong client body', () => {
      assert.throws(
        () => validateUpdateNotificationDTO({ isRead: true, action: 'read' }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

});
