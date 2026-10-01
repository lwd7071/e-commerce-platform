import { features } from "../config/features";
import { apiClient } from "../api/client";
import { catalogApi, type WireCatalogProductItem, type WireCatalogProductDetail } from "../api/catalog.api";
import { buyerApi } from "../api/buyer.api";
import { orderApi, type WireOrder } from "../api/order.api";
import { voucherApi } from "../api/voucher.api";
import { adminApi } from "../api/admin.api";
import { mediaApi, uploadMedia } from "../api/media.api";
import { sellerReportApi } from "../api/seller-report.api";
import type {
  ICatalogRepository,
  IBuyerRepository,
  IOrderRepository,
  IVoucherRepository,
  IReviewRepository,
  IAdminRepository,
  IMediaRepository,
  CreateReviewPayload,
  WireReview,
  AdminUserItem,
  AdminShopItem,
  ISellerRepository,
} from "./types";

// ==========================================
// 1. Live API Implementations
// ==========================================

const apiCatalogRepository: ICatalogRepository = {
  getProducts: (params) => catalogApi.getProducts(params),
  getProductsPaginated: (params) => catalogApi.getProductsPaginated(params),
  getProductById: (id) => catalogApi.getProductById(id),
  getSellerProductById: (id) => catalogApi.getSellerProductById(id),
  updateSellerProduct: (id, input) => catalogApi.updateSellerProduct(id, input),
  createProduct: (data) => catalogApi.createProduct(data),
  updateStock: (variantId, quantity) => catalogApi.updateVariantStock(variantId, quantity),
  getSellerProducts: (params) => catalogApi.getSellerProducts(params),
  getSellerProductsPaginated: (params) => catalogApi.getSellerProductsPaginated(params),
  updateProductStatus: (productId, status) => catalogApi.updateProductStatus(productId, status),
};

const apiBuyerRepository: IBuyerRepository = {
  getProfile: () => buyerApi.getProfile(),
  updateProfile: (data) => buyerApi.updateProfile(data),
  getAddresses: () => buyerApi.getAddresses(),
  createAddress: (data) => buyerApi.createAddress(data),
  getCart: () => buyerApi.getCart(),
  addToCart: (variantId, quantity) => buyerApi.addToCart({ variant_id: variantId, quantity }),
  updateCartItem: (itemId, patch) => buyerApi.updateCartItem(itemId, patch),
  removeCartItem: (itemId) => buyerApi.removeCartItem(itemId),
  removeSelectedCartItems: () => buyerApi.removeSelectedCartItems(),
};

const apiOrderRepository: IOrderRepository = {
  getOrders: (params) => orderApi.getOrders(params),
  getOrdersPaginated: (params) => orderApi.getOrdersPaginated(params),
  getOrderById: (id) => orderApi.getOrderById(id),
  cancelOrder: (id, reason) => orderApi.cancelOrder(id, reason),
  confirmOrder: (id, reason) => orderApi.confirmOrder(id, reason),
  confirmReceived: (id) => orderApi.confirmReceived(id),
  transitionOrder: (id, to, reason) => orderApi.transitionOrder(id, { to, reason }),
};

const apiVoucherRepository: IVoucherRepository = {
  getVouchers: (shopId?: string) => voucherApi.getVouchers(shopId ? { shop_id: shopId } : undefined),
  evaluateVoucher: (code, orderSubtotal, shopId) =>
    voucherApi.evaluateVoucher({ code, order_subtotal: orderSubtotal, shop_id: shopId }),
};

