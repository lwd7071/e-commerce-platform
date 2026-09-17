import type { UUID } from '../domain/types';

export interface SelectedCartItemSnapshot {
  cartItemId: UUID;
  variantId: UUID;
  quantity: number;
  isSelected: boolean;
}

export interface ICartPort {
  /**
   * Lấy các dòng cart được chọn (is_selected = true) của một buyer
   * Dùng cho Người 5 để tạo OrderItem snapshot trong transaction checkout
   */
  getSelectedItems(buyerId: UUID): Promise<SelectedCartItemSnapshot[]>;

  /**
   * Xóa hoặc bỏ chọn các CartItem đã checkout thành công
   * Được gọi ở bước 12 của transaction tạo Order (order-workflow-transactions.md)
   */
  clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void>;
}
