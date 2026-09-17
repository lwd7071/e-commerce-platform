import type { UUID, CartItem } from '../domain/types';
import type { ICartPort, SelectedCartItemSnapshot } from '../ports/cart.port';
import type { ICartRepository } from '../domain/repositories';

export class CartPortService implements ICartPort {
  private cartRepo: ICartRepository;

  constructor(cartRepo: ICartRepository) {
    this.cartRepo = cartRepo;
  }

  async getSelectedItems(buyerId: UUID): Promise<SelectedCartItemSnapshot[]> {
    const cart = await this.cartRepo.findByBuyerId(buyerId);
    if (!cart) {
      return [];
    }

    const items = await this.cartRepo.getItems(cart.cartId);
    return items
      .filter(item => item.isSelected)
      .map(item => ({
        cartItemId: item.cartItemId,
        variantId: item.variantId,
        quantity: item.quantity,
        isSelected: item.isSelected,
      }));
  }

  async clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void> {
    await this.cartRepo.clearCheckedOutItems(buyerId, cartItemIds);
  }
}
