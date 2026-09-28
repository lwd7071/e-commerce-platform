"use client";

import { useEffect, useState, useMemo, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Dialog } from "@/components/ui/dialog";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { cartRepository } from "./cart.repository";
import type { CartItem, CartGroup } from "./cart.types";

export function CartPageContent() {
  return (
    <ProtectedPage allowedRoles={["BUYER"]}>
      <CartScreen />
    </ProtectedPage>
  );
}

export function CartScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Dialog state for deletion confirmation
  const [deleteTarget, setDeleteTarget] = useState<"selected" | string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCart = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const data = await cartRepository.getCart();
      if (mountedRef.current) {
        setItems(data);
      }
    } catch {
      if (mountedRef.current) {
        setError("Không thể tải thông tin giỏ hàng. Vui lòng kiểm tra lại kết nối.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let ignore = false;
    void Promise.resolve()
      .then(() => cartRepository.getCart())
      .then((data) => {
        if (!ignore && mountedRef.current) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore && mountedRef.current) {
          setError("Không thể tải thông tin giỏ hàng. Vui lòng kiểm tra lại kết nối.");
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Group items by shop
  const groupedCart = useMemo<CartGroup[]>(() => {
    const map = new Map<string, { shopName: string; items: CartItem[] }>();
    for (const item of items) {
      if (!map.has(item.shopId)) {
        map.set(item.shopId, { shopName: item.shopName, items: [] });
      }
      map.get(item.shopId)!.items.push(item);
    }
    return Array.from(map.entries()).map(([shopId, { shopName, items }]) => ({
      shopId,
      shopName,
      items,
    }));
  }, [items]);

  // Calculations using moneyAdapter for safe arithmetic
  const selectedItems = useMemo(() => items.filter((i) => i.isSelected), [items]);
  const isAllSelected = items.length > 0 && selectedItems.length === items.length;

  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => {
      const priceInt = moneyAdapter.toInteger(item.price);
      return acc + priceInt * item.quantity;
    }, 0);
  }, [selectedItems]);

  // Optimistic Selection Toggle
  const handleToggleItem = async (itemId: string) => {
    const prevItems = [...items];
    const target = items.find((i) => i.id === itemId);
    if (!target) return;

    const newSelection = !target.isSelected;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isSelected: newSelection } : i))
    );

    try {
      await cartRepository.updateItem(itemId, { is_selected: newSelection });
    } catch {
      // Rollback on failure
      setItems(prevItems);
      showNotice("Không thể cập nhật lựa chọn sản phẩm.");
    }
  };

  // Optimistic Shop Selection Toggle
  const handleToggleShop = async (shopId: string, currentSelected: boolean) => {
    const prevItems = [...items];
    const newSelection = !currentSelected;

    setItems((prev) =>
      prev.map((i) => (i.shopId === shopId ? { ...i, isSelected: newSelection } : i))
    );

    try {
      const shopItems = items.filter((i) => i.shopId === shopId);
      await Promise.all(
        shopItems.map((item) =>
          cartRepository.updateItem(item.id, { is_selected: newSelection })
        )
      );
    } catch {
      setItems(prevItems);
      showNotice("Không thể cập nhật lựa chọn cửa hàng.");
    }
  };

  // Optimistic Select All Toggle
  const handleToggleAll = async () => {
    const prevItems = [...items];
    const newSelection = !isAllSelected;

    setItems((prev) => prev.map((i) => ({ ...i, isSelected: newSelection })));

    try {
      await Promise.all(
        items.map((item) =>
          cartRepository.updateItem(item.id, { is_selected: newSelection })
        )
      );
    } catch {
      setItems(prevItems);
      showNotice("Không thể cập nhật tất cả sản phẩm.");
    }
  };

  // Optimistic Quantity Change
  const handleQuantityChange = async (itemId: string, delta: number) => {
    const prevItems = [...items];
    const target = items.find((i) => i.id === itemId);
    if (!target) return;

    const newQty = Math.max(1, Math.min(target.stock, target.quantity + delta));
    if (newQty === target.quantity) return;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i))
    );

    try {
      await cartRepository.updateItem(itemId, { quantity: newQty });
    } catch {
      // Rollback
      setItems(prevItems);
      showNotice("Không thể cập nhật số lượng.");
    }
  };

  // Delete Action Confirm
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const prevItems = [...items];

    try {
      if (deleteTarget === "selected") {
        setItems((prev) => prev.filter((i) => !i.isSelected));
        await cartRepository.removeSelected();
        showNotice("Đã xóa các sản phẩm được chọn khỏi giỏ hàng.");
      } else {
        setItems((prev) => prev.filter((i) => i.id !== deleteTarget));
        await cartRepository.removeItem(deleteTarget);
        showNotice("Đã xóa sản phẩm khỏi giỏ hàng.");
      }
    } catch {
      setItems(prevItems);
      showNotice("Không thể xóa sản phẩm. Vui lòng thử lại.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleProceedToCheckout = () => {
    if (selectedItems.length === 0) return;
    startTransition(() => {
      router.push("/checkout");
    });
  };

  if (loading) {
    return (
      <div className="cart-page max-w-4xl mx-auto space-y-6">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Dino Shopping</p>
            <h1 className="page-title">Giỏ hàng của bạn</h1>
          </div>
        </header>
        <div className="surface-card p-6 space-y-4">
          <Skeleton height={28} />
          <Skeleton height={80} />
          <Skeleton height={80} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cart-page max-w-4xl mx-auto">
        <ErrorState
          title="Không thể tải giỏ hàng"
          description={error}
          onRetry={loadCart}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="cart-page max-w-4xl mx-auto">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Dino Shopping</p>
            <h1 className="page-title">Giỏ hàng của bạn</h1>
          </div>
        </header>
        <EmptyState
          icon="bag"
          title="Giỏ hàng trống"
          description="Chưa có sản phẩm nào trong giỏ hàng. Hãy khám phá các ưu đãi đặc biệt từ Dino."
          action={{
            label: "Khám phá sản phẩm",
            onClick: () => router.push("/"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="cart-page max-w-4xl mx-auto space-y-6 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="notice notice--info fixed top-20 right-4 z-50 shadow-md transition-all">
          <Icon name="info" />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="page-heading">
        <div>
          <p className="eyebrow">Dino Shopping</p>
          <h1 className="page-title">Giỏ hàng ({items.length} sản phẩm)</h1>
          <p className="page-description">
            Chọn sản phẩm bạn muốn đặt hàng. Giá và số lượng được cập nhật theo thời gian thực.
          </p>
        </div>
      </header>

      {/* Select All & Actions Bar */}
      <section className="surface-card p-4 flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-5 h-5 accent-[var(--primary-active)] cursor-pointer"
            checked={isAllSelected}
            onChange={handleToggleAll}
          />
          <span className="font-medium text-sm">
            Chọn tất cả ({items.length} sản phẩm)
          </span>
        </label>

        {selectedItems.length > 0 && (
          <button
            type="button"
            className="text-sm text-[var(--danger)] hover:underline flex items-center gap-1 font-medium"
            onClick={() => setDeleteTarget("selected")}
          >
            <Icon name="close" className="w-4 h-4" />
            <span>Xóa {selectedItems.length} sản phẩm đã chọn</span>
          </button>
        )}
      </section>

      {/* Cart Items Grouped by Shop */}
      <div className="space-y-4">
        {groupedCart.map((group) => {
          const isShopAllSelected = group.items.every((i) => i.isSelected);

          return (
            <section
              key={group.shopId}
              className="surface-card p-4 space-y-4"
              aria-labelledby={`shop-heading-${group.shopId}`}
            >
              {/* Shop Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-[var(--primary-active)] cursor-pointer"
                  checked={isShopAllSelected}
                  onChange={() => handleToggleShop(group.shopId, isShopAllSelected)}
                  aria-label={`Chọn tất cả sản phẩm của ${group.shopName}`}
                />
                <h2
                  id={`shop-heading-${group.shopId}`}
                  className="font-semibold text-sm flex items-center gap-2"
                >
                  <Icon name="grid" className="w-4 h-4 text-[var(--subtext)]" />
                  <span>{group.shopName}</span>
                </h2>
              </div>

              {/* Items in Shop */}
              <div className="space-y-4">
                {group.items.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 rounded-lg hover:bg-[var(--card-muted)] transition-colors"
                  >
                    {/* Checkbox & Product Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[var(--primary-active)] cursor-pointer mt-2"
                        checked={item.isSelected}
                        onChange={() => handleToggleItem(item.id)}
                        aria-label={`Chọn sản phẩm ${item.productName}`}
                      />

                      {/* Product Thumbnail */}
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-[var(--border)] shrink-0 flex items-center justify-center">
                        {item.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon name="bag" className="w-6 h-6 text-[var(--subtext)]" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${item.productId}`}
                          className="font-medium text-sm hover:underline line-clamp-2"
                        >
                          {item.productName}
                        </Link>
                        <p className="text-xs text-[var(--subtext)] mt-0.5">
                          Phân loại: {item.variantName}
                        </p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-semibold text-sm text-[var(--foreground)] tabular-nums">
                            {moneyAdapter.formatVND(item.price)}
                          </span>
                          {item.originalPrice && (
                            <span className="text-xs line-through text-[var(--subtext)] tabular-nums">
                              {moneyAdapter.formatVND(item.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantity controls & Delete */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                      {/* Stepper */}
                      <div className="flex items-center border border-[var(--border)] rounded-md bg-[var(--card)]">
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-sm font-semibold hover:bg-[var(--card-muted)] disabled:opacity-40"
                          disabled={item.quantity <= 1}
                          onClick={() => handleQuantityChange(item.id, -1)}
                          aria-label="Giảm số lượng"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-medium tabular-nums select-none">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-sm font-semibold hover:bg-[var(--card-muted)] disabled:opacity-40"
                          disabled={item.quantity >= item.stock}
                          onClick={() => handleQuantityChange(item.id, 1)}
                          aria-label="Tăng số lượng"
                        >
                          +
                        </button>
                      </div>

                      {/* Item Total */}
                      <div className="text-right min-w-[90px]">
                        <span className="font-semibold text-sm tabular-nums">
                          {moneyAdapter.formatVND(
                            moneyAdapter.toInteger(item.price) * item.quantity
                          )}
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        className="text-xs text-[var(--subtext)] hover:text-[var(--danger)] p-1.5 transition-colors"
                        onClick={() => setDeleteTarget(item.id)}
                        aria-label={`Xóa ${item.productName}`}
                      >
                        <Icon name="close" className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Sticky Bottom Order Summary Bar */}
      <footer className="surface-card p-4 sticky bottom-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-4 border border-[var(--border)] shadow-md">
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              className="w-5 h-5 accent-[var(--primary-active)] cursor-pointer"
              checked={isAllSelected}
              onChange={handleToggleAll}
            />
            <span>Tất cả ({items.length})</span>
          </label>
          <div className="text-sm text-[var(--subtext)]">
            Đã chọn: <strong className="text-[var(--foreground)]">{selectedItems.length}</strong>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
          <div className="text-right">
            <p className="text-xs text-[var(--subtext)]">Tổng thanh toán:</p>
            <p className="text-lg font-bold text-[var(--primary-active)] tabular-nums">
              {moneyAdapter.formatVND(subtotal)}
            </p>
          </div>

          <Button
            variant="primary"
            disabled={selectedItems.length === 0}
            onClick={handleProceedToCheckout}
            className="px-6 py-2.5"
          >
            Mua hàng ({selectedItems.length})
          </Button>
        </div>
      </footer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xác nhận xóa"
        description={
          deleteTarget === "selected"
            ? `Bạn có chắc muốn xóa ${selectedItems.length} sản phẩm đã chọn khỏi giỏ hàng?`
            : "Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?"
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={isDeleting}
              onClick={confirmDelete}
            >
              Xác nhận xóa
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--subtext)]">
          Thao tác này sẽ xóa sản phẩm khỏi giỏ hàng của bạn. Bạn vẫn có thể tìm kiếm và thêm lại sau.
        </p>
      </Dialog>
    </div>
  );
}
