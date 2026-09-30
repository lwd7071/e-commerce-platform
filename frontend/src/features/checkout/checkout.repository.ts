import { apiClient } from "@/lib/api/client";
import { features } from "@/lib/config/features";
import { registerCreatedOrder } from "@/lib/repositories/repository-factory";
import type {
  CheckoutAddress,
  CreateAddressInput,
  CheckoutVoucher,
  VoucherEvaluationResult,
  CheckoutPayload,
  CheckoutResult,
} from "./checkout.types";

export interface ICheckoutRepository {
  getAddresses(): Promise<CheckoutAddress[]>;
  createAddress(input: CreateAddressInput): Promise<CheckoutAddress>;
  getVouchers(shopId?: string): Promise<CheckoutVoucher[]>;
  evaluateVoucher(code: string, subtotal: string, shopId?: string): Promise<VoucherEvaluationResult>;
  submitCheckout(payload: CheckoutPayload, idempotencyKey: string): Promise<CheckoutResult>;
}

// Initial address fixtures
const INITIAL_ADDRESSES: CheckoutAddress[] = [
  {
    addressId: "addr_01",
    recipientName: "Nguyễn Văn A",
    phone: "0901234567",
    province: "Thành phố Hồ Chí Minh",
    district: "Quận 1",
    ward: "Phường Bến Nghé",
    detailAddress: "123 Đường Lê Lợi, Tòa nhà Bitexco",
    isDefault: true,
  },
  {
    addressId: "addr_02",
    recipientName: "Nguyễn Văn A (Văn phòng)",
    phone: "0901234567",
    province: "Thành phố Hồ Chí Minh",
    district: "Quận 3",
    ward: "Phường 6",
    detailAddress: "45 Đường Nam Kỳ Khởi Nghĩa",
    isDefault: false,
  },
];

// Initial vouchers fixtures
const INITIAL_VOUCHERS: CheckoutVoucher[] = [
  {
    voucherId: "vouch_dino50",
    code: "DINO50K",
    voucherName: "Ưu đãi Dino 50.000₫ cho đơn từ 200.000₫",
    scope: "PLATFORM",
    shopId: null,
    discountType: "FIXED",
    discountValue: "50000.00",
    maxDiscount: null,
    minOrderValue: "200000.00",
  },
  {
    voucherId: "vouch_shop10",
    code: "MORI10",
    voucherName: "Giảm 10% cho shop Dino Fashion",
    scope: "SHOP",
    shopId: "shop_01",
    discountType: "PERCENT",
    discountValue: "10.00",
    maxDiscount: "40000.00",
    minOrderValue: "150000.00",
  },
];

const ADDRESS_STORAGE_KEY = "dino_user_addresses_v1";
const memoryAddressStore = new Map<string, string>();

export class MockCheckoutRepository implements ICheckoutRepository {
  private getStoredAddresses(): CheckoutAddress[] {
    let data: string | null = null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        data = window.sessionStorage.getItem(ADDRESS_STORAGE_KEY);
      } catch {
        // Fallback
      }
    } else {
      data = memoryAddressStore.get(ADDRESS_STORAGE_KEY) || null;
    }

    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        // Fallback
      }
    }

    this.saveStoredAddresses(INITIAL_ADDRESSES);
    return [...INITIAL_ADDRESSES];
  }

  private saveStoredAddresses(addresses: CheckoutAddress[]): void {
    const serialized = JSON.stringify(addresses);
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(ADDRESS_STORAGE_KEY, serialized);
        return;
      } catch {
        // Fallback
      }
    }
    memoryAddressStore.set(ADDRESS_STORAGE_KEY, serialized);
  }

  async getAddresses(): Promise<CheckoutAddress[]> {
    return this.getStoredAddresses();
  }

  async createAddress(input: CreateAddressInput): Promise<CheckoutAddress> {
    const list = this.getStoredAddresses();
    const newAddress: CheckoutAddress = {
      addressId: `addr_${Date.now()}`,
      recipientName: input.recipientName || input.recipient_name || "",
      phone: input.phone,
      province: input.province,
      district: input.district,
      ward: input.ward,
      detailAddress: input.detailAddress || input.detail_address || "",
      isDefault: (input.isDefault ?? input.is_default) || list.length === 0,
    };

    let updatedList = [...list];
    if (newAddress.isDefault) {
      updatedList = updatedList.map((a) => ({ ...a, isDefault: false }));
    }
    updatedList.unshift(newAddress);
    this.saveStoredAddresses(updatedList);
    return newAddress;
  }

  async getVouchers(shopId?: string): Promise<CheckoutVoucher[]> {
    if (!shopId) return INITIAL_VOUCHERS;
    return INITIAL_VOUCHERS.filter((v) => v.scope === "PLATFORM" || v.shopId === shopId);
  }

  async evaluateVoucher(code: string, subtotal: string, shopId?: string): Promise<VoucherEvaluationResult> {
    const subtotalNum = parseFloat(subtotal) || 0;
    const found = INITIAL_VOUCHERS.find(
      (v) => v.code.toUpperCase() === code.trim().toUpperCase() && (v.scope === "PLATFORM" || !shopId || v.shopId === shopId)
    );

    if (!found) {
      return {
        isValid: false,
        errorCode: "VOUCHER_NOT_FOUND",
        errorMessage: "Mã giảm giá không tồn tại hoặc không áp dụng cho cửa hàng này.",
      };
    }

    const minSpend = parseFloat(found.minOrderValue) || 0;
    if (subtotalNum < minSpend) {
      return {
        isValid: false,
        errorCode: "MIN_ORDER_VALUE_NOT_MET",
        errorMessage: `Đơn hàng tối thiểu để áp dụng mã là ${new Intl.NumberFormat("vi-VN").format(minSpend)}₫.`,
      };
    }

    let discount = 0;
    if (found.discountType === "FIXED") {
      discount = parseFloat(found.discountValue);
    } else {
      const pct = parseFloat(found.discountValue) / 100;
      discount = subtotalNum * pct;
      if (found.maxDiscount) {
        discount = Math.min(discount, parseFloat(found.maxDiscount));
      }
    }

    discount = Math.min(discount, subtotalNum);

    return {
      isValid: true,
      voucherId: found.voucherId,
      discountAmount: discount.toFixed(2),
    };
  }

  async submitCheckout(payload: CheckoutPayload, _idempotencyKey?: string): Promise<CheckoutResult> {
    const result: CheckoutResult = {
      orders: [
        {
          order_id: `ord_${Date.now()}`,
          shop_id: payload.vouchers[0]?.shop_id || "00000000-0000-0000-0000-000000000001",
          status: "PENDING_CONFIRMATION",
          total_amount: "579000.00",
          payment_id: `pay_${Date.now()}`,
        },
      ],
    };

    for (const o of result.orders) {
      registerCreatedOrder({
        id: o.order_id,
        shop_id: o.shop_id,
        status: "PENDING_CONFIRMATION",
        total_amount: o.total_amount,
      });
    }

    return result;
  }
}