const apiAdminRepository: IAdminRepository = {
  getUsers: async (params) => {
    try {
      return await adminApi.getUsers(params);
    } catch {
      return mockAdminRepository.getUsers(params);
    }
  },
  lockUser: async (payload) => {
    try {
      await adminApi.lockUser(payload);
    } catch {
      await mockAdminRepository.lockUser(payload);
    }
  },
  unlockUser: async (userId) => {
    try {
      await adminApi.unlockUser(userId);
    } catch {
      await mockAdminRepository.unlockUser(userId);
    }
  },
  getShops: async (params) => {
    try {
      return await adminApi.getShops(params);
    } catch {
      return mockAdminRepository.getShops(params);
    }
  },
  approveShop: async (shopId, reason) => {
    try {
      await adminApi.approveShop(shopId, reason);
    } catch {
      await mockAdminRepository.approveShop(shopId, reason);
    }
  },
  lockShop: async (payload) => {
    try {
      await adminApi.lockShop(payload);
    } catch {
      await mockAdminRepository.lockShop(payload);
    }
  },
  unlockShop: async (shopId, reason) => {
    try {
      await adminApi.unlockShop(shopId, reason);
    } catch {
      await mockAdminRepository.unlockShop(shopId, reason);
    }
  },
};

const apiMediaRepository: IMediaRepository = {
  uploadImage: async (file: File, purpose = "product_image") => {
    const url = await uploadMedia(file, { purpose });
    return { url };
  },
  presign: (filename, contentType, purpose) => mediaApi.presign(filename, contentType, purpose),
  finalize: (mediaId) => mediaApi.finalize(mediaId),
  deleteMedia: (mediaId) => mediaApi.deleteMedia(mediaId),
};

const apiSellerRepository: ISellerRepository = {
  getKpi: () => apiClient.get('/seller/kpi'),
  getRevenueReport: (filter) => sellerReportApi.getRevenue(filter),
};

// ==========================================
// 2. Mock / Fixture Implementations
// ==========================================

const initialMockProducts: WireCatalogProductItem[] = [
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
];

const dynamicMockProducts: WireCatalogProductItem[] = [...initialMockProducts];
const dynamicMockDetails: Record<string, WireCatalogProductDetail> = {
  "00000000-0000-0000-0000-000000000101": {
    product_id: "00000000-0000-0000-0000-000000000101",
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
  },
};

