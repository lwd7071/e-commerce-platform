"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  ShoppingBag,
  Store,
  Star,
  Plus,
  Minus,
  X,
  ArrowUpRight,
  Sparkles,
  Clock,
  Tag,
  ShieldCheck,
  RotateCcw,
  Truck,
  Check,
  BadgeCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Menu,
  MapPin,
  User,
  Globe,
} from "lucide-react";

// Định nghĩa kiểu dữ liệu khớp theo Schema Freeze v1 của dự án
interface ProductVariant {
  id: string;
  name: string;
  value: string;
  price: number;
  originalPrice?: number;
  stock: number;
  sku: string;
}

interface Product {
  id: string;
  shop: string;
  shopVerified: boolean;
  category: string;
  name: string;
  description: string;
  rating: number;
  reviewsCount: number;
  soldCount: string;
  variants: ProductVariant[];
  image: string;
  badge: string;
}

interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  shopName: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  image: string;
  isSelected: boolean;
}

interface OfficialStore {
  id: string;
  shopName: string;
  category: string;
  tagline: string;
  discountBadge: string;
  bannerImg: string;
  logoImg: string;
  previewProducts: {
    name: string;
    price: number;
    img: string;
  }[];
}

const INITIAL_OFFICIAL_STORES: OfficialStore[] = [
  {
    id: "mall-1",
    shopName: "Mori Studio Official",
    category: "Thời trang Linen Tối giản",
    tagline: "Sợi tự nhiên cao cấp",
    discountBadge: "Giảm đến 40%",
    bannerImg: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600",
    logoImg: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
    previewProducts: [
      { name: "Áo sơ mi Linen", price: 289000, img: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200" },
      { name: "Quần âu ống suông", price: 340000, img: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=200" },
    ],
  },
  {
    id: "mall-2",
    shopName: "An Yên Ceramic Mall",
    category: "Gốm sứ thủ công Wabi-Sabi",
    tagline: "Nghệ thuật thủ công Việt",
    discountBadge: "Voucher 50K",
    bannerImg: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600",
    logoImg: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=100",
    previewProducts: [
      { name: "Đèn gốm mộc", price: 320000, img: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=200" },
      { name: "Ly men xước", price: 145000, img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=200" },
    ],
  },
  {
    id: "mall-3",
    shopName: "Minimal Living Store",
    category: "Gia dụng phong cách Bắc Âu",
    tagline: "Không gian sống tinh tế",
    discountBadge: "Mua 1 Tặng 1",
    bannerImg: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600",
    logoImg: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    previewProducts: [
      { name: "Bình giữ nhiệt Inox", price: 245000, img: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200" },
      { name: "Khay gỗ Teak", price: 180000, img: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=200" },
    ],
  },
  {
    id: "mall-4",
    shopName: "TechCraft Studio",
    category: "Phụ kiện công nghệ Retro",
    tagline: "Bảo hành 24T 1-đổi-1",
    discountBadge: "Giảm 300K",
    bannerImg: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600",
    logoImg: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
    previewProducts: [
      { name: "Bàn phím Retro 75%", price: 890000, img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200" },
      { name: "Chuột gỗ Silent", price: 420000, img: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=200" },
    ],
  },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    shop: "Mori Studio",
    shopVerified: true,
    category: "fashion",
    name: "Áo sơ mi Linen dáng suông Minimalist",
    description: "Chất liệu sợi lanh 100% tự nhiên nhập khẩu, bề mặt thô mộc thoáng khí, phom dáng oversize thoải mái.",
    rating: 4.9,
    reviewsCount: 142,
    soldCount: "1.4k",
    variants: [
      { id: "v1-1", name: "Màu / Size", value: "Be Cát / Size M", price: 289000, originalPrice: 360000, stock: 15, sku: "MORI-LN-BE-M" },
      { id: "v1-2", name: "Màu / Size", value: "Trắng Kem / Size L", price: 289000, originalPrice: 360000, stock: 8, sku: "MORI-LN-WT-L" },
      { id: "v1-3", name: "Màu / Size", value: "Xanh Olive / Size M", price: 310000, originalPrice: 380000, stock: 4, sku: "MORI-LN-OL-M" },
    ],
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&q=80",
    badge: "Shopee Mall",
  },
  {
    id: "prod-2",
    shop: "An Yên Ceramic",
    shopVerified: true,
    category: "home",
    name: "Đèn gốm phong cách Wabi-Sabi thủ công",
    description: "Chế tác từ đất sét mộc nung nhiệt cao, bề mặt tạo vân xước thủ công, tỏa ánh sáng vàng dịu mắt.",
    rating: 5.0,
    reviewsCount: 58,
    soldCount: "340",
    variants: [
      { id: "v2-1", name: "Loại men", value: "Men Mộc Cổ Điển", price: 420000, originalPrice: 500000, stock: 12, sku: "AY-LAMP-MOC" },
      { id: "v2-2", name: "Loại men", value: "Trắng Xước Thô", price: 450000, originalPrice: 520000, stock: 6, sku: "AY-LAMP-XUOC" },
    ],
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80",
    badge: "Yêu thích",
  },
  {
    id: "prod-3",
    shop: "EcoLife Official",
    shopVerified: false,
    category: "fashion",
    name: "Túi Tote Canvas dệt sợi đay hữu cơ",
    description: "Vải bố cotton 12oz dày dặn, có ngăn phụ khóa kéo, đáy rộng để vừa laptop 14-inch và sách vở.",
    rating: 4.8,
    reviewsCount: 96,
    soldCount: "890",
    variants: [
      { id: "v3-1", name: "Kích cỡ", value: "Tiêu chuẩn (38x40cm)", price: 169000, originalPrice: 220000, stock: 30, sku: "ECO-TOTE-STD" },
    ],
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80",
    badge: "Freeship Xtra",
  },
  {
    id: "prod-4",
    shop: "Minimal Living",
    shopVerified: true,
    category: "home",
    name: "Bình giữ nhiệt Inox 316 tráng gốm Pastel 500ml",
    description: "Lõi Inox y tế tráng men gốm cao cấp không bám mùi, giữ nhiệt nóng 12h, lạnh 24h, nắp bật tiện lợi.",
    rating: 4.9,
    reviewsCount: 310,
    soldCount: "2.1k",
    variants: [
      { id: "v4-1", name: "Màu nắp", value: "Xanh Sage Mờ", price: 245000, originalPrice: 320000, stock: 20, sku: "ML-BOTTLE-SG" },
      { id: "v4-2", name: "Màu nắp", value: "Hồng Đất Mịn", price: 245000, originalPrice: 320000, stock: 14, sku: "ML-BOTTLE-PK" },
    ],
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
    badge: "Top Bán Chạy",
  },
  {
    id: "prod-5",
    shop: "Herb Bloom Organic",
    shopVerified: false,
    category: "organic",
    name: "Nến thơm sáp đậu nành tinh dầu Gỗ Thông & Cam Ngọt",
    description: "Bấc gỗ bập bùng thư giãn, sáp thực vật lành tính không khói đen độc hại, thơm dịu dễ chịu.",
    rating: 4.9,
    reviewsCount: 88,
    soldCount: "620",
    variants: [
      { id: "v5-1", name: "Quy cách", value: "Hũ thủy tinh 200g", price: 195000, originalPrice: 250000, stock: 18, sku: "HB-CANDLE-200" },
    ],
    image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&q=80",
    badge: "Thủ công",
  },
  {
    id: "prod-6",
    shop: "TechCraft Studio",
    shopVerified: true,
    category: "tech",
    name: "Bàn phím cơ không dây Retro 75% Cream & Walnut",
    description: "Layout 75% nhỏ gọn, 3 chế độ kết nối (Bluetooth 5.1 / 2.4Ghz / Type-C), phím switch gõ êm ái.",
    rating: 5.0,
    reviewsCount: 42,
    soldCount: "190",
    variants: [
      { id: "v6-1", name: "Switch", value: "Gateron Yellow (Linear)", price: 890000, originalPrice: 1100000, stock: 5, sku: "TC-KB-YEL" },
      { id: "v6-2", name: "Switch", value: "Silent Peach (Siêu êm)", price: 950000, originalPrice: 1200000, stock: 7, sku: "TC-KB-PCH" },
    ],
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80",
    badge: "Shopee Mall",
  },
];

const AMAZON_FEATURE_CARDS = [
  {
    id: "fc-1",
    title: "Thời trang Linen & Tối giản",
    linkText: "Xem tất cả ưu đãi",
    categoryFilter: "fashion",
    items: [
      { name: "Áo sơ mi Linen", img: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200", price: "Từ 289k" },
      { name: "Quần âu suông", img: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=200", price: "Từ 340k" },
      { name: "Váy suông đũi", img: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=200", price: "Dưới 350k" },
      { name: "Khăn choàng dệt", img: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=200", price: "Dưới 150k" },
    ],
  },
  {
    id: "fc-2",
    title: "Gốm sứ & Nhà cửa dưới 350K",
    linkText: "Khám phá phong cách Wabi-Sabi",
    categoryFilter: "home",
    items: [
      { name: "Đèn gốm mộc", img: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=200", price: "320.000₫" },
      { name: "Ly men xước", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=200", price: "145.000₫" },
      { name: "Bình giữ nhiệt 316", img: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200", price: "245.000₫" },
      { name: "Khay gỗ Teak", img: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=200", price: "180.000₫" },
    ],
  },
  {
    id: "fc-3",
    title: "Công nghệ & Setup góc làm việc",
    linkText: "Nâng cấp bàn làm việc",
    categoryFilter: "tech",
    items: [
      { name: "Bàn phím cơ Retro", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200", price: "890.000₫" },
      { name: "Chuột gỗ Silent", img: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=200", price: "420.000₫" },
      { name: "Đế máy tính gỗ", img: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200", price: "260.000₫" },
      { name: "Pad chuột da", img: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=200", price: "190.000₫" },
    ],
  },
  {
    id: "fc-4",
    title: "Ưu đãi Flash Sale giờ vàng",
    linkText: "Xem toàn bộ 12 deal hôm nay",
    categoryFilter: "all",
    isFlashSale: true,
  },
];

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [products] = useState<Product[]>(INITIAL_PRODUCTS);
  const [officialStores] = useState<OfficialStore[]>(INITIAL_OFFICIAL_STORES);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("popular");

  // Giỏ hàng mô phỏng tách 2 Shop theo quy định đề án
  const [cart, setCart] = useState<CartItem[]>([
    {
      id: "ci-1",
      productId: "prod-1",
      variantId: "v1-1",
      shopName: "Mori Studio",
      productName: "Áo sơ mi Linen dáng suông Minimalist",
      variantName: "Be Cát / Size M",
      price: 289000,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200&q=80",
      isSelected: true,
    },
    {
      id: "ci-2",
      productId: "prod-4",
      variantId: "v4-1",
      shopName: "Minimal Living",
      productName: "Bình giữ nhiệt Inox 316 phủ gốm Pastel",
      variantName: "Xanh Sage Mờ",
      price: 245000,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200&q=80",
      isSelected: true,
    },
  ]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState("SPRING2026");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number; minOrder: number } | null>({
    code: "SPRING2026",
    discount: 50000,
    minOrder: 200000,
  });
  const [voucherError, setVoucherError] = useState("");

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
  };

  const filteredProducts = products
    .filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const matchQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shop.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.variants[0].price - b.variants[0].price;
      if (sortBy === "price-desc") return b.variants[0].price - a.variants[0].price;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0;
    });

  const handleAddToCart = (product: Product, variant?: ProductVariant) => {
    const v = variant || product.variants[0];
    setCart((prev) => {
      const exist = prev.find((item) => item.variantId === v.id);
      if (exist) {
        return prev.map((item) =>
          item.variantId === v.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: "ci-" + Date.now(),
          productId: product.id,
          variantId: v.id,
          shopName: product.shop,
          productName: product.name,
          variantName: v.value,
          price: v.price,
          quantity: 1,
          image: product.image,
          isSelected: true,
        },
      ];
    });
    showToast(`Đã thêm "${product.name}" vào giỏ hàng`);
    setIsCartOpen(true);
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variantId === variantId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = cart.length > 0 ? 25000 : 0;
  let discountAmount = 0;
  if (appliedVoucher && subtotal >= appliedVoucher.minOrder) {
    discountAmount = appliedVoucher.discount;
  }
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

  const handleApplyVoucher = () => {
    setVoucherError("");
    if (voucherCode.trim().toUpperCase() === "SPRING2026") {
      setAppliedVoucher({ code: "SPRING2026", discount: 50000, minOrder: 200000 });
      showToast("Áp dụng mã voucher SPRING2026 (-50.000₫)");
    } else {
      setVoucherError("Mã voucher không hợp lệ!");
    }
  };

  const cartGroupedByShop = cart.reduce((acc, item) => {
    if (!acc[item.shopName]) acc[item.shopName] = [];
    acc[item.shopName].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  const openQuickView = (p: Product) => {
    setQuickViewProduct(p);
    setSelectedVariant(p.variants[0]);
  };

  return (
    <div className="min-h-screen bg-[#FFF9FB] text-[#1E1B1D] pb-20 selection:bg-[#FFF0F5] selection:text-[#E83D6C]">
      {/* 1. TOP PROMO BAR (Hồng light thanh lịch) */}
      <div className="bg-[#FDE8EF] text-[#831843] text-xs py-2 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-3 border-b border-[#FCE7F0]">
        <span className="inline-flex items-center gap-1.5 bg-white text-[#BE185D] px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider border border-[#FDA4AF]/60 shadow-2xs">
          <Sparkles className="w-3 h-3 text-[#E83D6C]" />
          VOUCHER SÀN 50K
        </span>
        <span>
          Nhập mã <strong className="text-[#9D174D] underline decoration-[#E83D6C] underline-offset-2 font-black">SPRING2026</strong> giảm 50.000₫ cho đơn từ 200.000₫
        </span>
      </div>

      {/* 2. AMAZON-STYLE OFF-CANVAS SIDEBAR DRAWER */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="absolute inset-0 bg-[#1E1B1D]/40 backdrop-blur-2xs transition-opacity"
        />

        {/* Sliding Panel */}
        <aside
          className={`relative w-80 sm:w-96 bg-white h-full shadow-2xl flex flex-col z-10 transform transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#E83D6C] to-[#F43F5E] text-white px-6 py-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">
                <User className="w-5 h-5" />
              </div>
              <div className="font-bold text-base tracking-tight">Xin chào, Vĩ Đông</div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              title="Đóng sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Menu Sections */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#FCE7F0] text-[#374151] text-sm">
            {/* Section 1: Digital Content */}
            <div className="py-3">
              <h4 className="px-6 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1E1B1D]">
                Thiết Bị & Nội Dung Số
              </h4>
              <button
                onClick={() => { showToast("Mở kênh Shopee / Amazon Live"); setIsSidebarOpen(false); }}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors cursor-pointer"
              >
                <span>Shopee Live & Video</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
              <button
                onClick={() => { showToast("Sách & E-books tuyển chọn"); setIsSidebarOpen(false); }}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors cursor-pointer"
              >
                <span>Sách & Tạp chí phong cách sống</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            {/* Section 2: Shop by Department */}
            <div className="py-3">
              <h4 className="px-6 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1E1B1D]">
                Mua Sắm Theo Ngành Hàng
              </h4>
              <button
                onClick={() => { setSelectedCategory("all"); setIsSidebarOpen(false); showToast("Đang xem: Tất cả sản phẩm"); }}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors cursor-pointer font-medium"
              >
                <span>Tất cả sản phẩm</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
              <button
                onClick={() => { setSelectedCategory("fashion"); setIsSidebarOpen(false); showToast("Đã lọc: Thời trang Linen & Tối giản"); }}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors cursor-pointer"
              >
                <span>Thời trang Linen & Tối giản</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
              <button
                onClick={() => { setSelectedCategory("home"); setIsSidebarOpen(false); showToast("Đã lọc: Đồ gia dụng & Gốm sứ Wabi-Sabi"); }}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors cursor-pointer"
              >
                <span>Gốm sứ thủ công & Gia dụng Bắc Âu</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
              <button
                onClick={() => { setSelectedCategory("tech"); setIsSidebarOpen(false); showToast("Đã lọc: Công nghệ & Bàn phím cơ"); }}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors cursor-pointer"
              >
                <span>Công nghệ & Phụ kiện Retro</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            {/* Section 3: Programs & Features */}
            <div className="py-3">
              <h4 className="px-6 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1E1B1D]">
                Chương Trình & Tiện Ích
              </h4>
              <a
                href="#official-stores"
                onClick={() => setIsSidebarOpen(false)}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors"
              >
                <span>Gian Hàng Chính Hãng (LazMall)</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </a>
              <button
                onClick={() => { setIsCartOpen(true); setIsSidebarOpen(false); }}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] hover:text-[#E83D6C] text-left transition-colors cursor-pointer"
              >
                <span>Mã Giảm Giá Sàn (SPRING2026 - 50K)</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
              <Link
                href="/seller"
                onClick={() => setIsSidebarOpen(false)}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] text-[#BE185D] font-semibold text-left transition-colors"
              >
                <span>Kênh Người Bán (Seller Center)</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </Link>
              <Link
                href="/admin"
                onClick={() => setIsSidebarOpen(false)}
                className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-[#FFF0F5] text-emerald-700 font-semibold text-left transition-colors"
              >
                <span>Cổng Quản Trị Hệ Thống (Admin Portal)</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </Link>
            </div>

            {/* Section 4: Settings & Help */}
            <div className="py-3">
              <h4 className="px-6 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1E1B1D]">
                Trợ Giúp & Cài Đặt
              </h4>
              <div className="px-6 py-2 flex items-center gap-2 text-[#6B7280] text-xs">
                <Globe className="w-4 h-4 text-[#E83D6C]" />
                <span>Ngôn ngữ: Tiếng Việt (VN)</span>
              </div>
              <button
                onClick={() => { showToast("Đã mở trung tâm CSKH 24/7 (Hotline 1900 6868)"); setIsSidebarOpen(false); }}
                className="w-full px-6 py-2 flex items-center justify-between hover:bg-[#FFF0F5] text-[#374151] hover:text-[#1E1B1D] text-left transition-colors cursor-pointer text-xs"
              >
                <span>Dịch vụ khách hàng</span>
              </button>
              <button
                onClick={() => { showToast("Đã đăng xuất phiên làm việc"); setIsSidebarOpen(false); }}
                className="w-full px-6 py-2 flex items-center justify-between hover:bg-[#FFF0F5] text-[#E83D6C] hover:text-[#CF2453] text-left transition-colors cursor-pointer text-xs font-semibold"
              >
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. AMAZON-STYLE HIGH-INFORMATION TOP NAVIGATION (Hồng Light Trắng Sáng) */}
      <header className="sticky top-0 z-40 shadow-xs border-b border-[#FCE7F0]">
        {/* Tier 1: Main Header Bar (Trắng sáng tinh tế #FFFFFF) */}
        <div className="bg-white text-[#1E1B1D] px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 text-xs">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-[#FFF0F5] transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E83D6C] to-[#FB7185] flex items-center justify-center text-white font-black text-base shadow-xs shadow-[#E83D6C]/20">
                ✦
              </div>
              <div className="flex flex-col">
                <div className="font-black text-[#1E1B1D] tracking-tight text-base leading-none">
                  shopee<span className="text-[#E83D6C] text-xs font-bold ml-0.5">minimal</span>
                </div>
                <span className="text-[9px] text-[#8E8289] font-medium">.vn</span>
              </div>
            </Link>

            {/* Deliver to Vietnam Location */}
            <div
              onClick={() => showToast("Địa chỉ giao hàng mặc định: Hà Nội, Việt Nam")}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-[#FFF0F5] cursor-pointer transition-colors"
            >
              <MapPin className="w-4 h-4 text-[#E83D6C]" />
              <div className="leading-none">
                <div className="text-[10px] text-[#8E8289]">Giao đến</div>
                <div className="text-xs font-bold text-[#1E1B1D] tracking-tight">Việt Nam</div>
              </div>
            </div>
          </div>

          {/* Central Dominant Search Bar (Viền hồng phấn thanh lịch) */}
          <div className="flex-1 max-w-2xl mx-1 sm:mx-2 flex items-center rounded-xl overflow-hidden bg-white border border-[#FCE7F0] focus-within:border-[#E83D6C] focus-within:ring-2 focus-within:ring-[#E83D6C]/20 shadow-2xs transition-all">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#FFF9FB] text-[#4A4548] text-xs px-2.5 py-2 font-medium border-r border-[#FCE7F0] outline-none hover:bg-[#FFF0F5] cursor-pointer hidden md:block"
            >
              <option value="all">Tất cả ngành hàng</option>
              <option value="fashion">Thời trang Linen</option>
              <option value="home">Gốm sứ & Gia dụng</option>
              <option value="tech">Công nghệ Retro</option>
            </select>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm, thương hiệu hoặc gian hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-[#1E1B1D] text-xs sm:text-sm px-3 py-2 outline-none placeholder:text-stone-400 bg-transparent"
            />
            <button
              onClick={() => showToast(`Tìm kiếm: ${searchQuery || "Tất cả sản phẩm"}`)}
              className="bg-[#E83D6C] hover:bg-[#CF2453] text-white px-4 py-2 transition-colors cursor-pointer flex items-center justify-center font-bold"
              title="Tìm kiếm"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language */}
            <div
              onClick={() => showToast("Ngôn ngữ hiện tại: Tiếng Việt")}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-[#FFF0F5] cursor-pointer transition-colors"
            >
              <span className="text-sm">🇻🇳</span>
              <span className="font-bold text-xs text-[#1E1B1D]">VN</span>
              <ChevronDown className="w-3 h-3 text-[#8E8289]" />
            </div>

            {/* Account & Lists */}
            <div
              onClick={() => showToast("Tài khoản: Vĩ Đông (Khách hàng)")}
              className="hidden sm:flex flex-col leading-none px-2.5 py-1.5 rounded-xl hover:bg-[#FFF0F5] cursor-pointer transition-colors"
            >
              <span className="text-[10px] text-[#8E8289]">Xin chào, Vĩ Đông</span>
              <span className="text-xs font-bold text-[#1E1B1D] flex items-center gap-0.5 mt-0.5">
                Tài khoản & Đơn <ChevronDown className="w-3 h-3 text-[#8E8289]" />
              </span>
            </div>

            {/* Seller Channel / Orders */}
            <Link
              href="/seller"
              className="hidden lg:flex flex-col leading-none px-2.5 py-1.5 rounded-xl hover:bg-[#FFF0F5] transition-colors"
            >
              <span className="text-[10px] text-[#8E8289]">Kênh Shop</span>
              <span className="text-xs font-bold text-[#1E1B1D] mt-0.5">& Quản Lý Đơn</span>
            </Link>

            {/* Cart with Big Count Badge (#E83D6C) */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-[#FFF0F5] cursor-pointer transition-colors"
              title="Giỏ hàng"
            >
              <div className="relative">
                <ShoppingBag className="w-6 h-6 text-[#1E1B1D]" />
                <span className="absolute -top-1.5 -right-1.5 bg-[#E83D6C] text-white font-black text-[10px] min-w-[17px] h-4 rounded-full flex items-center justify-center px-1 shadow-xs">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              </div>
              <span className="font-bold text-xs text-[#1E1B1D] hidden sm:inline-block">Giỏ hàng</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Sub-Navigation Bar (#FFF3F7) */}
        <div className="bg-[#FFF3F7] text-[#4A4548] text-xs px-3 sm:px-6 py-1.5 flex items-center gap-1 sm:gap-2.5 overflow-x-auto whitespace-nowrap scrollbar-none border-t border-[#FCE7F0]">
          {/* Hamburger "All" Button (Triggers Left Sidebar) */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#FCE7F0] font-bold text-[#E83D6C] hover:bg-[#FFF0F5] cursor-pointer transition-colors shadow-2xs"
          >
            <Menu className="w-4 h-4" />
            <span>Tất cả</span>
          </button>

          <button
            onClick={() => { setSelectedCategory("all"); showToast("Xem ưu đãi hôm nay"); }}
            className="px-2.5 py-1 rounded-lg hover:bg-white text-[#4A4548] hover:text-[#E83D6C] font-medium transition-colors"
          >
            Ưu Đãi Hôm Nay
          </button>

          <a
            href="#official-stores"
            className="px-2.5 py-1 rounded-lg hover:bg-white text-[#E83D6C] font-bold flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E83D6C]" />
            Gian Hàng Chính Hãng LazMall
          </a>

          <button
            onClick={() => { setVoucherCode("SPRING2026"); setIsCartOpen(true); }}
            className="px-2.5 py-1 rounded-lg hover:bg-white text-[#4A4548] hover:text-[#E83D6C] font-medium transition-colors"
          >
            Mã Giảm Giá Sàn
          </button>

          <Link
            href="/seller"
            className="px-2.5 py-1 rounded-lg hover:bg-white text-[#4A4548] hover:text-[#E83D6C] font-medium flex items-center gap-1 transition-colors"
          >
            <Store className="w-3.5 h-3.5 text-[#E83D6C]" />
            Kênh Người Bán
          </Link>

          <Link
            href="/admin"
            className="px-2.5 py-1 rounded-lg hover:bg-white text-[#4A4548] hover:text-[#E83D6C] font-medium flex items-center gap-1 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Cổng Quản Trị (Admin)
          </Link>

          <button
            onClick={() => showToast("Hotline CSKH: 1900 6868 (Phục vụ 24/7)")}
            className="px-2.5 py-1 rounded-lg hover:bg-white text-[#8E8289] hover:text-[#1E1B1D] hidden md:inline-block transition-colors"
          >
            Dịch Vụ Khách Hàng
          </button>
        </div>
      </header>

      {/* 3. MAIN STOREFRONT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 mt-8 space-y-12">
        {/* BENTO HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-gradient-to-br from-[#FFF0F5] via-[#FFF9FB] to-white border border-[#FCE7F0] rounded-3xl p-8 sm:p-12 relative overflow-hidden flex flex-col justify-between min-h-[380px] shadow-xs">
            <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-[#FDA4AF]/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 max-w-lg space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-[#FDA4AF]/60 text-[#BE185D] text-[11px] font-bold tracking-wider uppercase shadow-2xs">
                ✦ BỘ SƯU TẬP XUÂN - HÈ 2026
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1E1B1D] tracking-tight leading-[1.15]">
                Không gian sống <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E83D6C] via-[#F43F5E] to-[#FB7185] font-light italic font-serif">
                  thanh lịch & tối giản
                </span>
              </h1>
              <p className="text-[#4A4548] text-sm sm:text-base leading-relaxed pt-1">
                Khám phá các sản phẩm gốm mộc, gia dụng Scandinavian và thời trang sợi tự nhiên từ các shop uy tín đã được xác thực trên sàn.
              </p>
            </div>

            <div className="relative z-10 pt-6 flex flex-wrap items-center gap-4">
              <a
                href="#products"
                className="group inline-flex items-center justify-between gap-4 bg-[#E83D6C] text-white pl-6 pr-2 py-2 rounded-full font-bold text-sm hover:bg-[#CF2453] active:scale-[0.98] transition-all shadow-md shadow-[#E83D6C]/25"
              >
                <span>Khám phá ngay</span>
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </a>
              <span className="text-xs text-[#8E8289] font-medium">Freeship toàn quốc đơn từ 150k</span>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* Flash Sale */}
            <div className="flex-1 bg-white border border-[#FCE7F0] rounded-3xl p-6 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#E83D6C] tracking-wider uppercase flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#E83D6C] animate-pulse"></span>
                  Flash Sale Hôm Nay
                </span>
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold bg-[#FFF0F5] text-[#BE185D] border border-[#FDA4AF]/40 px-2 py-1 rounded-md">
                  <Clock className="w-3 h-3 text-[#E83D6C]" />
                  <span>02:45:18</span>
                </div>
              </div>
              <div className="py-3">
                <h3 className="font-bold text-[#1E1B1D] text-base">Đèn gốm Wabi-Sabi thủ công</h3>
                <p className="text-xs text-[#8E8289] mt-1">Shop: An Yên Ceramic • Đã bán 340</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-xl font-black text-[#E83D6C]">320.000₫</span>
                  <span className="text-xs text-stone-400 line-through">450.000₫</span>
                  <span className="text-[10px] font-bold bg-[#FFF0F5] text-[#E83D6C] border border-[#FDA4AF] px-1.5 py-0.5 rounded">-29%</span>
                </div>
              </div>
              <button
                onClick={() => handleAddToCart(products[1])}
                className="w-full py-2.5 bg-[#FFF0F5] text-[#E83D6C] hover:bg-[#E83D6C] hover:text-white border border-[#FDA4AF]/80 font-bold text-xs rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                + Thêm nhanh vào giỏ
              </button>
            </div>

            {/* Voucher Card (Gradient Rosewood & Magenta) */}
            <div className="bg-gradient-to-br from-[#831843] via-[#9D174D] to-[#BE185D] text-white rounded-3xl p-6 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-pink-300" />
                  VOUCHER TOÀN SÀN
                </span>
                <span className="text-[11px] text-pink-200/80">Còn 42 lượt</span>
              </div>
              <div className="py-2">
                <div className="text-2xl font-black tracking-tight text-white">GIẢM 50.000₫</div>
                <p className="text-xs text-pink-100 mt-0.5">Áp dụng cho mọi đơn từ 200.000₫</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/20">
                <code className="font-mono text-xs bg-white/20 px-2.5 py-1 rounded text-white font-bold tracking-wider">
                  SPRING2026
                </code>
                <button
                  onClick={() => {
                    setVoucherCode("SPRING2026");
                    handleApplyVoucher();
                    setIsCartOpen(true);
                  }}
                  className="text-xs text-white font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Dùng mã <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* AMAZON 4-QUADRANT FEATURE BOX CARDS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#FCE7F0] pb-2">
            <div>
              <h2 className="text-xl font-bold text-[#1E1B1D] tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-6 rounded-full bg-[#E83D6C] inline-block"></span>
                Bộ Sưu Tập Xu Hướng Theo Chủ Đề
              </h2>
              <p className="text-xs text-[#8E8289]">Khám phá theo ngành hàng và phân khúc giá ưu đãi</p>
            </div>
            <span className="text-xs font-bold text-[#E83D6C] bg-[#FFF0F5] px-2.5 py-1 rounded-full border border-[#FDA4AF]/60">
              Amazon Style Cards
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AMAZON_FEATURE_CARDS.map((card) => (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-[#FCE7F0] p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-[#F472B6] hover:shadow-xs transition-all duration-300"
              >
                <div>
                  <h3 className="font-extrabold text-[#1E1B1D] text-sm sm:text-base leading-tight mb-3">
                    {card.title}
                  </h3>

                  {card.isFlashSale ? (
                    <div className="space-y-3">
                      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-stone-100 border border-[#FCE7F0]">
                        <img
                          src="https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600"
                          alt="Flash Sale Nến Thơm"
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-2 left-2 bg-[#E83D6C] text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                          -29% GIẢM
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-[#1E1B1D] text-xs line-clamp-1">
                          Nến thơm bấc gỗ Soy Wax Tĩnh Lặng
                        </h4>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-base font-black text-[#E83D6C]">195.000₫</span>
                          <span className="text-xs text-stone-400 line-through">250.000₫</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {card.items?.map((it, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedCategory(card.categoryFilter);
                            showToast(`Xem sản phẩm: ${it.name}`);
                          }}
                          className="group cursor-pointer flex flex-col"
                        >
                          <div className="aspect-square rounded-xl bg-[#FFF9FB] border border-[#FCE7F0] overflow-hidden flex items-center justify-center p-1 group-hover:border-[#F472B6] transition-colors">
                            <img
                              src={it.img}
                              alt={it.name}
                              className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <span className="text-[11px] font-medium text-[#4A4548] mt-1 line-clamp-1 group-hover:text-[#E83D6C]">
                            {it.name}
                          </span>
                          <span className="text-[10px] text-[#8E8289] font-semibold">
                            {it.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedCategory(card.categoryFilter);
                    showToast(`Đã lọc danh mục: ${card.title}`);
                  }}
                  className="text-xs font-bold text-[#E83D6C] hover:text-[#CF2453] hover:underline pt-3 mt-2 text-left cursor-pointer flex items-center gap-1"
                >
                  <span>{card.linkText}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* LAZMALL / GIAN HÀNG CHÍNH HÃNG SECTION */}
        <section id="official-stores" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#FCE7F0] pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-6 rounded-full bg-[#E83D6C] inline-block"></span>
                <h2 className="text-xl font-bold tracking-tight text-[#1E1B1D]">
                  Gian Hàng Chính Hãng <span className="text-[#E83D6C] font-extrabold text-sm ml-1 px-2.5 py-0.5 rounded-full bg-[#FFF0F5] border border-[#FDA4AF]/60">LazMall</span>
                </h2>
              </div>
              <div className="hidden md:flex items-center gap-4 text-xs text-[#8E8289] pl-4 border-l border-[#FCE7F0]">
                <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  100% Chính Hãng
                </span>
                <span className="flex items-center gap-1 font-medium text-[#BE185D] bg-[#FFF0F5] px-2 py-0.5 rounded-full">
                  <RotateCcw className="w-3.5 h-3.5 text-[#E83D6C]" />
                  15 Ngày Trả Hàng Miễn Phí
                </span>
                <span className="flex items-center gap-1 font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                  <Truck className="w-3.5 h-3.5 text-sky-600" />
                  Giao Nhanh Toàn Quốc
                </span>
              </div>
            </div>

            <button
              onClick={() => showToast("Đang mở danh mục tất cả thương hiệu LazMall")}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#E83D6C] hover:text-[#CF2453] transition-colors self-start sm:self-auto cursor-pointer"
            >
              Xem tất cả
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {officialStores.map((store) => (
              <div
                key={store.id}
                className="group bg-white rounded-2xl border border-[#FCE7F0] hover:border-[#F472B6] hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Brand Banner */}
                <div className="relative h-28 bg-[#FFF9FB] overflow-hidden">
                  <img
                    src={store.bannerImg}
                    alt={store.shopName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                  <span className="absolute top-2.5 right-2.5 bg-[#E83D6C] text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-xs tracking-wide">
                    {store.discountBadge}
                  </span>
                </div>

                {/* Brand Profile Header */}
                <div className="px-3.5 pt-2 pb-1 relative flex items-center gap-3">
                  <div className="w-12 h-12 -mt-7 rounded-xl border-2 border-white bg-white shadow-xs overflow-hidden flex-shrink-0 z-10">
                    <img
                      src={store.logoImg}
                      alt={store.shopName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-1">
                      <h4 className="font-bold text-[#1E1B1D] text-xs truncate">
                        {store.shopName}
                      </h4>
                      <BadgeCheck className="w-3.5 h-3.5 text-[#E83D6C] flex-shrink-0" />
                    </div>
                    <p className="text-[11px] text-[#8E8289] truncate">
                      {store.tagline}
                    </p>
                  </div>
                </div>

                {/* 2 Mini Product Previews */}
                <div className="p-3 pt-2 mt-auto grid grid-cols-2 gap-2 border-t border-[#FCE7F0]">
                  {store.previewProducts.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => showToast(`Xem chi tiết ${item.name}`)}
                      className="bg-[#FFF9FB] hover:bg-[#FFF0F5] p-2 rounded-xl transition-colors cursor-pointer group/item text-center flex flex-col items-center border border-[#FCE7F0]/60"
                    >
                      <div className="w-full aspect-square rounded-lg bg-white overflow-hidden mb-1.5 border border-[#FCE7F0]">
                        <img
                          src={item.img}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <span className="text-[11px] text-[#4A4548] line-clamp-1 group-hover/item:text-[#E83D6C] font-medium">
                        {item.name}
                      </span>
                      <span className="text-xs font-black text-[#E83D6C] mt-0.5">
                        {fmtPrice(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AMAZON HORIZONTAL PRODUCT CAROUSEL */}
        <section className="bg-white rounded-2xl border border-[#FCE7F0] p-4 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1E1B1D] tracking-tight flex items-center gap-2">
                <span>Top Sản Phẩm Bán Chạy Tuyển Chọn</span>
                <span className="text-[11px] font-bold text-[#E83D6C] bg-[#FFF0F5] px-2 py-0.5 rounded-full font-mono hidden sm:inline border border-[#FDA4AF]/40">
                  TOP SELLERS
                </span>
              </h2>
              <p className="text-xs text-[#8E8289]">Được đánh giá cao và bán chạy nhất trên hệ thống</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const el = document.getElementById("amazon-carousel");
                  if (el) el.scrollBy({ left: -300, behavior: "smooth" });
                }}
                className="w-8 h-8 rounded-full border border-[#FCE7F0] hover:bg-[#FFF0F5] hover:border-[#FDA4AF] flex items-center justify-center text-[#1E1B1D] cursor-pointer shadow-2xs transition-colors"
                title="Cuộn sang trái"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById("amazon-carousel");
                  if (el) el.scrollBy({ left: 300, behavior: "smooth" });
                }}
                className="w-8 h-8 rounded-full border border-[#FCE7F0] hover:bg-[#FFF0F5] hover:border-[#FDA4AF] flex items-center justify-center text-[#1E1B1D] cursor-pointer shadow-2xs transition-colors"
                title="Cuộn sang phải"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            id="amazon-carousel"
            className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none scroll-smooth"
          >
            {products.map((p) => {
              const defaultVar = p.variants[0];
              return (
                <div
                  key={p.id}
                  className="w-36 sm:w-44 flex-shrink-0 bg-[#FFF9FB] hover:bg-white rounded-xl border border-[#FCE7F0] hover:border-[#F472B6] hover:shadow-xs p-2.5 transition-all flex flex-col justify-between cursor-pointer group"
                  onClick={() => openQuickView(p)}
                >
                  <div className="w-full aspect-square rounded-lg bg-white overflow-hidden border border-[#FCE7F0] mb-2">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8E8289] font-medium truncate block">
                      {p.shop}
                    </span>
                    <h4 className="font-bold text-[#1E1B1D] text-xs line-clamp-2 leading-snug group-hover:text-[#E83D6C]">
                      {p.name}
                    </h4>
                    <div className="flex items-center gap-1 text-[10px] text-[#F59E0B] font-bold mt-1">
                      <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                      <span>{p.rating}</span>
                      <span className="text-[#8E8289] font-normal">({p.soldCount})</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#FCE7F0]">
                    <span className="font-black text-xs text-[#E83D6C]">
                      {fmtPrice(defaultVar.price)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(p);
                      }}
                      className="p-1 rounded-full bg-[#FFF0F5] hover:bg-[#E83D6C] text-[#E83D6C] hover:text-white transition-colors cursor-pointer border border-[#FDA4AF]/50"
                      title="Thêm nhanh vào giỏ"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. CATEGORY FILTER CHIPS */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-[#1E1B1D] tracking-tight">Danh mục tuyển chọn</h2>
            <p className="text-xs text-[#8E8289]">Lựa chọn theo phong cách và nhu cầu</p>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2">
            {[
              { id: "all", label: "Tất cả sản phẩm" },
              { id: "fashion", label: "Thời trang Linen & Tối giản" },
              { id: "home", label: "Đồ gia dụng & Gốm sứ" },
              { id: "organic", label: "Mỹ phẩm & Nến thơm" },
              { id: "tech", label: "Phụ kiện công nghệ Retro" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[#E83D6C] text-white shadow-xs"
                    : "bg-white border border-[#FCE7F0] text-[#4A4548] hover:bg-[#FFF0F5] hover:text-[#E83D6C] hover:border-[#FDA4AF]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        {/* 5. PRODUCT LISTING GRID */}
        <section id="products" className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#FCE7F0] pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#1E1B1D]">Danh sách sản phẩm</span>
              <span className="text-xs bg-[#FFF0F5] text-[#E83D6C] border border-[#FDA4AF]/50 px-2.5 py-0.5 rounded-full font-bold">
                {filteredProducts.length} sản phẩm
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#8E8289]">
              <span>Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-bold text-[#1E1B1D] border-none outline-none cursor-pointer"
              >
                <option value="popular">Phổ biến nhất</option>
                <option value="price-asc">Giá: Thấp đến Cao</option>
                <option value="price-desc">Giá: Cao đến Thấp</option>
                <option value="rating">Đánh giá cao</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredProducts.map((p) => {
              const defaultVar = p.variants[0];
              return (
                <article key={p.id} className="bezel-card rounded-2xl overflow-hidden flex flex-col group relative bg-white border border-[#FCE7F0] hover:border-[#F472B6]">
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-[#831843]/85 backdrop-blur-xs text-white text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase">
                      {p.badge}
                    </span>
                  </div>

                  <div
                    className="w-full aspect-square bg-[#FFF9FB] overflow-hidden relative cursor-pointer"
                    onClick={() => openQuickView(p)}
                  >
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors"></div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[#8E8289] mb-0.5">
                        <span className="font-medium truncate max-w-[90px]">{p.shop}</span>
                        <div className="flex items-center text-[#F59E0B] font-bold gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-[#F59E0B] text-[#F59E0B]" />
                          <span>{p.rating}</span>
                        </div>
                      </div>

                      <h3
                        onClick={() => openQuickView(p)}
                        className="font-bold text-[#1E1B1D] text-xs leading-snug line-clamp-2 hover:text-[#E83D6C] transition-colors cursor-pointer"
                      >
                        {p.name}
                      </h3>
                    </div>

                    <div className="pt-2 border-t border-[#FCE7F0] flex items-center justify-between">
                      <div>
                        <div className="text-xs sm:text-sm font-black text-[#E83D6C] tracking-tight">
                          {fmtPrice(defaultVar.price)}
                        </div>
                        {defaultVar.originalPrice && (
                          <span className="text-[10px] text-[#8E8289] line-through block">
                            {fmtPrice(defaultVar.originalPrice)}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleAddToCart(p)}
                        className="w-7 h-7 rounded-full bg-[#FFF0F5] hover:bg-[#E83D6C] hover:text-white text-[#E83D6C] flex items-center justify-center text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer border border-[#FDA4AF]/50"
                        title="Thêm vào giỏ"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 6. TRUST BADGES */}
        <section className="border-t border-[#FCE7F0] pt-12 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center p-4">
            <div className="w-10 h-10 rounded-full bg-[#FFF0F5] text-[#E83D6C] flex items-center justify-center mb-3 shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-[#1E1B1D] text-sm">Hàng chính hãng 100%</h4>
            <p className="text-xs text-[#8E8289] mt-1">Đảm bảo nguồn gốc xuất xứ từ các gian hàng được xác thực.</p>
          </div>
          <div className="flex flex-col items-center p-4">
            <div className="w-10 h-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center mb-3 shadow-2xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-[#1E1B1D] text-sm">Đổi trả thuận tiện 7 ngày</h4>
            <p className="text-xs text-[#8E8289] mt-1">Hỗ trợ trả hàng nhanh chóng theo đúng quy trình nghiệp vụ.</p>
          </div>
          <div className="flex flex-col items-center p-4">
            <div className="w-10 h-10 rounded-full bg-[#F0F9FF] text-[#0284C7] flex items-center justify-center mb-3 shadow-2xs">
              <Truck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-[#1E1B1D] text-sm">Vận chuyển mô phỏng minh bạch</h4>
            <p className="text-xs text-[#8E8289] mt-1">Truy vết trạng thái đơn hàng theo thời gian thực (Shipment Tracking).</p>
          </div>
        </section>
      </main>

      {/* 7. CART DRAWER */}
      {isCartOpen && (
        <div
          onClick={() => setIsCartOpen(false)}
          className="fixed inset-0 bg-[#1E1B1D]/40 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border-l border-[#FCE7F0] ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-[#FCE7F0] flex items-center justify-between bg-[#FFF9FB]">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[#1E1B1D] text-base">Giỏ hàng của bạn</h3>
            <span className="text-xs font-bold bg-[#FFF0F5] text-[#E83D6C] border border-[#FDA4AF]/60 px-2.5 py-0.5 rounded-full">
              {cart.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-white text-stone-500 hover:text-[#E83D6C] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-[#8E8289] space-y-3">
              <ShoppingBag className="w-12 h-12 mx-auto stroke-1 text-pink-200" />
              <p className="text-sm font-medium">Giỏ hàng của bạn đang trống</p>
            </div>
          ) : (
            Object.entries(cartGroupedByShop).map(([shopName, items]) => (
              <div key={shopName} className="bg-[#FFF9FB] border border-[#FCE7F0] rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#1E1B1D] pb-2 border-b border-[#FCE7F0]">
                  <div className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[#E83D6C]" />
                    <span>{shopName}</span>
                  </div>
                  <span className="text-[10px] text-[#8E8289] font-normal">Đơn tách riêng</span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.variantId} className="flex items-center gap-3">
                      <div className="w-14 h-14 relative rounded-xl overflow-hidden bg-white border border-[#FCE7F0] flex-shrink-0">
                        <Image src={item.image} alt={item.productName} fill className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-semibold text-[#1E1B1D] truncate">{item.productName}</h5>
                        <p className="text-[10px] text-[#8E8289] mt-0.5">{item.variantName}</p>
                        <div className="text-xs font-black text-[#E83D6C] mt-1">{fmtPrice(item.price)}</div>
                      </div>

                      <div className="flex items-center border border-[#FCE7F0] rounded-full bg-white px-1.5 py-0.5 text-xs shadow-2xs">
                        <button
                          onClick={() => updateQuantity(item.variantId, -1)}
                          className="w-5 h-5 text-stone-500 hover:text-[#E83D6C] flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold text-[#1E1B1D] text-[11px]">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.variantId, 1)}
                          className="w-5 h-5 text-stone-500 hover:text-[#E83D6C] flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 border-t border-[#FCE7F0] bg-[#FFF9FB] space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nhập voucher..."
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              className="flex-1 bg-white border border-[#FCE7F0] rounded-xl px-3 py-1.5 text-xs uppercase font-mono tracking-wider outline-none focus:border-[#E83D6C] shadow-2xs"
            />
            <button
              onClick={handleApplyVoucher}
              className="px-3.5 py-1.5 bg-[#E83D6C] text-white rounded-xl text-xs font-bold hover:bg-[#CF2453] transition-colors cursor-pointer shadow-xs"
            >
              Áp dụng
            </button>
          </div>
          {voucherError && <p className="text-[11px] text-[#DC2626] font-medium">{voucherError}</p>}
          {appliedVoucher && !voucherError && (
            <p className="text-[11px] text-[#059669] font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> Đã áp dụng mã {appliedVoucher.code} (-{fmtPrice(discountAmount)})
            </p>
          )}

          <div className="space-y-1.5 pt-2 text-xs">
            <div className="flex justify-between text-[#8E8289]">
              <span>Tiền hàng (Subtotal):</span>
              <span className="font-medium text-[#1E1B1D]">{fmtPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#8E8289]">
              <span>Phí vận chuyển:</span>
              <span className="font-medium text-[#1E1B1D]">{fmtPrice(shippingFee)}</span>
            </div>
            <div className="flex justify-between text-[#059669] font-medium">
              <span>Giảm giá Voucher:</span>
              <span>-{fmtPrice(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-[#1E1B1D] pt-2 border-t border-[#FCE7F0]">
              <span>Tổng thanh toán:</span>
              <span className="text-[#E83D6C] font-black text-lg">{fmtPrice(totalAmount)}</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (cart.length === 0) return;
              setIsCartOpen(false);
              showToast("Đang tạo đơn hàng theo chuẩn Transaction...");
              setTimeout(() => {
                alert("🎉 ĐẶT HÀNG THÀNH CÔNG!\n\nĐã khởi tạo đơn hàng với snapshot giá và tách đơn theo từng Shop.");
                setCart([]);
              }, 600);
            }}
            disabled={cart.length === 0}
            className="w-full py-3 bg-[#E83D6C] hover:bg-[#CF2453] disabled:bg-stone-300 text-white rounded-full font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#E83D6C]/30 cursor-pointer"
          >
            <span>Tiến hành Checkout ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 8. QUICK VIEW MODAL */}
      {quickViewProduct && (
        <div
          onClick={() => setQuickViewProduct(null)}
          className="fixed inset-0 bg-[#1E1B1D]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-[#FCE7F0]"
          >
            <button
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FFF0F5] hover:bg-[#FCE7F0] text-[#E83D6C] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-[#FFF9FB] relative border border-[#FCE7F0]">
                <Image src={quickViewProduct.image} alt={quickViewProduct.name} fill className="object-cover" />
              </div>

              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-[11px] font-bold text-[#E83D6C] uppercase tracking-wider">
                    {quickViewProduct.shop}
                  </div>
                  <h2 className="text-xl font-extrabold text-[#1E1B1D] mt-1">{quickViewProduct.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-[#8E8289] mt-2">
                    <span className="text-[#F59E0B] font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                      {quickViewProduct.rating}
                    </span>
                    <span>•</span>
                    <span>{quickViewProduct.reviewsCount} đánh giá</span>
                    <span>•</span>
                    <span>Đã bán {quickViewProduct.soldCount}</span>
                  </div>

                  <div className="text-2xl font-black text-[#E83D6C] mt-3">
                    {fmtPrice(selectedVariant?.price || quickViewProduct.variants[0].price)}
                  </div>

                  <p className="text-xs text-[#4A4548] mt-3 leading-relaxed">
                    {quickViewProduct.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#1E1B1D]">Chọn biến thể (SKU):</label>
                  <div className="flex flex-wrap gap-2">
                    {quickViewProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                          selectedVariant?.id === v.id
                            ? "border-[#E83D6C] bg-[#FFF0F5] text-[#E83D6C] font-bold shadow-2xs"
                            : "border-[#FCE7F0] bg-white text-[#4A4548] hover:bg-[#FFF9FB]"
                        }`}
                      >
                        {v.value}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleAddToCart(quickViewProduct, selectedVariant || undefined);
                    setQuickViewProduct(null);
                  }}
                  className="w-full py-3 bg-[#E83D6C] hover:bg-[#CF2453] text-white rounded-full font-bold text-sm transition-all shadow-md shadow-[#E83D6C]/25 cursor-pointer"
                >
                  Thêm vào giỏ hàng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E1B1D] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-medium border border-white/10">
          <span className="w-5 h-5 rounded-full bg-[#059669] text-white flex items-center justify-center text-[10px]">
            ✓
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