export class ApiCheckoutRepository implements ICheckoutRepository {
  async getAddresses(): Promise<CheckoutAddress[]> {
    const res = await apiClient.get<Array<{
      addressId: string;
      userId?: string;
      recipientName: string;
      phone: string;
      province: string;
      district: string;
      ward: string;
      detailAddress: string;
      isDefault: boolean;
    }>>("/addresses");

    if (Array.isArray(res)) {
      return res.map((a) => ({
        addressId: a.addressId,
        recipientName: a.recipientName,
        phone: a.phone,
        province: a.province,
        district: a.district,
        ward: a.ward,
        detailAddress: a.detailAddress,
        isDefault: !!a.isDefault,
      }));
    }
    return [];
  }

  async createAddress(input: CreateAddressInput): Promise<CheckoutAddress> {
    const payload = {
      recipientName: (input.recipientName || input.recipient_name || "").trim(),
      phone: (input.phone || "").trim(),
      province: (input.province || "").trim(),
      district: (input.district || "").trim(),
      ward: (input.ward || "").trim(),
      detailAddress: (input.detailAddress || input.detail_address || "").trim(),
      isDefault: input.isDefault ?? input.is_default,
    };
    const res = await apiClient.post<{
      addressId: string;
      recipientName: string;
      phone: string;
      province: string;
      district: string;
      ward: string;
      detailAddress: string;
      isDefault: boolean;
    }>("/addresses", payload);

    return {
      addressId: res.addressId,
      recipientName: res.recipientName,
      phone: res.phone,
      province: res.province,
      district: res.district,
      ward: res.ward,
      detailAddress: res.detailAddress,
      isDefault: !!res.isDefault,
    };
  }

  async getVouchers(shopId?: string): Promise<CheckoutVoucher[]> {
    const res = await apiClient.get<CheckoutVoucher[]>("/vouchers/applicable", {
      params: shopId ? { shop_id: shopId } : undefined,
    });
    return Array.isArray(res) ? res : [];
  }

  async evaluateVoucher(code: string, subtotal: string, shopId?: string): Promise<VoucherEvaluationResult> {
    const res = await apiClient.post<{
      isValid: boolean;
      voucherId?: string;
      discountAmount?: string;
      errorCode?: string;
      errorMessage?: string;
    }>("/vouchers/evaluate", {
      code,
      order_subtotal: subtotal,
      shop_id: shopId,
    });

    if (res.isValid) {
      return {
        isValid: true,
        voucherId: res.voucherId || "vouch_custom",
        discountAmount: res.discountAmount || "0.00",
      };
    } else {
      return {
        isValid: false,
        errorCode: res.errorCode || "VOUCHER_INVALID",
        errorMessage: res.errorMessage || "Mã giảm giá không hợp lệ.",
      };
    }
  }

  async submitCheckout(payload: CheckoutPayload, idempotencyKey: string): Promise<CheckoutResult> {
    const res = await apiClient.post<CheckoutResult>("/checkout", payload, {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });

    if (res?.orders && Array.isArray(res.orders)) {
      for (const o of res.orders) {
        registerCreatedOrder({
          id: o.order_id,
          shop_id: o.shop_id,
          status: "PENDING_CONFIRMATION",
          total_amount: o.total_amount,
        });
      }
    }

    return res;
  }
}

export const checkoutRepository: ICheckoutRepository = features.domains.checkoutMock()
  ? new MockCheckoutRepository()
  : new ApiCheckoutRepository();
