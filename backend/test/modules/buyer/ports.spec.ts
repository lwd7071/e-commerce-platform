import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CartPortService } from '../../../src/modules/buyer/services/cart-port.service';
import { VoucherPortService } from '../../../src/modules/buyer/services/voucher-port.service';
import { InMemoryCartRepository, InMemoryVoucherRepository } from './in-memory-repos';
import { mockBuyerId, mockShopId, mockPlatformVoucher, mockShopVoucher } from './fixtures';

describe('Buyer Ports Contract Tests (Bàn giao cho Người 5 - Transaction Core)', () => {

  describe('Cart Port Contract (ICartPort)', () => {
    let cartRepo: InMemoryCartRepository;
    let cartPort: CartPortService;

    beforeEach(async () => {
      cartRepo = new InMemoryCartRepository();
      cartPort = new CartPortService(cartRepo);

      await cartRepo.createCart({
        cartId: 'cart-1',
        buyerId: mockBuyerId,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      });

      await cartRepo.addItem('cart-1', {
        cartItemId: 'item-1',
        cartId: 'cart-1',
        variantId: 'variant-v1',
        quantity: 2,
        isSelected: true,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      });

      await cartRepo.addItem('cart-1', {
        cartItemId: 'item-2',
        cartId: 'cart-1',
        variantId: 'variant-v2',
        quantity: 1,
        isSelected: false, // Không được chọn
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      });
    });

    it('getSelectedItems: chỉ trả về các dòng cart có isSelected = true', async () => {
      const selected = await cartPort.getSelectedItems(mockBuyerId);
      assert.equal(selected.length, 1);
      assert.equal(selected[0].cartItemId, 'item-1');
      assert.equal(selected[0].variantId, 'variant-v1');
      assert.equal(selected[0].quantity, 2);
    });

    it('clearCheckedOutItems: xóa các dòng cart đã checkout thành công khỏi giỏ hàng', async () => {
      await cartPort.clearCheckedOutItems(mockBuyerId, ['item-1']);
      const selectedAfter = await cartPort.getSelectedItems(mockBuyerId);
      assert.equal(selectedAfter.length, 0);

      // Dòng item-2 không được chọn vẫn còn trong giỏ
      const allItems = await cartRepo.getItems('cart-1');
      assert.equal(allItems.length, 1);
      assert.equal(allItems[0].cartItemId, 'item-2');
    });
  });

  describe('Voucher Port Contract (IVoucherPort)', () => {
    let voucherRepo: InMemoryVoucherRepository;
    let voucherPort: VoucherPortService;

    beforeEach(async () => {
      voucherRepo = new InMemoryVoucherRepository();
      voucherPort = new VoucherPortService(voucherRepo);

      await voucherRepo.create({ ...mockPlatformVoucher });
      await voucherRepo.create({ ...mockShopVoucher });
    });

    it('evaluateVoucher: mã hợp lệ -> trả về discountAmount đúng chuẩn decimal string', async () => {
      const result = await voucherPort.evaluateVoucher({
        code: 'PLATFORM20',
        buyerId: mockBuyerId,
        shopId: mockShopId,
        orderSubtotal: '100000.00',
        now: '2026-09-15T10:00:00.000Z',
      });

      assert.equal(result.isValid, true);
      if (result.isValid) {
        assert.equal(result.discountAmount, '20000.00');
        assert.equal(result.voucherId, mockPlatformVoucher.voucherId);
      }
    });

    it('evaluateVoucher: mã không tồn tại -> trả về isValid: false kèm VOUCHER_NOT_APPLICABLE', async () => {
      const result = await voucherPort.evaluateVoucher({
        code: 'NON_EXISTING',
        buyerId: mockBuyerId,
        shopId: mockShopId,
        orderSubtotal: '100000.00',
      });

      assert.equal(result.isValid, false);
      if (!result.isValid) {
        assert.equal(result.errorCode, 'VOUCHER_NOT_APPLICABLE');
      }
    });

    it('consumeVoucher: trừ lượt dùng và ghi nhận VoucherUsage', async () => {
      const usage = await voucherPort.consumeVoucher({
        voucherId: mockPlatformVoucher.voucherId,
        orderId: 'order-123',
        buyerId: mockBuyerId,
        discountAmount: '20000.00',
      });

      assert.equal(usage.voucherId, mockPlatformVoucher.voucherId);
      assert.equal(usage.orderId, 'order-123');
      assert.equal(usage.discountAmount, '20000.00');

      // Kiểm tra tồn lượt của voucher đã giảm 1
      const updatedVoucher = await voucherRepo.findById(mockPlatformVoucher.voucherId);
      assert.equal(updatedVoucher?.quantity, 49);
    });

    it('[RB-LQH03, Concurrency] consumeVoucher: khi recordUsage thất bại -> kích hoạt rollback incrementQuantity và bảo toàn quantity', async () => {
      const voucher = await voucherRepo.create({
        ...mockPlatformVoucher,
        voucherId: 'test-voucher-rollback-id',
        code: 'ROLLBACK50',
        quantity: 5,
      });

      // Giả lập recordUsage ném lỗi CSDL
      voucherRepo.recordUsage = async () => {
        throw new Error('Database transaction failure during recordUsage');
      };

      await assert.rejects(
        () => voucherPort.consumeVoucher({
          voucherId: voucher.voucherId,
          orderId: 'order-fail-999',
          buyerId: mockBuyerId,
          discountAmount: '20000.00',
        }),
        (err: unknown) => (err instanceof Error) && err.message.includes('Database transaction failure')
      );

      // Kiểm tra số lượng voucher: phải được hoàn lại 5 nguyên vẹn
      const reloaded = await voucherRepo.findById(voucher.voucherId);
      assert.equal(reloaded?.quantity, 5, 'Số lượng voucher phải giữ nguyên 5 sau khi recordUsage thất bại');
    });
  });

});