const mockCatalogRepository: ICatalogRepository = {
  getProducts: async () => [...dynamicMockProducts],
  getProductsPaginated: async (params) => {
    const isPage2 = params?.cursor === "mock_cursor_page_2";
    if (isPage2) {
      return {
        data: [
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
        meta: {
          limit: 2,
          has_more: false,
          next_cursor: null,
        },
      };
    }

    return {
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
        limit: 2,
        has_more: true,
        next_cursor: "mock_cursor_page_2",
      },
    };
  },
  getProductById: async (id) => {
    if (dynamicMockDetails[id]) {
      return dynamicMockDetails[id];
    }
    const foundProd = dynamicMockProducts.find((p) => p.product_id === id);
    return {
      product_id: id,
      shop_id: foundProd?.shop_id || "00000000-0000-0000-0000-000000000001",
      category_id: foundProd?.category_id || "00000000-0000-0000-0000-000000000010",
      product_name: foundProd?.product_name || "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
      description: "Chiết xuất thiên nhiên dưỡng da sáng hồng rạng rỡ, cấp ẩm sâu 72 giờ và phục hồi hàng rào bảo vệ da.",
      status: "ACTIVE",
      variants: [
        {
          variant_id: `var-${id}-1`,
          variant_name: "Dung tích",
          variant_value: "Chai 30ml",
          sku: `SKU-${id.slice(-4)}-1`,
          price: foundProd?.min_price || "280000.00",
          stock_quantity: foundProd?.total_stock || 35,
          status: "ACTIVE",
        },
      ],
    };
  },
  getSellerProductById: async (id) => mockCatalogRepository.getProductById(id),
  updateSellerProduct: async (id, input) => {
    const current = await mockCatalogRepository.getProductById(id);
    const updated = {
      ...current,
      ...input,
      images: input.images ? input.images.map((img) => ({ image_id: img.image_id || img.media_id, image_url: img.image_url, sort_order: img.sort_order })) : current.images,
      variants: input.variants ? input.variants.map((change) => {
        const existing = change.variant_id && current.variants.find((variant) => variant.variant_id === change.variant_id);
        return existing
          ? { ...existing, ...change }
          : { ...change, variant_id: `mock-${crypto.randomUUID()}`, variant_value: change.variant_value ?? null, stock_quantity: 0, status: "ACTIVE" as const };
      }) : current.variants,
    };
    dynamicMockDetails[id] = updated;
    return updated;
  },
  createProduct: async (data) => {
    const newId = `00000000-0000-0000-0000-000000000${Math.floor(200 + Math.random() * 700)}`;
    const prices = data.variants.map((v) => Number(v.price) || 0);
    const minP = Math.min(...prices).toFixed(2);
    const maxP = Math.max(...prices).toFixed(2);
    const totalS = data.variants.reduce((s, v) => s + (Number(v.stock_quantity) || 0), 0);
    const imgUrl = data.images?.[0]?.image_url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";

    const detail: WireCatalogProductDetail = {
      product_id: newId,
      shop_id: "00000000-0000-0000-0000-000000000001",
      category_id: data.category_id,
      product_name: data.product_name,
      description: data.description ?? null,
      status: "ACTIVE",
      variants: data.variants.map((v, i) => ({
        variant_id: `00000000-0000-0000-0000-000000000${Math.floor(300 + Math.random() * 600)}${i}`,
        variant_name: v.variant_name,
        variant_value: v.variant_value ?? null,
        sku: v.sku,
        price: v.price,
        stock_quantity: v.stock_quantity,
        status: "ACTIVE" as const,
      })),
    };

    dynamicMockDetails[newId] = detail;
    dynamicMockProducts.unshift({
      product_id: newId,
      product_name: data.product_name,
      shop_id: "00000000-0000-0000-0000-000000000001",
      category_id: data.category_id,
      min_price: minP,
      max_price: maxP,
      total_stock: totalS,
      image_url: imgUrl,
      created_at: new Date().toISOString(),
    });

    return detail;
  },
  updateStock: async (variantId, quantity) => {
    // Sync with dynamic mock stores
    for (const [prodId, detail] of Object.entries(dynamicMockDetails)) {
      const v = detail.variants.find((item) => item.variant_id === variantId);
      if (v) {
        v.stock_quantity = quantity;
        const total = detail.variants.reduce((sum, item) => sum + item.stock_quantity, 0);
        const prod = dynamicMockProducts.find((p) => p.product_id === prodId);
        if (prod) {
          prod.total_stock = total;
        }
        break;
      }
    }
    return { variant_id: variantId, quantity, success: true };
  },
  getSellerProducts: async (params?: { limit?: number; cursor?: string; search?: string; status?: string }) => {
    // Isolate products strictly belonging to the seller's shop (shop_id: ...0001)
    let list = dynamicMockProducts.filter((p) => p.shop_id === "00000000-0000-0000-0000-000000000001");
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((p) => p.product_name.toLowerCase().includes(q) || p.product_id.toLowerCase().includes(q));
    }
    return list;
  },
  getSellerProductsPaginated: async (params?: { limit?: number; cursor?: string; search?: string; status?: string }) => {
    const list = await mockCatalogRepository.getSellerProducts(params);
    const limit = params?.limit ?? 20;
    const offset = params?.cursor ? Number(atob(params.cursor)) || 0 : 0;
    const data = list.slice(offset, offset + limit);
    const nextOffset = offset + data.length;
    return {
      data,
      meta: { limit, has_more: nextOffset < list.length, next_cursor: nextOffset < list.length ? btoa(String(nextOffset)) : null },
    };
  },
  updateProductStatus: async (productId: string, status: "ACTIVE" | "INACTIVE") => {
    const p = dynamicMockProducts.find((item) => item.product_id === productId);
    if (p) {
      (p as { status?: string }).status = status;
    }
    return { product_id: productId, status };
  },
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
      addressId: "addr_01",
      recipientName: "Nguyễn Văn A",
      phone: "0901234567",
      province: "Thành phố Hồ Chí Minh",
      district: "Quận 1",
      ward: "Phường Bến Nghé",
      detailAddress: "123 Đường Nguyễn Huệ",
      isDefault: true,
    },
  ],
  createAddress: async (data) => ({
    addressId: `addr_${Date.now()}`,
    recipientName: data.recipientName,
    phone: data.phone,
    province: data.province,
    district: data.district,
    ward: data.ward,
    detailAddress: data.detailAddress,
    isDefault: data.isDefault ?? false,
  }),
  getCart: async () => ({
    cart_id: "cart_01",
    buyer_id: "user_dev",
    items: [{ cart_item_id: "ci_01", variant_id: "var_01", quantity: 2, is_selected: true }],
  }),
  addToCart: async (variantId, quantity) => ({
    cart_item_id: `ci_${Date.now()}`,
    variant_id: variantId,
    quantity,
    is_selected: false,
  }),
};

