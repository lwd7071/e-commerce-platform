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
  getProductsPaginated: (params) => catalogApi.getProductsPaginated(params),
  getProductById: (id) => catalogApi.getProductById(id),
  createProduct: (data) => catalogApi.createProduct(data),
  updateStock: (variantId, quantity) => catalogApi.updateVariantStock(variantId, quantity),
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
      product_id: "00000000-0000-0000-0000-000000000101",
      product_name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
      shop_id: "00000000-0000-0000-0000-000000000001",
      category_id: "00000000-0000-0000-0000-000000000010",
      min_price: "280000.00",
      max_price: "350000.00",
      total_stock: 50,
      image_url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800",
      created_at: new Date().toISOString(),
    },
    {
      product_id: "00000000-0000-0000-0000-000000000102",
      product_name: "Kem Chống Nắng Phổ Rộng SPF 50+ PA++++",
      shop_id: "00000000-0000-0000-0000-000000000001",
      category_id: "00000000-0000-0000-0000-000000000010",
      min_price: "320000.00",
      max_price: "320000.00",
      total_stock: 120,
      image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800",
      created_at: new Date().toISOString(),
    },
    {
      product_id: "00000000-0000-0000-0000-000000000103",
      product_name: "Áo Sơ Mi Linen Form Rộng Cao Cấp",
      shop_id: "00000000-0000-0000-0000-000000000002",
      category_id: "00000000-0000-0000-0000-000000000011",
      min_price: "289000.00",
      max_price: "320000.00",
      total_stock: 75,
      image_url: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800",
      created_at: new Date().toISOString(),
    },
    {
      product_id: "00000000-0000-0000-0000-000000000104",
      product_name: "Bàn Phím Cơ Không Dây 3 Chế Độ RGB",
      shop_id: "00000000-0000-0000-0000-000000000003",
      category_id: "00000000-0000-0000-0000-000000000012",
      min_price: "850000.00",
      max_price: "1250000.00",
      total_stock: 30,
      image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800",
      created_at: new Date().toISOString(),
    },
  ],
  getProductsPaginated: async () => ({
    data: [
      {
        product_id: "00000000-0000-0000-0000-000000000101",
        product_name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
        shop_id: "00000000-0000-0000-0000-000000000001",
        category_id: "00000000-0000-0000-0000-000000000010",
        min_price: "280000.00",
        max_price: "350000.00",
        total_stock: 50,
        image_url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800",
        created_at: new Date().toISOString(),
      },
      {
        product_id: "00000000-0000-0000-0000-000000000102",
        product_name: "Kem Chống Nắng Phổ Rộng SPF 50+ PA++++",
        shop_id: "00000000-0000-0000-0000-000000000001",
        category_id: "00000000-0000-0000-0000-000000000010",
        min_price: "320000.00",
        max_price: "320000.00",
        total_stock: 120,
        image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800",
        created_at: new Date().toISOString(),
      },
    ],
    meta: {
      limit: 20,
      has_more: false,
      next_cursor: null,
    },
  }),
  getProductById: async (id) => ({
    product_id: id,
    shop_id: "00000000-0000-0000-0000-000000000001",
    category_id: "00000000-0000-0000-0000-000000000010",
    product_name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
    description: "Chiết xuất thiên nhiên dưỡng da sáng hồng rạng rỡ, cấp ẩm sâu 72 giờ và phục hồi hàng rào bảo vệ da.",
    status: "ACTIVE",
    variants: [
      {
        variant_id: "00000000-0000-0000-0000-000000000201",
        variant_name: "Dung tích",
        variant_value: "Chai 30ml",
        sku: "SERUM-30ML",
        price: "280000.00",
        stock_quantity: 35,
        status: "ACTIVE",
      },
      {
        variant_id: "00000000-0000-0000-0000-000000000202",
        variant_name: "Dung tích",
        variant_value: "Chai 50ml",
        sku: "SERUM-50ML",
        price: "350000.00",
        stock_quantity: 15,
        status: "ACTIVE",
      },
    ],
  }),
  createProduct: async (data) => ({
    product_id: "00000000-0000-0000-0000-000000000199",
    shop_id: "00000000-0000-0000-0000-000000000001",
    category_id: data.category_id,
    product_name: data.product_name,
    description: data.description ?? null,
    status: "ACTIVE",
    variants: data.variants.map((v, i) => ({
      variant_id: `00000000-0000-0000-0000-00000000029${i}`,
      variant_name: v.variant_name,
      variant_value: v.variant_value ?? null,
      sku: v.sku,
      price: v.price,
      stock_quantity: v.stock_quantity,
      status: "ACTIVE" as const,
    })),
  }),
  updateStock: async (variantId, quantity) => ({ variant_id: variantId, quantity, success: true }),
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
