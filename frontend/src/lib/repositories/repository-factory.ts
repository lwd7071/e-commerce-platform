import { features } from "../config/features";
import { catalogApi } from "../api/catalog.api";
import { buyerApi } from "../api/buyer.api";
import { orderApi, type WireOrder } from "../api/order.api";
import { voucherApi } from "../api/voucher.api";
import type {
  ICatalogRepository,
  IBuyerRepository,
  IOrderRepository,
  IVoucherRepository,
} from "./types";

// ==========================================
// 1. Live API Implementations
// ==========================================

const apiCatalogRepository: ICatalogRepository = {
  getProducts: (params) => catalogApi.getProducts(params),
  getProductById: (id) => catalogApi.getProductById(id),
};

const apiBuyerRepository: IBuyerRepository = {
  getProfile: () => buyerApi.getProfile(),
  updateProfile: (data) => buyerApi.updateProfile(data),
  getAddresses: () => buyerApi.getAddresses(),
  createAddress: (data) => buyerApi.createAddress(data),
  getCart: () => buyerApi.getCart(),
  addToCart: (variantId, quantity) => buyerApi.addToCart({ variant_id: variantId, quantity }),
};

const apiOrderRepository: IOrderRepository = {
  getOrders: (params) => orderApi.getOrders(params),
  getOrderById: (id) => orderApi.getOrderById(id),
  confirmOrder: (id, reason) => orderApi.confirmOrder(id, reason),
  transitionOrder: (id, to, reason) => orderApi.transitionOrder(id, { to, reason }),
};

const apiVoucherRepository: IVoucherRepository = {
  getVouchers: () => voucherApi.getVouchers(),
  evaluateVoucher: (code, orderSubtotal, shopId) =>
    voucherApi.evaluateVoucher({ code, order_subtotal: orderSubtotal, shop_id: shopId }),
};

// ==========================================
// 2. Mock / Fixture Implementations
// ==========================================

const mockCatalogRepository: ICatalogRepository = {
  getProducts: async () => [
    {
      id: "prod_01",
      name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
      slug: "serum-duong-trang-cap-am",
      description: "Chiết xuất thiên nhiên dưỡng da sáng hồng rạng rỡ.",
      base_price: "280000.00",
      original_price: "350000.00",
      category_id: "cat_beauty",
      shop_id: "shop_01",
      status: "PUBLISHED",
      media: [{ id: "m1", url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800", is_primary: true }],
      variants: [{ id: "var_01", sku: "SERUM-30ML", name: "Chai 30ml", price: "280000.00", stock: 50 }],
    },
    {
      id: "prod_02",
      name: "Kem Chống Nắng Phổ Rộng SPF 50+ PA++++",
      slug: "kem-chong-nang-pho-rong",
      description: "Bảo vệ da toàn diện, không nhờn rít, nâng tone tự nhiên.",
      base_price: "320000.00",
      original_price: null,
      category_id: "cat_beauty",
      shop_id: "shop_01",
      status: "PUBLISHED",
      media: [{ id: "m2", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800", is_primary: true }],
      variants: [{ id: "var_02", sku: "SUN-50ML", name: "Tuýp 50ml", price: "320000.00", stock: 120 }],
    },
  ],
  getProductById: async (id) => ({
    id,
    name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
    slug: "serum-duong-trang-cap-am",
    description: "Chiết xuất thiên nhiên dưỡng da sáng hồng rạng rỡ.",
    base_price: "280000.00",
    original_price: "350000.00",
    category_id: "cat_beauty",
    shop_id: "shop_01",
    status: "PUBLISHED",
  }),
};

const mockBuyerRepository: IBuyerRepository = {
  getProfile: async () => ({
    id: "user_dev",
    email: "buyer@example.com",
    full_name: "Nguyễn Văn A",
    phone: "0901234567",
    avatar_url: null,
    role: "BUYER",
  }),
  updateProfile: async (data) => ({
    id: "user_dev",
    email: "buyer@example.com",
    full_name: data.full_name || "Nguyễn Văn A",
    phone: data.phone || "0901234567",
    avatar_url: data.avatar_url || null,
    role: "BUYER",
  }),
  getAddresses: async () => [
    {
      id: "addr_01",
      receiver_name: "Nguyễn Văn A",
      phone_number: "0901234567",
      address_line: "123 Đường Nguyễn Huệ",
      ward: "Bến Nghé",
      district: "Quận 1",
      city: "Hồ Chí Minh",
      is_default: true,
    },
  ],
  createAddress: async (data) => ({
    id: `addr_${Date.now()}`,
    ...data,
  }),
  getCart: async () => ({
    id: "cart_01",
    items: [{ id: "ci_01", variant_id: "var_01", quantity: 2, is_selected: true }],
  }),
  addToCart: async () => ({ success: true }),
};

const mockOrderRepository: IOrderRepository = {
  getOrders: async () => [
    {
      id: "order_01",
      order_code: "ORD-2026-001",
      buyer_id: "user_dev",
      shop_id: "shop_01",
      status: "PENDING",
      total_amount: "560000.00",
      shipping_fee: "30000.00",
      discount_amount: "50000.00",
      final_amount: "540000.00",
      created_at: new Date().toISOString(),
    },
  ],
  getOrderById: async (id) => ({
    id,
    order_code: "ORD-2026-001",
    buyer_id: "user_dev",
    shop_id: "shop_01",
    status: "CONFIRMED",
    total_amount: "560000.00",
    shipping_fee: "30000.00",
    discount_amount: "50000.00",
    final_amount: "540000.00",
    created_at: new Date().toISOString(),
  }),
  confirmOrder: async (id) => ({
    id,
    order_code: "ORD-2026-001",
    buyer_id: "user_dev",
    shop_id: "shop_01",
    status: "CONFIRMED",
    total_amount: "560000.00",
    shipping_fee: "30000.00",
    discount_amount: "50000.00",
    final_amount: "540000.00",
    created_at: new Date().toISOString(),
  }),
  transitionOrder: async (id, to) => ({
    id,
    order_code: "ORD-2026-001",
    buyer_id: "user_dev",
    shop_id: "shop_01",
    status: to as WireOrder["status"],
    total_amount: "560000.00",
    shipping_fee: "30000.00",
    discount_amount: "50000.00",
    final_amount: "540000.00",
    created_at: new Date().toISOString(),
  }),
};

const mockVoucherRepository: IVoucherRepository = {
  getVouchers: async () => [
    {
      id: "vouch_01",
      code: "WELCOME50",
      type: "FIXED",
      discount_value: "50000.00",
      min_order_value: "200000.00",
      max_discount: null,
      start_at: "2026-01-01T00:00:00Z",
      end_at: "2026-12-31T23:59:59Z",
    },
  ],
  evaluateVoucher: async (code) => {
    if (code === "WELCOME50") {
      return { is_valid: true, discount_amount: "50000.00" };
    }
    return { is_valid: false, discount_amount: "0.00", reason: "Mã giảm giá không hợp lệ hoặc đã hết hạn" };
  },
};

// ==========================================
// 3. Central Dependency Switcher Factory
// ==========================================

export const repositories = {
  catalog: (): ICatalogRepository =>
    features.domains.catalogLive() ? apiCatalogRepository : mockCatalogRepository,

  buyer: (): IBuyerRepository =>
    features.domains.cartMock() ? mockBuyerRepository : apiBuyerRepository,

  order: (): IOrderRepository =>
    features.domains.ordersMock() ? mockOrderRepository : apiOrderRepository,

  voucher: (): IVoucherRepository =>
    features.useMock() ? mockVoucherRepository : apiVoucherRepository,
};
