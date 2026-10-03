"use client";

import React, { useState, useEffect } from "react";
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
  ChevronRight,
  Flame,
  Heart,
  Eye,
  CheckCircle2,
  Percent,
  Layers,
  ArrowRight,
  Package,
  Copy,
  Shirt,
  Home as HomeIcon,
  Laptop,
  Coffee,
  Sparkle,
} from "lucide-react";

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
  categoryName: string;
  name: string;
  description: string;
  rating: number;
  reviewsCount: number;
  soldCount: string;
  variants: ProductVariant[];
  image: string;
  badge: string;
  discountPercent: number;
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

const CATEGORIES = [
  { id: "all", name: "Tất cả", icon: Sparkles, count: "1.2k+ SP" },
  { id: "fashion", name: "Thời trang Nữ", icon: Sparkle, count: "480 SP" },
  { id: "men", name: "Thời trang Nam", icon: Shirt, count: "320 SP" },
  { id: "home", name: "Gốm & Nhà cửa", icon: HomeIcon, count: "210 SP" },
  { id: "organic", name: "Nến & Thư giãn", icon: Flame, count: "145 SP" },
  { id: "tech", name: "Góc làm việc", icon: Laptop, count: "98 SP" },
  { id: "bags", name: "Túi & Phụ kiện", icon: ShoppingBag, count: "190 SP" },
  { id: "kitchen", name: "Bếp & Thưởng trà", icon: Coffee, count: "115 SP" },
];