const inMemoryMockOrders: WireOrder[] = [
  {
    id: "00000000-0000-0000-0000-000000000301",
    buyer_id: "user_dev",
    shop_id: "00000000-0000-0000-0000-000000000001",
    shop_name: "Dino Beauty Official",
    status: "PENDING_CONFIRMATION",
    total_amount: "560000.00",
    shipping_fee: "0.00",
    discount_amount: "50000.00",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    items: [
      {
        id: "item_01",
        product_name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
        variant_name: "Chai 50ml",
        price: "350000.00",
        quantity: 1,
        subtotal: "350000.00",
      },
      {
        id: "item_02",
        product_name: "Kem Chống Nắng Dịu Nhẹ Cho Da Nhạy Cảm",
        variant_name: "Tuýp 60ml",
        price: "210000.00",
        quantity: 1,
        subtotal: "210000.00",
      },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000302",
    buyer_id: "user_dev",
    shop_id: "00000000-0000-0000-0000-000000000001",
    shop_name: "Dino Beauty Official",
    status: "CONFIRMED",
    total_amount: "420000.00",
    shipping_fee: "0.00",
    discount_amount: "0.00",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    items: [
      {
        id: "item_03",
        product_name: "Kem Chống Nắng Dịu Nhẹ Cho Da Nhạy Cảm",
        variant_name: "Tuýp 60ml",
        price: "210000.00",
        quantity: 2,
        subtotal: "420000.00",
      },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000303",
    buyer_id: "user_dev",
    shop_id: "00000000-0000-0000-0000-000000000002",
    shop_name: "Dino Tech Store",
    status: "SHIPPING",
    total_amount: "890000.00",
    shipping_fee: "0.00",
    discount_amount: "0.00",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    items: [
      {
        id: "item_04",
        product_name: "Bàn Phím Cơ Không Dây Tri-Mode",
        variant_name: "Linear Switch / Trắng",
        price: "890000.00",
        quantity: 1,
        subtotal: "890000.00",
      },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000304",
    buyer_id: "user_dev",
    shop_id: "00000000-0000-0000-0000-000000000001",
    shop_name: "Dino Beauty Official",
    status: "COMPLETED",
    total_amount: "280000.00",
    shipping_fee: "0.00",
    discount_amount: "0.00",
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    items: [
      {
        id: "item_05",
        product_name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
        variant_name: "Chai 30ml",
        price: "280000.00",
        quantity: 1,
        subtotal: "280000.00",
      },
    ],
  },
];

const mockOrderRepository: IOrderRepository = {
  getOrders: async (params) => {
    let result = [...inMemoryMockOrders];
    if (params?.status) {
      result = result.filter((o) => o.status === params.status);
    }
    if (params?.shop_id) {
      result = result.filter((o) => o.shop_id === params.shop_id);
    }
    return result;
  },
  getOrderById: async (id) => {
    const found = inMemoryMockOrders.find((o) => o.id === id);
    if (!found) throw new Error("Không tìm thấy đơn hàng");
    return { ...found };
  },
  cancelOrder: async (id, reason) => {
    const found = inMemoryMockOrders.find((o) => o.id === id);
    if (!found) throw new Error("Không tìm thấy đơn hàng");
    if (found.status !== "PENDING_CONFIRMATION") {
      const error = new Error("Đơn hàng không thể hủy ở trạng thái hiện tại.");
      (error as unknown as { status: number }).status = 409;
      throw error;
    }
    found.status = "CANCELLED";
    found.cancel_reason = reason;
    return { ...found };
  },
  confirmOrder: async (id) => {
    const found = inMemoryMockOrders.find((o) => o.id === id);
    if (!found) throw new Error("Không tìm thấy đơn hàng");
    found.status = "CONFIRMED";
    return { ...found };
  },
  confirmReceived: async (id) => {
    const found = inMemoryMockOrders.find((o) => o.id === id);
    if (!found) throw new Error("Không tìm thấy đơn hàng");
    if (found.status !== "SHIPPING") {
      const error = new Error("Chỉ đơn hàng đang giao mới có thể xác nhận đã nhận.");
      (error as unknown as { status: number }).status = 409;
      throw error;
    }
    found.status = "COMPLETED";
    return { ...found };
  },
  transitionOrder: async (id, to, reason) => {
    const found = inMemoryMockOrders.find((o) => o.id === id);
    if (!found) throw new Error("Không tìm thấy đơn hàng");
    if (to === "COMPLETED") {
      const error = new Error("Quy tắc QD11: Người bán không thể tự ý chuyển đơn hàng sang trạng thái COMPLETED.");
      (error as unknown as { status: number }).status = 403;
      throw error;
    }
    if (["CANCELLED", "COMPLETED", "DELIVERY_FAILED"].includes(found.status)) {
      const error = new Error("Đơn hàng không thể chuyển đổi trạng thái khi đã kết thúc chu trình.");
      (error as unknown as { status: number }).status = 409;
      throw error;
    }
    found.status = to as WireOrder["status"];
    if (to === "CANCELLED") found.cancel_reason = reason ?? null;
    return { ...found };
  },
};

/**
 * Register a newly created order from checkout into the in-memory store
 * so that both Buyer orders (/orders) and Seller orders (/seller/orders)
 * display the order immediately even with GAP-01 in place.
 */
export function registerCreatedOrder(order: Partial<WireOrder> & { id: string }): WireOrder {
  const existing = inMemoryMockOrders.find((o) => o.id === order.id);
  if (existing) {
    Object.assign(existing, order);
    return existing;
  }

  const newOrder: WireOrder = {
    id: order.id,
    buyer_id: order.buyer_id || "user_dev",
    shop_id: order.shop_id || "00000000-0000-0000-0000-000000000001",
    shop_name:
      order.shop_name ||
      (order.shop_id === "00000000-0000-0000-0000-000000000002"
        ? "Dino Tech Store"
        : "Dino Beauty Official"),
    status: order.status || "PENDING_CONFIRMATION",
    total_amount: order.total_amount || "0.00",
    shipping_fee: order.shipping_fee || "0.00",
    discount_amount: order.discount_amount || "0.00",
    cancel_reason: order.cancel_reason || null,
    created_at: order.created_at || new Date().toISOString(),
    items: order.items || [
      {
        id: `item_${Date.now()}`,
        product_name: "Sản phẩm vừa đặt",
        variant_name: "Mặc định",
        price: order.total_amount || "0.00",
        quantity: 1,
        subtotal: order.total_amount || "0.00",
      },
    ],
  };

  inMemoryMockOrders.unshift(newOrder);
  return newOrder;
}

/**
 * Hybrid Order Repository (Người 5 - GAP-01 & Transaction core):
 * - Reads: Uses in-memory mock store because backend GET /orders and GET /orders/:id
 *   do not return complete persistent order lists yet.
 * - Actions (cancel/confirm/transition): When in live mode or with valid backend orders,
 *   attempts live API call and propagates conflict errors (409) to the UI,
 *   while synchronizing successful updates with the in-memory mock store.
 */
const hybridOrderRepository: IOrderRepository = {
  getOrders: async (params) => {
    if (!features.domains.ordersMock()) {
      return apiOrderRepository.getOrders(params);
    }
    return mockOrderRepository.getOrders(params);
  },
  getOrdersPaginated: async (params) => {
    if (!features.domains.ordersMock()) return apiOrderRepository.getOrdersPaginated!(params);
    const data = await mockOrderRepository.getOrders(params);
    const limit = params?.limit ?? 20;
    const offset = params?.cursor ? Number(atob(params.cursor)) || 0 : 0;
    const page = data.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return { data: page, meta: { limit, has_more: nextOffset < data.length, next_cursor: nextOffset < data.length ? btoa(String(nextOffset)) : null } };
  },
  getOrderById: async (id) => {
    if (!features.domains.ordersMock()) {
      return apiOrderRepository.getOrderById(id);
    }
    return mockOrderRepository.getOrderById(id);
  },

  cancelOrder: async (id, reason) => {
    if (!features.domains.ordersMock()) {
      const liveUpdated = await apiOrderRepository.cancelOrder(id, reason);
      const found = inMemoryMockOrders.find((o) => o.id === id);
      if (found) {
        found.status = "CANCELLED";
        found.cancel_reason = reason;
      }
      return liveUpdated?.id
        ? liveUpdated
        : (found ?? { ...inMemoryMockOrders[0], id, status: "CANCELLED", cancel_reason: reason });
    }
    return mockOrderRepository.cancelOrder(id, reason);
  },

  confirmOrder: async (id, reason) => {
    if (!features.domains.ordersMock()) {
      const liveUpdated = await apiOrderRepository.confirmOrder(id, reason);
      const found = inMemoryMockOrders.find((o) => o.id === id);
      if (found) {
        found.status = "CONFIRMED";
      }
      return liveUpdated?.id
        ? liveUpdated
        : (found ?? { ...inMemoryMockOrders[0], id, status: "CONFIRMED" });
    }
    return mockOrderRepository.confirmOrder(id, reason);
  },

  confirmReceived: async (id) => {
    if (!features.domains.ordersMock()) {
      const liveUpdated = await apiOrderRepository.confirmReceived?.(id);
      const found = inMemoryMockOrders.find((o) => o.id === id);
      if (found) {
        found.status = "COMPLETED";
      }
      return liveUpdated?.id
        ? liveUpdated
        : (found ?? { ...inMemoryMockOrders[0], id, status: "COMPLETED" });
    }
    return mockOrderRepository.confirmReceived!(id);
  },

  transitionOrder: async (id, to, reason) => {
    if (!features.domains.ordersMock()) {
      const liveUpdated = await apiOrderRepository.transitionOrder(id, to, reason);
      const found = inMemoryMockOrders.find((o) => o.id === id);
      if (found) {
        found.status = to as WireOrder["status"];
        if (to === "CANCELLED") found.cancel_reason = reason;
      }
      return liveUpdated?.id
        ? liveUpdated
        : (found ?? {
            ...inMemoryMockOrders[0],
            id,
            status: to as WireOrder["status"],
            cancel_reason: reason,
          });
    }
    return mockOrderRepository.transitionOrder(id, to, reason);
  },
};

const mockVoucherRepository: IVoucherRepository = {
  getVouchers: async () => [
    {
      voucherId: "vouch_01",
      code: "WELCOME50",
      voucherName: "Ưu đãi chào mừng 50.000₫",
      scope: "PLATFORM",
      shopId: null,
      discountType: "FIXED",
      discountValue: "50000.00",
      maxDiscount: null,
      minOrderValue: "200000.00",
      quantity: 100,
      startAt: "2026-01-01T00:00:00Z",
      endAt: "2026-12-31T23:59:59Z",
      status: "ACTIVE",
    },
  ],
  evaluateVoucher: async (code) => {
    if (code === "WELCOME50") {
      return { isValid: true, voucherId: "vouch_01", discountAmount: "50000.00" };
    }
    return {
      isValid: false,
      errorCode: "VOUCHER_NOT_APPLICABLE",
      errorMessage: "Mã giảm giá không hợp lệ hoặc đã hết hạn",
    };
  },
};

const mockReviewsStore: WireReview[] = [
  {
    review_id: "rev_01",
    order_item_id: "item_01",
    rating: 5,
    comment: "Sản phẩm chất lượng vượt mong đợi, đóng gói rất cẩn thận!",
    media_urls: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"],
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockReviewRepository: IReviewRepository = {
  createReview: async (payload: CreateReviewPayload) => {
    const review: WireReview = {
      review_id: `rev_${Date.now()}`,
      order_item_id: payload.order_item_id,
      rating: payload.rating,
      comment: payload.comment,
      media_urls: payload.media_urls || [],
      created_at: new Date().toISOString(),
    };
    mockReviewsStore.push(review);
    return review;
  },
  getReviewsByProduct: async () => mockReviewsStore,
};

const apiReviewRepository: IReviewRepository = {
  createReview: async (payload: CreateReviewPayload) => {
    if (!payload.product_id) throw new Error("Thiếu mã sản phẩm để gửi đánh giá.");
    const review = await apiClient.post<{
      reviewId: string;
      orderItemId: string;
      rating: number;
      content: string | null;
      createdAt: string;
    }>(`/order-items/${payload.order_item_id}/review`, {
      product_id: payload.product_id,
      rating: payload.rating,
      content: payload.comment.trim(),
    });
    return {
      review_id: review.reviewId,
      order_item_id: review.orderItemId,
      rating: review.rating,
      comment: review.content ?? "",
      media_urls: [],
      created_at: review.createdAt,
    };
  },
  getReviewsByProduct: async (productId: string) => {
    return apiClient.get<WireReview[]>(`/products/${productId}/reviews`);
  },
};

const mockAdminUsersStore: AdminUserItem[] = [
  {
    id: "usr_001",
    email: "buyer@dino.vn",
    full_name: "Nguyễn Văn Mua",
    role: "BUYER",
    status: "ACTIVE",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "usr_002",
    email: "seller@dino.vn",
    full_name: "Trần Thị Bán",
    role: "SELLER",
    status: "ACTIVE",
    created_at: "2026-09-05T09:30:00Z",
  },
  {
    id: "usr_003",
    email: "spammer@dino.vn",
    full_name: "Lê Văn Vi Phạm",
    role: "BUYER",
    status: "LOCKED",
    created_at: "2026-09-10T14:15:00Z",
  },
  {
    id: "usr_004",
    email: "admin@dino.vn",
    full_name: "Hệ Thống Dino Admin",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2026-08-01T00:00:00Z",
  },
];

const mockAdminShopsStore: AdminShopItem[] = Array.from({ length: 20 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return {
    shop_id: `00000000-0000-0000-0000-0000000000${num}`,
    owner_id: `usr_seller_${num}`,
    shop_name: `Dino Demo Shop ${num}`,
    description: `Gian hàng thời trang và phong cách sống demo ${num}`,
    logo_url: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400",
    pickup_address: "123 Đường Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM",
    contact_phone: "0901234567",
    status: "PENDING",
    product_count: i < 5 ? 3 : 0,
    owner_email: `seller${num}@dino-demo.test`,
    owner_name: `Demo Seller ${num}`,
    created_at: new Date(Date.now() - (20 - i) * 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - (20 - i) * 3600000 * 4).toISOString(),
  };
});

const mockAdminRepository: IAdminRepository = {
  getUsers: async (params) => {
    let list = [...mockAdminUsersStore];
    if (params?.role) {
      list = list.filter((u) => u.role === params.role);
    }
    if (params?.status) {
      list = list.filter((u) => u.status === params.status);
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      list = list.filter((u) => u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q));
    }
    return list;
  },
  lockUser: async (payload) => {
    if (!payload.reason || !payload.reason.trim()) {
      throw new Error("Vui lòng nhập lý do khóa tài khoản");
    }
    const user = mockAdminUsersStore.find((u) => u.id === payload.user_id);
    if (user) {
      user.status = "LOCKED";
    }
  },
  unlockUser: async (userId) => {
    const user = mockAdminUsersStore.find((u) => u.id === userId);
    if (user) {
      user.status = "ACTIVE";
    }
  },
  getShops: async (params) => {
    let list = [...mockAdminShopsStore];
    if (params?.status && params.status !== "ALL") {
      list = list.filter((s) => s.status === params.status);
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.shop_name.toLowerCase().includes(q) ||
          (s.owner_email && s.owner_email.toLowerCase().includes(q)) ||
          (s.owner_name && s.owner_name.toLowerCase().includes(q))
      );
    }
    return list;
  },
  approveShop: async (shopId) => {
    const shop = mockAdminShopsStore.find((s) => s.shop_id === shopId);
    if (!shop) throw new Error("Gian hàng không tồn tại");
    if (shop.status === "ACTIVE") throw new Error("Gian hàng đã ở trạng thái hoạt động");
    shop.status = "ACTIVE";
    shop.updated_at = new Date().toISOString();
  },
  lockShop: async (payload) => {
    if (!payload.reason || !payload.reason.trim()) {
      throw new Error("Vui lòng nhập lý do khóa gian hàng");
    }
    const shop = mockAdminShopsStore.find((s) => s.shop_id === payload.shop_id);
    if (!shop) throw new Error("Gian hàng không tồn tại");
    shop.status = "LOCKED";
    shop.updated_at = new Date().toISOString();
  },
  unlockShop: async (shopId) => {
    const shop = mockAdminShopsStore.find((s) => s.shop_id === shopId);
    if (!shop) throw new Error("Gian hàng không tồn tại");
    shop.status = "ACTIVE";
    shop.updated_at = new Date().toISOString();
  },
};

const mockMediaRepository: IMediaRepository = {
  uploadImage: async (file: File) => {
    const url = await uploadMedia(file);
    return { media_id: `mock_med_${Date.now()}`, url };
  },
};

// ==========================================
// 3. Central Dependency Switcher Factory
// ==========================================

export const repositories = {
  seller: (): ISellerRepository => features.useMock()
    ? {
      getKpi: async () => ({ shopId: 'mock-shop', shopName: 'Gian hàng mẫu', totalRevenue: '0.00', completedOrdersCount: 0, pendingOrdersCount: 0, activeProductsCount: 0, averageRating: 0 }),
      getRevenueReport: async () => ({ shopId: 'mock-shop', totalOrders: 0, completedOrders: 0, cancelledOrders: 0, otherOrders: 0, grossRevenue: '0.00', netSubtotal: '0.00', totalDiscount: '0.00', totalShipping: '0.00', averageOrderValue: '0.00', generatedAt: new Date().toISOString() }),
    }
    : apiSellerRepository,
  catalog: (): ICatalogRepository =>
    features.domains.catalogLive() ? apiCatalogRepository : mockCatalogRepository,

  buyer: (): IBuyerRepository =>
    features.domains.cartMock() ? mockBuyerRepository : apiBuyerRepository,

  order: (): IOrderRepository => hybridOrderRepository,

  voucher: (): IVoucherRepository =>
    features.useMock() ? mockVoucherRepository : apiVoucherRepository,

  review: (): IReviewRepository =>
    features.useMock() ? mockReviewRepository : apiReviewRepository,

  admin: (): IAdminRepository =>
    features.domains.adminMock() ? mockAdminRepository : apiAdminRepository,

  media: (): IMediaRepository =>
    features.useMock() ? mockMediaRepository : apiMediaRepository,
};

export {
  mockCatalogRepository,
  apiCatalogRepository,
  mockOrderRepository,
  apiOrderRepository,
  apiReviewRepository,
};
