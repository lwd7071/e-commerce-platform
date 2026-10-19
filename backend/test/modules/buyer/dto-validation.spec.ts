import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUpdateProfileDTO,
  validateCreateAddressDTO,
  validateUpdateAddressDTO,
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

    it('giới hạn tên người nhận 100 ký tự và chỉ nhận điện thoại nội địa 10 số', () => {
      const validAddress = {
        recipientName: 'A'.repeat(100), phone: '0912345678', province: 'Hà Nội',
        ward: 'Ba Đình', detailAddress: 'Số 10',
      };
      assert.equal(validateCreateAddressDTO(validAddress).recipientName.length, 100);
      assert.throws(() => validateCreateAddressDTO({ ...validAddress, recipientName: 'A'.repeat(101) }));
      assert.throws(() => validateCreateAddressDTO({ ...validAddress, phone: '09123456789' }));
      assert.throws(() => validateCreateAddressDTO({ ...validAddress, phone: '+84912345678' }));
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

    it('resolves canonical province and ward labels from a matching 2026 code pair', () => {
      const parsed = validateCreateAddressDTO({
        recipient_name: 'Trần Thị B', phone: '0912345678', province_code: '01', ward_code: '00004',
        detail_address: 'Số 10 Phạm Văn Đồng',
      });
      assert.equal(parsed.province, 'Hà Nội');
      assert.equal(parsed.ward, 'Ba Đình');
      assert.equal(parsed.provinceCode, '01');
      assert.equal(parsed.wardCode, '00004');
      assert.equal('district' in parsed, false);
    });

    it('rejects a ward code that belongs to a different province', () => {
      assert.throws(
        () => validateCreateAddressDTO({
          recipient_name: 'Trần Thị B', phone: '0912345678', province_code: '79', ward_code: '00004',
          detail_address: 'Số 10 Nguyễn Huệ',
        }),
        (err: unknown) => typeof err === 'object' && err !== null && 'code' in err && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('UpdateAddressDTO Validation', () => {
    it('rejects invalid recipient name length and non-local phone on partial updates', () => {
      assert.equal(validateUpdateAddressDTO({ recipientName: 'A'.repeat(100) }).recipientName?.length, 100);
      assert.throws(() => validateUpdateAddressDTO({ recipientName: 'A'.repeat(101) }));
      assert.throws(() => validateUpdateAddressDTO({ phone: '09123456789' }));
      assert.throws(() => validateUpdateAddressDTO({ phone: '+84912345678' }));
    });

    it('allows clearing the legacy locality field after moving it into the detail address', () => {
      const parsed = validateUpdateAddressDTO({ district: null, detail_address: 'Số 4, Ấp An Thịnh' });
      assert.equal(parsed.district, null);
      assert.equal(parsed.detailAddress, 'Số 4, Ấp An Thịnh');
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
    it('requires review content to contain 10 to 500 characters when provided', () => {
      assert.throws(() => validateCreateReviewDTO({ rating: 5, content: 'ngắn' }));
      assert.throws(() => validateCreateReviewDTO({ rating: 5, content: 'A'.repeat(501) }));
      assert.equal(validateCreateReviewDTO({ rating: 5, content: 'A'.repeat(10) }).content?.length, 10);
    });

    it('chấp nhận rating và content hợp lệ', () => {
      const parsed = validateCreateReviewDTO({ rating: 5, content: 'Sản phẩm tốt', images: ['https://example.com/img.jpg'] });
      assert.deepEqual(parsed, { rating: 5, content: 'Sản phẩm tốt', images: ['https://example.com/img.jpg'] });
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
