"use client";

import { useEffect, useState, useMemo, useTransition, useRef, useContext } from "react";
import { useRouter } from "next/navigation";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextInput } from "@/components/ui/form-controls";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { AuthContext } from "@/lib/auth/auth-context";
import { AppError } from "@/lib/api/app-error";
import { cartRepository } from "../cart/cart.repository";
import type { CartItem, CartGroup } from "../cart/cart.types";
import { checkoutRepository } from "./checkout.repository";
import type {
  CheckoutAddress,
  CreateAddressInput,
  PaymentMethod,
  CheckoutPayload,
  CheckoutResult,
} from "./checkout.types";
import {
  getOrCreateIdempotencyKey,
  clearIdempotencySnapshot,
} from "./idempotency";
import { classifyCheckoutError } from "./checkout-error-classifier";
import { AdministrativeAddressFields } from "@/components/forms/administrative-address-fields";

export function CheckoutPageContent() {
  return (
    <ProtectedPage allowedRoles={["BUYER"]}>
      <CheckoutScreen />
    </ProtectedPage>
  );
}

export function CheckoutScreen() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // State: Selected Cart Items
  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // State: Addresses
  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [shippingQuotes, setShippingQuotes] = useState<Array<{ shop_id: string; fee: string; weight_grams: number; provider: 'mock' | 'ghtk' }>>([]);
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState<string | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isNewAddressModalOpen, setIsNewAddressModalOpen] = useState(false);

  // New Address Form State
  const [newAddrName, setNewAddrName] = useState("");
  const [newAddrPhone, setNewAddrPhone] = useState("");
  const [newAddrProvince, setNewAddrProvince] = useState("");
  const [newAddrProvinceCode, setNewAddrProvinceCode] = useState("");
  const [newAddrWard, setNewAddrWard] = useState("");
  const [newAddrWardCode, setNewAddrWardCode] = useState("");
  const [newAddrDetail, setNewAddrDetail] = useState("");
  const [newAddrDefault, setNewAddrDefault] = useState(false);
  const [addrFormErrors, setAddrFormErrors] = useState<Record<string, string>>({});
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // State: Vouchers (shopId -> { code, discountAmount })
  const [appliedVouchers, setAppliedVouchers] = useState<
    Record<string, { code: string; discountAmount: number }>
  >({});
  const [voucherInputs, setVoucherInputs] = useState<Record<string, string>>({});
  const [voucherErrors, setVoucherErrors] = useState<Record<string, string>>({});
  const [isEvaluatingVoucher, setIsEvaluatingVoucher] = useState<string | null>(null);

  // State: Payment Method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");

  // State: Submitting Order
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [postSubmitNavigationError, setPostSubmitNavigationError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<CheckoutResult | null>(null);

  const submittingRef = useRef(false);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const auth = useContext(AuthContext);
  const signOut = auth?.logout || (async () => {});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  const handleRetryCheckoutData = async () => {
    if (!mountedRef.current) return;
    setLoadingItems(true);
    setSubmitError(null);
    try {
      const [allCart, addrs] = await Promise.all([
        cartRepository.getCart(),
        checkoutRepository.getAddresses(),
      ]);
      if (mountedRef.current) {
        const selected = allCart.filter((i) => i.isSelected);
        setItems(selected);
        setAddresses(addrs);
        const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.addressId);
        }
      }
    } catch {
      if (mountedRef.current) {
        setSubmitError("Không thể tải thông tin thanh toán. Vui lòng thử lại.");
      }
    } finally {
      if (mountedRef.current) {
        setLoadingItems(false);
      }
    }
  };

  useEffect(() => {
    let ignore = false;
    void Promise.resolve()
      .then(() => Promise.all([cartRepository.getCart(), checkoutRepository.getAddresses()]))
      .then(([allCart, addrs]) => {
        if (!ignore && mountedRef.current) {
          const selected = allCart.filter((i) => i.isSelected);
          setItems(selected);
          setAddresses(addrs);
          const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.addressId);
          }
          setLoadingItems(false);
        }
      })
      .catch(() => {
        if (!ignore && mountedRef.current) {
          setSubmitError("Không thể tải thông tin thanh toán. Vui lòng thử lại.");
          setLoadingItems(false);
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

  // Selected address object
  const currentAddress = useMemo(() => {
    return addresses.find((a) => a.addressId === selectedAddressId) || null;
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!selectedAddressId || items.length === 0) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setShippingQuoteLoading(true);
        setShippingQuoteError(null);
        return checkoutRepository.quoteShipping(selectedAddressId, [...new Set(items.map(item => item.shopId))]);
      })
      .then(quotes => { if (!cancelled && quotes) setShippingQuotes(quotes); })
      .catch((error: unknown) => {
        if (!cancelled) { setShippingQuotes([]); setShippingQuoteError(error instanceof Error ? error.message : 'Không thể tính phí vận chuyển.'); }
      })
      .finally(() => { if (!cancelled) setShippingQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [selectedAddressId, items]);

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const p = moneyAdapter.toInteger(item.price);
      return acc + p * item.quantity;
    }, 0);
  }, [items]);

  const totalDiscount = useMemo(() => {
    return Object.values(appliedVouchers).reduce(
      (acc, v) => acc + (v.discountAmount || 0),
      0
    );
  }, [appliedVouchers]);

  const shippingFee = selectedAddressId && items.length > 0
    ? shippingQuotes.reduce((sum, quote) => sum + moneyAdapter.toInteger(quote.fee), 0)
    : 0;

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal + shippingFee - totalDiscount);
  }, [subtotal, shippingFee, totalDiscount]);

  // Voucher validation and apply per shop
  const handleApplyVoucher = async (shopId: string) => {
    const code = (voucherInputs[shopId] || "").trim();
    if (!code) {
      setVoucherErrors((prev) => ({ ...prev, [shopId]: "Vui lòng nhập mã giảm giá" }));
      return;
    }

    setVoucherErrors((prev) => ({ ...prev, [shopId]: "" }));
    setIsEvaluatingVoucher(shopId);

    // Calculate shop subtotal
    const shopItems = items.filter((i) => i.shopId === shopId);
    const shopSubtotal = shopItems.reduce((acc, i) => {
      return acc + moneyAdapter.toInteger(i.price) * i.quantity;
    }, 0);

    try {
      const res = await checkoutRepository.evaluateVoucher(
        code,
        moneyAdapter.toWireDecimal(shopSubtotal),
        shopId
      );

      if (res.isValid) {
        const discountInt = moneyAdapter.toInteger(res.discountAmount);
        setAppliedVouchers((prev) => ({
          ...prev,
          [shopId]: { code: code.toUpperCase(), discountAmount: discountInt },
        }));
        setVoucherInputs((prev) => ({ ...prev, [shopId]: "" }));
      } else {
        setVoucherErrors((prev) => ({
          ...prev,
          [shopId]: res.errorMessage || "Mã không hợp lệ",
        }));
      }
    } catch {
      setVoucherErrors((prev) => ({
        ...prev,
        [shopId]: "Không thể kiểm tra mã khuyến mãi. Vui lòng thử lại.",
      }));
    } finally {
      setIsEvaluatingVoucher(null);
    }
  };

  const handleRemoveVoucher = (shopId: string) => {
    setAppliedVouchers((prev) => {
      const next = { ...prev };
      delete next[shopId];
      return next;
    });
    setVoucherErrors((prev) => ({ ...prev, [shopId]: "" }));
  };

  // Add Address validation and submit
  const handleSaveNewAddress = async () => {
    const errors: Record<string, string> = {};
    if (!newAddrName.trim()) errors.name = "Họ và tên người nhận không được để trống";
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(newAddrPhone.trim())) {
      errors.phone = "Số điện thoại không hợp lệ (ví dụ: 0901234567)";
    }
    if (!newAddrProvinceCode) errors.province = "Vui lòng chọn Tỉnh / Thành phố";
    if (!newAddrWardCode) errors.ward = "Vui lòng chọn Phường / Xã";
    if (!newAddrDetail.trim()) errors.detail = "Vui lòng nhập địa chỉ cụ thể (Số nhà, tên đường)";

    if (Object.keys(errors).length > 0) {
      setAddrFormErrors(errors);
      return;
    }

    setAddrFormErrors({});
    setIsSavingAddress(true);

    const payload: CreateAddressInput = {
      recipient_name: newAddrName.trim(),
      phone: newAddrPhone.trim(),
      province: newAddrProvince.trim(),
      province_code: newAddrProvinceCode,
      ward: newAddrWard.trim(),
      ward_code: newAddrWardCode,
      detail_address: newAddrDetail.trim(),
      is_default: newAddrDefault,
    };

    try {
      const created = await checkoutRepository.createAddress(payload);
      setAddresses((prev) => [created, ...prev]);
      setSelectedAddressId(created.addressId);
      setIsNewAddressModalOpen(false);
      // Reset form
      setNewAddrName("");
      setNewAddrPhone("");
      setNewAddrProvince("");
      setNewAddrProvinceCode("");
      setNewAddrWard("");
      setNewAddrWardCode("");
      setNewAddrDetail("");
      setNewAddrDefault(false);
    } catch {
      setAddrFormErrors({ general: "Không thể lưu địa chỉ. Vui lòng thử lại." });
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Submit Checkout with Idempotency Key & Complete Error Handling Policy
  const handlePlaceOrder = async () => {
    // 1. Double-click guard đồng bộ bằng useRef và kiểm tra điều kiện tiên quyết
    if (submittingRef.current || !selectedAddressId || items.length === 0 || shippingQuoteLoading || !!shippingQuoteError || shippingQuotes.length === 0) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setPostSubmitNavigationError(null);

    // Format vouchers payload according to contract
    const vouchersPayload = Object.entries(appliedVouchers).map(([shopId, v]) => ({
      shop_id: shopId,
      code: v.code,
    }));

    const payload: CheckoutPayload = {
      address_id: selectedAddressId,
      payment_method: paymentMethod,
      vouchers: vouchersPayload,
      expected_shipping_fees: shippingQuotes.map(({ shop_id, fee }) => ({ shop_id, fee })),
    };

    // 2. Submit đơn hàng trong khối try/catch RIÊNG BIỆT
    let checkoutResult: CheckoutResult;
    try {
      const { key: idempotencyKey } = getOrCreateIdempotencyKey(payload);
      checkoutResult = await checkoutRepository.submitCheckout(payload, idempotencyKey);
    } catch (err: unknown) {
      if (err instanceof AppError && err.code === 'SHIPPING_QUOTE_CHANGED') {
        const details = err.details as { quotes?: Array<{ shop_id: string; fee: string; weight_grams: number; provider: 'mock' | 'ghtk' }> } | undefined;
        if (details?.quotes && Array.isArray(details.quotes)) setShippingQuotes(details.quotes);
        clearIdempotencySnapshot();
        submittingRef.current = false;
        setIsSubmitting(false);
        setSubmitError('Phí vận chuyển vừa thay đổi. Hãy kiểm tra tổng tiền mới rồi đặt hàng lại.');
        return;
      }
      const errorType = classifyCheckoutError(err);
      switch (errorType) {
        case "GROUP_A":
          clearIdempotencySnapshot();
          submittingRef.current = false;
          setIsSubmitting(false);
          if (err instanceof AppError && err.code === "INVENTORY_INSUFFICIENT") {
            // Tự động làm mới giỏ hàng
            void cartRepository.getCart().then((c) => {
              if (mountedRef.current) {
                setItems(c.filter((i) => i.isSelected));
              }
            });
          }
          break;

        case "USER_LOCKED":
          clearIdempotencySnapshot();
          try {
            await signOut();
          } catch (signOutErr) {
            console.warn("signOut error:", signOutErr);
          } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
            router.push("/login?reason=locked");
          }
          return;

        case "AUTH":
          // Giữ nguyên snapshot (Nhóm B). Đăng nhập lại rồi submit tiếp vẫn an toàn.
          submittingRef.current = false;
          setIsSubmitting(false);
          setSubmitError("Phiên đăng nhập đã hết hạn. Đang chuyển hướng...");
          router.push("/login?returnTo=/checkout");
          return;

        case "IN_PROGRESS":
          // Giữ nguyên snapshot & key cũ. Disable submit 3s.
          if (progressTimerRef.current) {
            clearTimeout(progressTimerRef.current);
          }
          progressTimerRef.current = setTimeout(() => {
            submittingRef.current = false;
            setIsSubmitting(false);
            progressTimerRef.current = null;
          }, 3000);
          break;

        case "GROUP_B":
        default:
          // Lỗi mạng, 500, 504 Timeout: GIỮ NGUYÊN key snapshot cho lần retry
          submittingRef.current = false;
          setIsSubmitting(false);
          break;
      }

      // Display formatted user error message
      if (err instanceof AppError) {
        if (err.code === "REQUEST_IN_PROGRESS") {
          setSubmitError("Yêu cầu đặt hàng đang được xử lý. Vui lòng chờ trong giây lát.");
        } else if (err.code === "IDEMPOTENCY_KEY_REUSED") {
          setSubmitError("Mã giao dịch bị trùng lặp với phiên trước. Vui lòng bấm Đặt hàng lại để tiếp tục.");
        } else if (err.code === "INVENTORY_INSUFFICIENT") {
          setSubmitError("Một số sản phẩm trong giỏ đã hết hàng hoặc không đủ tồn kho.");
        } else if (err.code === "VOUCHER_NOT_APPLICABLE" || err.code === "VOUCHER_NOT_FOUND") {
          setSubmitError("Mã ưu đãi không đủ điều kiện hoặc đã hết hạn.");
        } else if (err.code === "VALIDATION_FAILED") {
          setSubmitError("Dữ liệu đặt hàng không hợp lệ. Vui lòng kiểm tra lại thông tin.");
        } else if (err.status === 504 || err.code === "TIMEOUT") {
          setSubmitError("Kết nối quá hạn. Vui lòng thử lại sau.");
        } else if (err.status >= 500) {
          const reqMsg = err.requestId ? ` (Mã yêu cầu: ${err.requestId})` : "";
          setSubmitError(`Hệ thống gặp sự cố. Vui lòng thử lại sau${reqMsg}.`);
        } else {
          setSubmitError(err.message || "Đặt hàng không thành công. Vui lòng thử lại.");
        }
      } else if (err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"))) {
        setSubmitError("Mất kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại.");
      } else {
        setSubmitError("Đã có lỗi xảy ra khi xử lý đơn hàng. Vui lòng thử lại.");
      }
      return;
    }

    // 3. ĐẶT HÀNG THÀNH CÔNG: Toàn bộ phần sau này nằm NGOÀI try/catch của submitCheckout!
    // Tuyệt đối KHÔNG reset submittingRef và isSubmitting về false (chống submit lần 2).
    clearIdempotencySnapshot();

    // 4. Fire-and-forget: Dọn giỏ hàng không block luồng điều hướng
    void cartRepository.removeSelected().catch((cleanupErr) => {
      console.warn("Dọn giỏ hàng sau checkout thất bại, không chặn luồng đơn hàng:", cleanupErr);
    });

    // 5. Kiểm tra tường minh orders & Điều hướng an toàn sang /orders (Người 5)
    if (!checkoutResult.orders || checkoutResult.orders.length === 0) {
      setPostSubmitNavigationError(
        "Đơn hàng đã được tạo thành công nhưng không tìm thấy thông tin đơn. Vui lòng vào trang Đơn mua để kiểm tra."
      );
      return;
    }

    setSuccessResult(checkoutResult);
    const orderIds = checkoutResult.orders.map((o) => o.order_id).join(",");
    router.push(`/orders?created=${orderIds}`);
  };

  if (loadingItems) {
    return (
      <div className="checkout-page max-w-4xl mx-auto space-y-6">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Dino Checkout</p>
            <h1 className="page-title">Thanh toán đơn hàng</h1>
          </div>
        </header>
        <div className="surface-card p-6 space-y-4">
          <Skeleton height={24} />
          <Skeleton height={120} />
          <Skeleton height={200} />
        </div>
      </div>
    );
  }

  if (submitError && items.length === 0 && !successResult) {
    return (
      <div className="checkout-page max-w-4xl mx-auto space-y-6">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Dino Checkout</p>
            <h1 className="page-title">Thanh toán đơn hàng</h1>
          </div>
        </header>
        <ErrorState
          title="Không thể tải thông tin thanh toán"
          description={submitError}
          onRetry={handleRetryCheckoutData}
        />
      </div>
    );
  }

  if (items.length === 0 && !successResult) {
    return (
      <div className="checkout-page max-w-4xl mx-auto">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Dino Checkout</p>
            <h1 className="page-title">Thanh toán đơn hàng</h1>
          </div>
        </header>
        <EmptyState
          icon="bag"
          title="Không có sản phẩm để thanh toán"
          description="Bạn chưa chọn sản phẩm nào trong giỏ hàng. Hãy quay lại giỏ hàng và chọn sản phẩm trước khi thanh toán."
          action={{
            label: "Quay lại giỏ hàng",
            onClick: () => router.push("/cart"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="checkout-page max-w-4xl mx-auto space-y-6 pb-24">
      {/* Page Heading & Stepper */}
      <header className="page-heading">
        <div>
          <p className="eyebrow">Dino Checkout</p>
          <h1 className="page-title">Thanh toán đơn hàng</h1>
          <p className="page-description">
            Vui lòng kiểm tra địa chỉ nhận hàng, danh sách sản phẩm và ưu đãi trước khi đặt hàng.
          </p>
        </div>
      </header>

      {/* Checkout Progress Stepper */}
      <nav aria-label="Tiến trình đặt hàng" className="surface-card p-4">
        <ol className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          <li className="flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[var(--primary-active)]">
            <span className="w-6 h-6 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] border border-[var(--primary-border)] flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span>Địa chỉ nhận</span>
          </li>
          <li className="flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[var(--primary-active)]">
            <span className="w-6 h-6 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] border border-[var(--primary-border)] flex items-center justify-center text-xs font-bold">
              2
            </span>
            <span>Sản phẩm</span>
          </li>
          <li className="flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[var(--primary-active)]">
            <span className="w-6 h-6 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] border border-[var(--primary-border)] flex items-center justify-center text-xs font-bold">
              3
            </span>
            <span>Vận chuyển ({shippingQuoteLoading ? 'Đang tính…' : moneyAdapter.formatVND(shippingFee)})</span>
          </li>
          <li className="flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[var(--primary-active)]">
            <span className="w-6 h-6 rounded-full bg-[var(--primary-active)] text-white flex items-center justify-center text-xs font-bold">
              4
            </span>
            <span>Thanh toán</span>
          </li>
        </ol>
      </nav>

      {postSubmitNavigationError && (
        <div className="notice notice--info" role="alert">
          <Icon name="check" />
          <span>{postSubmitNavigationError}</span>
        </div>
      )}

      {submitError && (
        <div className="notice notice--warning" role="alert">
          <Icon name="warning" />
          <span>{submitError}</span>
        </div>
      )}

      {/* STEP 1: DELIVERY ADDRESS */}
      <section className="surface-card p-6 space-y-4" aria-labelledby="heading-address">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border)] gap-2">
          <h2 id="heading-address" className="text-base font-semibold flex items-center gap-2">
            <Icon name="home" className="text-[var(--primary-active)] w-5 h-5" />
            <span>Địa chỉ nhận hàng</span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              className="text-xs py-2 px-3 min-h-[44px] min-w-[44px]"
              onClick={() => setIsAddressModalOpen(true)}
            >
              Đổi địa chỉ ({addresses.length})
            </Button>
            <Button
              variant="ghost"
              className="text-xs py-2 px-3 min-h-[44px] min-w-[44px]"
              onClick={() => setIsNewAddressModalOpen(true)}
            >
              + Thêm mới
            </Button>
          </div>
        </div>

        {currentAddress ? (
          <div className="space-y-1 text-sm bg-[var(--card-muted)] p-4 rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base text-[var(--foreground)]">
                {currentAddress.recipientName}
              </span>
              <span className="text-[var(--subtext)] font-medium tabular-nums">
                {currentAddress.phone}
              </span>
              {currentAddress.isDefault && (
                <span className="text-xs bg-[var(--primary-surface)] text-[var(--primary-active)] border border-[var(--primary-border)] px-2 py-0.5 rounded font-medium">
                  Mặc định
                </span>
              )}
            </div>
            <p className="text-[var(--foreground)] mt-1">
              {currentAddress.detailAddress}
            </p>
            <p className="text-xs text-[var(--subtext)]">
              {currentAddress.ward}, {currentAddress.district}, {currentAddress.province}
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[var(--card-muted)] text-center space-y-2">
            <p className="text-sm text-[var(--subtext)]">Chưa có địa chỉ nhận hàng nào được lưu.</p>
            <Button variant="primary" onClick={() => setIsNewAddressModalOpen(true)}>
              + Thêm địa chỉ nhận hàng
            </Button>
          </div>
        )}
      </section>

      {/* STEP 2: ORDER ITEMS REVIEW GROUPED BY SHOP */}
      <section className="space-y-4" aria-labelledby="heading-products">
        <h2 id="heading-products" className="text-base font-semibold flex items-center gap-2 px-1">
          <Icon name="bag" className="text-[var(--primary-active)] w-5 h-5" />
          <span>Sản phẩm đặt mua ({items.length} món)</span>
        </h2>

        {groupedCart.map((group) => {
          const shopDiscount = appliedVouchers[group.shopId]?.discountAmount || 0;
          const shopCode = appliedVouchers[group.shopId]?.code;

          return (
            <div
              key={group.shopId}
              className="surface-card p-6 space-y-4"
              aria-labelledby={`checkout-shop-${group.shopId}`}
            >
              {/* Shop Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <h3
                  id={`checkout-shop-${group.shopId}`}
                  className="font-semibold text-sm flex items-center gap-2"
                >
                  <Icon name="grid" className="w-4 h-4 text-[var(--subtext)]" />
                  <span>{group.shopName}</span>
                </h3>
                <span className="text-xs text-[var(--subtext)]">
                  {group.items.length} sản phẩm
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-[var(--card-muted)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-[var(--border)] shrink-0 flex items-center justify-center">
                        {item.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon name="bag" className="w-5 h-5 text-[var(--subtext)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                        <p className="text-xs text-[var(--subtext)] mt-0.5">
                          Phân loại: {item.variantName}
                        </p>
                        <p className="text-xs text-[var(--subtext)]">
                          Số lượng: <strong className="text-[var(--foreground)]">{item.quantity}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-semibold text-sm tabular-nums">
                        {moneyAdapter.formatVND(
                          moneyAdapter.toInteger(item.price) * item.quantity
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shop Voucher & Free Shipping Row */}
              <div className="pt-3 border-t border-[var(--border)] space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--foreground)]">Vận chuyển:</span>
                    <span className="bg-[var(--success-surface)] text-[var(--success)] font-bold px-2 py-0.5 rounded border border-[var(--border)]">
                      0 ₫ Miễn phí vận chuyển
                    </span>
                  </div>

                  {/* Voucher Apply Form */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {shopCode ? (
                      <div className="flex items-center gap-2 bg-[var(--primary-surface)] text-[var(--primary-active)] border border-[var(--primary-border)] px-3 py-1 rounded-md">
                        <span className="font-bold">Mã {shopCode}:</span>
                        <span>-{moneyAdapter.formatVND(shopDiscount)}</span>
                        <button
                          type="button"
                          className="hover:underline font-semibold ml-1 text-xs"
                          onClick={() => handleRemoveVoucher(group.shopId)}
                          aria-label={`Gỡ mã voucher ${shopCode}`}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <TextInput
                          id={`voucher-${group.shopId}`}
                          placeholder="Nhập mã ưu đãi"
                          value={voucherInputs[group.shopId] || ""}
                          onChange={(e) =>
                            setVoucherInputs((prev) => ({
                              ...prev,
                              [group.shopId]: e.target.value,
                            }))
                          }
                          className="py-1 px-2.5 text-xs max-w-[150px]"
                        />
                        <Button
                          variant="secondary"
                          className="py-1 px-3 text-xs"
                          loading={isEvaluatingVoucher === group.shopId}
                          onClick={() => handleApplyVoucher(group.shopId)}
                        >
                          Áp dụng
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {voucherErrors[group.shopId] && (
                  <p className="text-xs text-[var(--danger)]" role="alert">
                    {voucherErrors[group.shopId]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* STEP 3: PAYMENT METHOD */}
      <section className="surface-card p-6 space-y-4" aria-labelledby="heading-payment">
        <h2 id="heading-payment" className="text-base font-semibold flex items-center gap-2 pb-3 border-b border-[var(--border)]">
          <Icon name="check" className="text-[var(--primary-active)] w-5 h-5" />
          <span>Phương thức thanh toán</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label
            className={`cursor-pointer p-4 rounded-xl border flex items-start gap-3 transition-colors ${
              paymentMethod === "COD"
                ? "border-[var(--primary-active)] bg-[var(--primary-surface)]"
                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-muted)]"
            }`}
          >
            <input
              type="radio"
              name="payment_method"
              value="COD"
              checked={paymentMethod === "COD"}
              onChange={() => setPaymentMethod("COD")}
              className="mt-1 accent-[var(--primary-active)]"
            />
            <div>
              <p className="font-semibold text-sm text-[var(--foreground)]">
                Thanh toán khi nhận hàng (COD)
              </p>
              <p className="text-xs text-[var(--subtext)] mt-1">
                Thanh toán bằng tiền mặt khi đơn vị vận chuyển giao hàng tận nơi.
              </p>
            </div>
          </label>

          <label
            className={`cursor-pointer p-4 rounded-xl border flex items-start gap-3 transition-colors ${
              paymentMethod === "ONLINE"
                ? "border-[var(--primary-active)] bg-[var(--primary-surface)]"
                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-muted)]"
            }`}
          >
            <input
              type="radio"
              name="payment_method"
              value="ONLINE"
              checked={paymentMethod === "ONLINE"}
              onChange={() => setPaymentMethod("ONLINE")}
              className="mt-1 accent-[var(--primary-active)]"
            />
            <div>
              <p className="font-semibold text-sm text-[var(--foreground)]">
                Thanh toán trực tuyến (ONLINE)
              </p>
              <p className="text-xs text-[var(--subtext)] mt-1">
                Cổng thanh toán điện tử an toàn, xác nhận đơn hàng lập tức.
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* STEP 4: ORDER SUMMARY & SUBMIT */}
      <section className="surface-card p-6 space-y-4" aria-labelledby="heading-summary">
        <h2 id="heading-summary" className="text-base font-semibold pb-3 border-b border-[var(--border)]">
          Chi tiết thanh toán
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--subtext)]">Tổng tiền hàng:</span>
            <span className="font-medium tabular-nums">{moneyAdapter.formatVND(subtotal)}</span>
          </div>

          <div className="flex justify-between text-[var(--success)]">
            <span>Giảm giá khuyến mãi:</span>
            <span className="font-medium tabular-nums">
              {totalDiscount > 0 ? `-${moneyAdapter.formatVND(totalDiscount)}` : "0 ₫"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[var(--subtext)]">Phí vận chuyển:</span>
            <span className="font-semibold tabular-nums">{shippingQuoteLoading ? 'Đang tính…' : moneyAdapter.formatVND(shippingFee)}</span>
          </div>
          {!shippingQuoteLoading && shippingQuotes.map(quote => {
            const shopName = groupedCart.find(group => group.shopId === quote.shop_id)?.shopName ?? 'Gian hàng';
            return <div key={quote.shop_id} className="flex justify-between pl-3 text-xs text-[var(--subtext)]">
              <span>Giao từ {shopName}</span><span className="tabular-nums">{moneyAdapter.formatVND(moneyAdapter.toInteger(quote.fee))}</span>
            </div>;
          })}
          {shippingQuoteError && <p className="text-sm text-[var(--danger)]" role="alert">{shippingQuoteError}</p>}
          {shippingQuotes.some(quote => quote.provider === 'mock') && <p className="text-xs text-[var(--subtext)]">Phí vận chuyển mô phỏng.</p>}

          <div className="pt-3 border-t border-[var(--border)] flex justify-between items-baseline">
            <span className="font-bold text-base text-[var(--foreground)]">Tổng thanh toán:</span>
            <span className="font-extrabold text-xl text-[var(--primary-active)] tabular-nums">
              {moneyAdapter.formatVND(totalAmount)}
            </span>
          </div>
        </div>

        <div className="pt-2 text-xs text-[var(--subtext)] leading-relaxed">
          Bằng việc nhấn &quot;Đặt hàng&quot;, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của Dino.
          Yêu cầu thanh toán được bảo vệ chống trùng lặp bằng mã định danh an toàn.
        </div>

        <div className="pt-3 flex justify-end">
          <Button
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting || !selectedAddressId || items.length === 0 || shippingQuoteLoading || !!shippingQuoteError || shippingQuotes.length === 0}
            onClick={handlePlaceOrder}
            className="w-full sm:w-auto px-8 py-3 text-base"
          >
            Đặt hàng ngay ({moneyAdapter.formatVND(totalAmount)})
          </Button>
        </div>
      </section>

      {/* DIALOG: SELECT SAVED ADDRESS */}
      <Dialog
        open={isAddressModalOpen}
        onOpenChange={setIsAddressModalOpen}
        title="Chọn địa chỉ nhận hàng"
        description="Chọn từ danh sách địa chỉ đã lưu hoặc tạo địa chỉ mới."
        footer={
          <div className="flex justify-between w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddressModalOpen(false);
                setIsNewAddressModalOpen(true);
              }}
            >
              + Thêm địa chỉ mới
            </Button>
            <Button variant="primary" onClick={() => setIsAddressModalOpen(false)}>
              Xong
            </Button>
          </div>
        }
      >
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {addresses.map((addr) => (
            <label
              key={addr.addressId}
              className={`p-3 rounded-lg border block cursor-pointer transition-colors ${
                addr.addressId === selectedAddressId
                  ? "border-[var(--primary-active)] bg-[var(--primary-surface)]"
                  : "border-[var(--border)] hover:bg-[var(--card-muted)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="selected_address"
                  checked={addr.addressId === selectedAddressId}
                  onChange={() => setSelectedAddressId(addr.addressId)}
                  className="mt-1 accent-[var(--primary-active)]"
                />
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <strong className="text-[var(--foreground)]">{addr.recipientName}</strong>
                    <span className="text-[var(--subtext)]">{addr.phone}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] bg-[var(--primary-surface)] text-[var(--primary-active)] px-1.5 py-0.5 rounded border border-[var(--primary-border)] font-semibold">
                        Mặc định
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--foreground)] mt-1">{addr.detailAddress}</p>
                  <p className="text-[11px] text-[var(--subtext)]">
                    {[addr.ward, addr.district, addr.province].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </Dialog>

      {/* DIALOG: ADD NEW ADDRESS */}
      <Dialog
        open={isNewAddressModalOpen}
        onOpenChange={setIsNewAddressModalOpen}
        title="Thêm địa chỉ nhận hàng mới"
        description="Điền thông tin giao hàng của bạn để hoàn tất đơn hàng."
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={isSavingAddress}
              onClick={() => setIsNewAddressModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              loading={isSavingAddress}
              onClick={handleSaveNewAddress}
            >
              Lưu địa chỉ
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {addrFormErrors.general && (
            <p className="text-xs text-[var(--danger)]" role="alert">
              {addrFormErrors.general}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              id="new-addr-name"
              label="Họ và tên người nhận"
              required
              error={addrFormErrors.name}
            >
              <TextInput
                id="new-addr-name"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={newAddrName}
                onChange={(e) => setNewAddrName(e.target.value)}
              />
            </FormField>

            <FormField
              id="new-addr-phone"
              label="Số điện thoại"
              required
              error={addrFormErrors.phone}
            >
              <TextInput
                id="new-addr-phone"
                placeholder="Ví dụ: 0901234567"
                value={newAddrPhone}
                onChange={(e) => setNewAddrPhone(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <AdministrativeAddressFields
              provinceCode={newAddrProvinceCode}
              wardCode={newAddrWardCode}
              onProvinceChange={(code, name) => { setNewAddrProvinceCode(code); setNewAddrProvince(name); setNewAddrWardCode(""); setNewAddrWard(""); }}
              onWardChange={(code, name) => { setNewAddrWardCode(code); setNewAddrWard(name); }}
            />
            {(addrFormErrors.province || addrFormErrors.ward) && <p className="text-sm text-[var(--danger)]" role="alert">{addrFormErrors.province ?? addrFormErrors.ward}</p>}
          </div>

          <FormField
            id="new-addr-detail"
            label="Địa chỉ cụ thể (Số nhà, đường, tòa nhà)"
            required
            error={addrFormErrors.detail}
          >
            <TextInput
              id="new-addr-detail"
              placeholder="Ví dụ: 123 Đường Lê Lợi, Căn hộ 402"
              value={newAddrDetail}
              onChange={(e) => setNewAddrDetail(e.target.value)}
            />
          </FormField>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--subtext)]">
            <input
              type="checkbox"
              checked={newAddrDefault}
              onChange={(e) => setNewAddrDefault(e.target.checked)}
              className="accent-[var(--primary-active)]"
            />
            <span>Đặt làm địa chỉ nhận hàng mặc định</span>
          </label>
        </div>
      </Dialog>

      {/* DIALOG: ORDER SUCCESSFUL */}
      <Dialog
        open={successResult !== null}
        onOpenChange={() => {}}
        title="Đặt hàng thành công!"
        description="Đơn hàng của bạn đã được ghi nhận vào hệ thống Dino."
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => {
                startTransition(() => {
                  router.push("/");
                });
              }}
            >
              Tiếp tục mua sắm
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const createdIds = successResult?.orders?.map((o) => o.order_id).filter(Boolean).join(",");
                const targetUrl = createdIds ? `/orders?created=${createdIds}` : "/orders";
                startTransition(() => {
                  router.push(targetUrl);
                });
              }}
            >
              Xem đơn hàng
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--success-surface)] text-[var(--success)] flex items-center justify-center">
            <Icon name="check" className="w-8 h-8" />
          </div>

          <div>
            <p className="font-semibold text-base text-[var(--foreground)]">
              Cảm ơn bạn đã mua hàng tại Dino!
            </p>
            <p className="text-xs text-[var(--subtext)] mt-1">
              Mã đơn hàng và thông tin vận chuyển đã được chuyển tới người bán để chuẩn bị hàng.
            </p>
          </div>

          {successResult && successResult.orders.length > 0 && (
            <div className="p-3 bg-[var(--card-muted)] rounded-lg text-left text-xs space-y-1 border border-[var(--border)]">
              {successResult.orders.map((ord) => (
                <div key={ord.order_id} className="flex justify-between items-center py-1">
                  <span>Mã đơn: <strong className="font-mono">{ord.order_id}</strong></span>
                  <span className="font-semibold text-[var(--primary-active)] tabular-nums">
                    {moneyAdapter.formatVND(ord.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