const OFFICIAL_STORES: OfficialStore[] = [
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
    categoryName: "Thời trang Nữ",
    name: "Áo sơ mi Linen dáng suông Minimalist Mori",
    description: "Chất liệu sợi lanh 100% tự nhiên nhập khẩu, bề mặt thô mộc thoáng khí, phom dáng oversize thoải mái.",
    rating: 4.9,
    reviewsCount: 142,
    soldCount: "1.4k",
    discountPercent: 20,
    variants: [
      { id: "v1-1", name: "Màu / Size", value: "Be Cát / Size M", price: 289000, originalPrice: 360000, stock: 15, sku: "MORI-LN-BE-M" },
      { id: "v1-2", name: "Màu / Size", value: "Trắng Kem / Size L", price: 289000, originalPrice: 360000, stock: 8, sku: "MORI-LN-WT-L" },
    ],
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&q=80",
    badge: "Mall",
  },
  {
    id: "prod-2",
    shop: "An Yên Ceramic",
    shopVerified: true,
    category: "home",
    categoryName: "Gốm & Nhà cửa",
    name: "Đèn gốm phong cách Wabi-Sabi thủ công",
    description: "Chế tác từ đất sét mộc nung nhiệt cao, bề mặt tạo vân xước thủ công, tỏa ánh sáng vàng dịu mắt.",
    rating: 5.0,
    reviewsCount: 58,
    soldCount: "340",
    discountPercent: 16,
    variants: [
      { id: "v2-1", name: "Loại men", value: "Men Mộc Cổ Điển", price: 420000, originalPrice: 500000, stock: 12, sku: "AY-LAMP-MOC" },
    ],
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80",
    badge: "Yêu thích",
  },
  {
    id: "prod-3",
    shop: "EcoLife Official",
    shopVerified: false,
    category: "bags",
    categoryName: "Túi & Phụ kiện",
    name: "Túi Tote Canvas dệt sợi đay hữu cơ",
    description: "Vải bố cotton 12oz dày dặn, có ngăn phụ khóa kéo, đáy rộng để vừa laptop 14-inch.",
    rating: 4.8,
    reviewsCount: 96,
    soldCount: "890",
    discountPercent: 23,
    variants: [
      { id: "v3-1", name: "Kích cỡ", value: "Tiêu chuẩn (38x40cm)", price: 169000, originalPrice: 220000, stock: 30, sku: "ECO-TOTE-STD" },
    ],
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80",
    badge: "Freeship",
  },
  {
    id: "prod-4",
    shop: "Minimal Living",
    shopVerified: true,
    category: "kitchen",
    categoryName: "Bếp & Thưởng trà",
    name: "Bình giữ nhiệt Inox 316 tráng gốm Pastel 500ml",
    description: "Lõi Inox y tế tráng men gốm cao cấp không bám mùi, giữ nhiệt nóng 12h, lạnh 24h.",
    rating: 4.9,
    reviewsCount: 310,
    soldCount: "2.1k",
    discountPercent: 23,
    variants: [
      { id: "v4-1", name: "Màu nắp", value: "Hồng Đất Mịn", price: 245000, originalPrice: 320000, stock: 14, sku: "ML-BOTTLE-PK" },
    ],
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
    badge: "Top Bán Chạy",
  },
  {
    id: "prod-5",
    shop: "Herb Bloom",
    shopVerified: false,
    category: "organic",
    categoryName: "Nến & Thư giãn",
    name: "Nến thơm sáp đậu nành tinh dầu Gỗ Thông & Cam",
    description: "Bấc gỗ bập bùng thư giãn, sáp thực vật lành tính không khói đen độc hại, thơm dịu dễ chịu.",
    rating: 4.9,
    reviewsCount: 88,
    soldCount: "620",
    discountPercent: 22,
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
    categoryName: "Góc làm việc",
    name: "Bàn phím cơ không dây Retro 75% Cream & Walnut",
    description: "Layout 75% nhỏ gọn, 3 chế độ kết nối (Bluetooth 5.1 / 2.4Ghz / Type-C), phím switch gõ êm ái.",
    rating: 5.0,
    reviewsCount: 42,
    soldCount: "190",
    discountPercent: 19,
    variants: [
      { id: "v6-1", name: "Switch", value: "Gateron Yellow", price: 890000, originalPrice: 1100000, stock: 5, sku: "TC-KB-YEL" },
    ],
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80",
    badge: "Mall",
  },
  {
    id: "prod-7",
    shop: "Mori Studio",
    shopVerified: true,
    category: "men",
    categoryName: "Thời trang Nam",
    name: "Quần âu ống suông sợi tự nhiên Minimalist",
    description: "Vải đũi cao cấp không nhăn, form đứng dáng thời thượng, lưng chun co giãn nhẹ phía sau.",
    rating: 4.9,
    reviewsCount: 115,
    soldCount: "940",
    discountPercent: 15,
    variants: [
      { id: "v7-1", name: "Size", value: "Xám Tro / Size 31", price: 340000, originalPrice: 400000, stock: 22, sku: "MORI-TROUSER-GR" },
    ],
    image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&q=80",
    badge: "Mall",
  },
  {
    id: "prod-8",
    shop: "An Yên Ceramic",
    shopVerified: true,
    category: "kitchen",
    categoryName: "Bếp & Thưởng trà",
    name: "Bộ chén đĩa gốm men xước thủ công",
    description: "Bộ chén đĩa nung củi truyền thống, chịu nhiệt tốt trong lò vi sóng và máy rửa bát.",
    rating: 4.8,
    reviewsCount: 64,
    soldCount: "410",
    discountPercent: 18,
    variants: [
      { id: "v8-1", name: "Set", value: "Set 4 món cơ bản", price: 310000, originalPrice: 380000, stock: 15, sku: "AY-DISH-SET" },
    ],
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80",
    badge: "Thủ công",
  },
];

export default function Home() {
  const [products] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

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
  ]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((f) => f !== id));
      showToast("Đã xóa khỏi danh sách yêu thích");
    } else {
      setFavorites([...favorites, id]);
      showToast("❤️ Đã thêm vào danh sách yêu thích");
    }
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const exist = prev.find((item) => item.productId === product.id);
      if (exist) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: "ci-" + Date.now(),
          productId: product.id,
          variantId: product.variants[0].id,
          shopName: product.shop,
          productName: product.name,
          variantName: product.variants[0].value,
          price: product.variants[0].price,
          quantity: 1,
          image: product.image,
          isSelected: true,
        },
      ];
    });
    showToast(`Đã thêm "${product.name}" vào giỏ hàng`);
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shop.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const CAMPAIGN_BANNERS = [
    {
      title: "Đại Tiệc Mua Sắm Mùa Xuân 2026",
      subtitle: "Hàng ngàn deal hàng hiệu chính hãng giảm tới 50%",
      tag: "⚡ SIÊU SALE SÀN TMĐT",
      bg: "from-[#FFF0F6] via-[#FAF6F8] to-[#FFE6F0]",
      linkText: "Khám phá deal sốc",
      img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=85",
    },
    {
      title: "Lễ Hội Gốm Sứ & Không Gian Wabi-Sabi",
      subtitle: "Tác phẩm thủ công độc bản từ 50+ nghệ nhân Việt Nam",
      tag: "🏺 TRIỂN LÃM GỐM SỨ",
      bg: "from-[#F7F2EF] via-[#FAF6F8] to-[#EFE7E1]",
      linkText: "Xem gian hàng gốm",
      img: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=85",
    },
    {
      title: "Góc Làm Việc Retro & Thiết Bị Tinh Tế",
      subtitle: "Bảo hành 24 tháng 1-đổi-1 cho bàn phím & phụ kiện",
      tag: "💻 RETRO WORKSPACE",
      bg: "from-[#EEF2F6] via-[#FAF6F8] to-[#E2E8F0]",
      linkText: "Nâng cấp góc bàn",
      img: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=85",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBF8F9] text-[#221C1F] pb-32">
      {/* 1. TOP ANNOUNCEMENT BANNER */}
      <div className="bg-[#FFF0F6] text-[#221C1F] text-xs py-2 px-4 text-center font-medium border-b border-[#FFD1E3] flex items-center justify-center gap-2">
        <span className="bg-[#FF7AAC] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
          ƯU ĐÃI SÀN
        </span>
        <span>
          Nhập mã <strong className="text-[#FF7AAC] font-bold">SPRING2026</strong> giảm ngay 50.000₫ cho mọi đơn hàng từ 200.000₫
        </span>
      </div>

      {/* 2. HEADER */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#221C1F]">
              Mori<span className="text-[#FF7AAC]">.</span>
            </Link>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-xl relative">
            <Search className="w-4 h-4 text-[#82757B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm sản phẩm, shop, danh mục trên Mori..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#F2E8EC] bg-[#FAF6F8] text-xs text-[#221C1F] placeholder:text-[#82757B] focus:border-[#FF7AAC] outline-hidden transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/seller"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#7E7077] hover:text-[#FF7AAC] hover:bg-[#FFF0F6] transition-colors"
            >
              <Store className="w-4 h-4" /> Kênh Người Bán
            </Link>

            <Link
              href="/orders"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#7E7077] hover:text-[#221C1F] hover:bg-[#FAF6F8] transition-colors"
            >
              <Package className="w-4 h-4" /> Đơn Mua
            </Link>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-[#FAF6F8] border border-[#F2E8EC] text-[#221C1F] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] hover:border-[#FFD1E3] transition-colors cursor-pointer"
              title="Giỏ hàng"
            >
              <ShoppingBag className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FF7AAC] text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-10">
        {/* HERO BANNER SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-8 rounded-3xl p-6 sm:p-10 bg-gradient-to-br ${CAMPAIGN_BANNERS[activeBannerIdx].bg} border border-[#F0E6EA] relative overflow-hidden flex flex-col justify-between min-h-[280px]`}>
            <div className="space-y-3 z-10 max-w-lg">
              <span className="inline-flex items-center gap-1.5 bg-[#FF7AAC] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {CAMPAIGN_BANNERS[activeBannerIdx].tag}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#221C1F] leading-tight">
                {CAMPAIGN_BANNERS[activeBannerIdx].title}
              </h1>
              <p className="text-xs sm:text-sm text-[#665B60]">
                {CAMPAIGN_BANNERS[activeBannerIdx].subtitle}
              </p>
            </div>

            <div className="flex items-center justify-between z-10 pt-6">
              <button
                onClick={() => showToast("Đang mở trang chiến dịch khuyến mãi...")}
                className="btn-matte-primary text-xs"
              >
                {CAMPAIGN_BANNERS[activeBannerIdx].linkText} <ArrowUpRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {CAMPAIGN_BANNERS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveBannerIdx(i)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      activeBannerIdx === i ? "w-6 bg-[#FF7AAC]" : "w-2 bg-black/20"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-25 pointer-events-none overflow-hidden">
              <Image
                src={CAMPAIGN_BANNERS[activeBannerIdx].img}
                alt=""
                fill
                className="object-cover object-center"
              />
            </div>
          </div>

          {/* Quick Hub Bento */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="matte-card p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF7AAC]">
                  <Flame className="w-4 h-4 fill-[#FF7AAC]" /> Flash Sale Hôm Nay
                </div>
                <h3 className="text-sm font-bold text-[#221C1F]">Giảm tới 50% Giờ Vàng</h3>
                <span className="text-[11px] text-[#82757B]">12 deal đang mở bán</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] flex items-center justify-center shrink-0">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            <div className="matte-card p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#10B981]">
                  <Tag className="w-4 h-4 text-[#10B981]" /> Mã Voucher Toàn Sàn
                </div>
                <h3 className="text-sm font-bold text-[#221C1F]">Mã SPRING2026</h3>
                <span className="text-[11px] text-[#82757B]">Giảm 50K cho đơn từ 200K</span>
              </div>
              <button
                onClick={() => showToast("Đã sao chép mã SPRING2026!")}
                className="p-2.5 rounded-xl bg-emerald-50 text-[#10B981] hover:bg-[#10B981] hover:text-white transition-colors cursor-pointer border border-emerald-200"
                title="Sao chép mã"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* 4. 8 CATEGORY CARDS (ĐỒNG BỘ MÀU CHỮ, KHÔNG BỊ TRÙNG MÀU) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#221C1F]">Danh mục sản phẩm</h2>
            <span className="text-xs font-medium text-[#82757B]">Khám phá 1.200+ mặt hàng</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#FF7AAC] text-white border-[#FF7AAC] shadow-md shadow-[#FF7AAC]/25"
                      : "bg-white text-[#221C1F] border-[#F0E6EA] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] hover:border-[#FFD1E3]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                    isSelected ? "bg-white/20 text-white" : "bg-[#FAF6F8] text-[#221C1F]"
                  }`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-bold truncate w-full ${isSelected ? "text-white" : "text-[#221C1F]"}`}>
                    {cat.name}
                  </span>
                  <span className={`text-[10px] mt-0.5 ${isSelected ? "text-white/80" : "text-[#82757B]"}`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. GIAN HÀNG CHÍNH HÃNG MORI MALL */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#221C1F]">Gian hàng thương hiệu</h2>
              <p className="text-xs text-[#82757B]">100% chính hãng • Miễn phí đổi trả 15 ngày</p>
            </div>
            <Link href="/seller" className="text-xs font-semibold text-[#FF7AAC] hover:underline flex items-center gap-1">
              Xem tất cả shop <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {OFFICIAL_STORES.map((store) => (
              <div key={store.id} className="matte-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-[#F0E6EA] bg-[#FAF6F8] shrink-0">
                    <Image src={store.logoImg} alt={store.shopName} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <h3 className="text-xs font-bold text-[#221C1F] truncate">{store.shopName}</h3>
                      <span className="bg-[#FFF0F6] text-[#FF7AAC] text-[9px] font-bold px-1.5 py-0.2 rounded border border-[#FFD1E3]">Mall</span>
                    </div>
                    <p className="text-[11px] text-[#82757B] truncate">{store.tagline}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F0E6EA]">
                  {store.previewProducts.map((p, idx) => (
                    <div key={idx} className="bg-[#FAF6F8] rounded-xl p-2 border border-[#F0E6EA]/50 space-y-1">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-white">
                        <Image src={p.img} alt={p.name} fill className="object-cover" />
                      </div>
                      <span className="text-[10px] font-bold text-[#FF7AAC] block tabular-nums">{fmtPrice(p.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. PRODUCT GRID SÀN TMĐT */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#F0E6EA] pb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#221C1F]">Sản phẩm nổi bật</h2>
              <p className="text-xs text-[#82757B]">Hiển thị {filteredProducts.length} sản phẩm theo danh mục</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredProducts.map((p) => (
              <div key={p.id} className="matte-card flex flex-col group">
                <div className="relative aspect-[4/5] bg-[#FAF6F8] overflow-hidden">
                  <Image src={p.image} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  
                  <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-xs text-[#221C1F] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#F0E6EA]">
                    {p.badge}
                  </span>

                  <button
                    onClick={(e) => toggleFavorite(p.id, e)}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#82757B] hover:text-[#FF7AAC] transition-colors cursor-pointer"
                  >
                    <Heart className={`w-4 h-4 ${favorites.includes(p.id) ? "fill-[#FF7AAC] text-[#FF7AAC]" : ""}`} />
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[10px] font-semibold text-[#82757B] uppercase">{p.shop}</div>
                    <Link href={`/products/${p.id}`} className="text-xs sm:text-sm font-bold text-[#221C1F] line-clamp-2 hover:text-[#FF7AAC] transition-colors mt-0.5">
                      {p.name}
                    </Link>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-base font-bold text-[#FF7AAC] tabular-nums">
                        {fmtPrice(p.variants[0].price)}
                      </span>
                      {p.variants[0].originalPrice && (
                        <span className="text-[11px] text-[#82757B] line-through ml-1.5 tabular-nums">
                          {fmtPrice(p.variants[0].originalPrice)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#82757B]">Đã bán {p.soldCount}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href={`/products/${p.id}`}
                      className="btn-matte-secondary w-full py-2 text-xs font-semibold rounded-xl text-center"
                    >
                      Chi tiết
                    </Link>
                    <button
                      onClick={() => handleAddToCart(p)}
                      className="btn-matte-primary w-full py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm giỏ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 7. CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setIsCartOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#F0E6EA]">
                <h3 className="text-sm font-bold text-[#221C1F]">Giỏ hàng của bạn ({cart.length})</h3>
                <button onClick={() => setIsCartOpen(false)} className="p-1 rounded-lg hover:bg-[#FAF6F8] text-[#82757B]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-3 overflow-y-auto max-h-[60vh]">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF6F8] border border-[#F0E6EA]">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white shrink-0 border border-[#F0E6EA]">
                      <Image src={item.image} alt="" fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-[#221C1F] truncate">{item.productName}</h4>
                      <p className="text-[10px] text-[#82757B]">{item.variantName} x {item.quantity}</p>
                      <span className="text-xs font-bold text-[#FF7AAC] tabular-nums">{fmtPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0E6EA] space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-[#82757B]">Tạm tính:</span>
                <strong className="text-base font-bold text-[#FF7AAC] tabular-nums">{fmtPrice(subtotal)}</strong>
              </div>
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="btn-matte-primary w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              >
                <span>Tiến hành thanh toán</span> <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 8. FLOATING TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#221C1F] text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-white/10 text-xs font-medium">
          <Sparkles className="w-4 h-4 text-[#FF7AAC]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
