import Image from "next/image";
import Link from "next/link";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { ShoppingBag, ArrowRight, ShieldCheck, Truck, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let products = [];
  try {
    products = await repositories.catalog().getProducts();
  } catch {
    // Graceful fallback when backend runtime is offline during static build
    products = [
      {
        id: "prod_01",
        name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
        slug: "serum-duong-trang-cap-am",
        description: "Chiết xuất thiên nhiên dưỡng da sáng hồng rạng rỡ.",
        base_price: "280000.00",
        original_price: "350000.00",
        category_id: "cat_beauty",
        shop_id: "shop_01",
        status: "PUBLISHED" as const,
        media: [{ id: "m1", url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800", is_primary: true }],
      },
    ];
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Notification / Value Proposition Bar */}
      <div className="bg-[var(--primary-active)] text-white text-xs py-2 px-4 text-center font-medium">
        🎉 Chào mừng đến với E-Commerce Platform — Miễn phí vận chuyển cho đơn hàng đầu tiên!
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[var(--card)]/90 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white shadow-sm font-bold">
              EC
            </div>
            <span className="font-bold text-xl tracking-tight text-[var(--foreground)]">
              E-Commerce
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--subtext)]">
            <Link href="/" className="text-[var(--foreground)] transition-colors">Trang chủ</Link>
            <Link href="/products" className="hover:text-[var(--foreground)] transition-colors">Sản phẩm</Link>
            <Link href="/seller" className="hover:text-[var(--foreground)] transition-colors">Kênh Người Bán</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="p-2 rounded-lg text-[var(--subtext)] hover:text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5" />
            </Link>

            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-xl text-[var(--subtext)] hover:text-[var(--foreground)] transition-colors"
            >
              Đăng nhập
            </Link>

            <Link
              href="/register"
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] hover:opacity-95 transition-opacity shadow-sm"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 bg-gradient-to-b from-[var(--primary-surface)] to-[var(--background)]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--primary-border)] text-[var(--primary-active)] mb-6">
            ✨ Nền Tảng Thương Mại Điện Tử Thế Hệ Mới
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[var(--foreground)] max-w-3xl mx-auto leading-tight">
            Khám phá hàng ngàn sản phẩm chất lượng cao
          </h1>
          <p className="mt-4 text-base md:text-lg text-[var(--subtext)] max-w-2xl mx-auto">
            Mua sắm trực tiếp từ các nhà bán uy tín, thanh toán bảo mật và giao hàng nhanh chóng trên toàn quốc.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] font-semibold shadow-md hover:opacity-95 transition-all"
            >
              Mua sắm ngay
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/seller"
              className="px-6 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-semibold hover:bg-[var(--card-muted)] transition-colors"
            >
              Đăng ký bán hàng
            </Link>
          </div>
        </div>
      </section>

      {/* Value Badges */}
      <section className="border-y border-[var(--border)] bg-[var(--card)] py-6">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary-surface)] text-[var(--primary-active)] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">100% Chính Hãng</h3>
              <p className="text-xs text-[var(--subtext)]">Cam kết hoàn tiền 200% nếu hàng giả</p>
            </div>
          </div>
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary-surface)] text-[var(--primary-active)] flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Giao Hàng Siêu Tốc</h3>
              <p className="text-xs text-[var(--subtext)]">Nhận hàng trong 24h nội thành</p>
            </div>
          </div>
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary-surface)] text-[var(--primary-active)] flex items-center justify-center shrink-0">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Đổi Trả Dễ Dàng</h3>
              <p className="text-xs text-[var(--subtext)]">7 ngày đổi trả miễn phí tận nhà</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Grid */}
      <section className="py-12 max-w-7xl mx-auto px-4 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Sản Phẩm Nổi Bật</h2>
            <p className="text-sm text-[var(--subtext)]">Lựa chọn hàng đầu được người dùng yêu thích</p>
          </div>
          <Link href="/products" className="text-sm font-semibold text-[var(--primary-active)] hover:underline flex items-center gap-1">
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const primaryImg = product.media?.find((m) => m.is_primary)?.url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";
            return (
              <div
                key={product.id}
                className="group rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden hover:shadow-md transition-all flex flex-col"
              >
                <div className="aspect-square bg-[var(--card-muted)] relative overflow-hidden">
                  <Image
                    src={primaryImg}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {product.original_price && (
                    <span className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-bold bg-[var(--danger)] text-white">
                      Giảm giá
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-medium text-sm text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--primary-active)] transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-[var(--subtext)] mt-1 line-clamp-1">
                      {product.description || "Sản phẩm chất lượng cao"}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold text-[var(--primary-active)]">
                        {moneyAdapter.formatVND(product.base_price)}
                      </span>
                      {product.original_price && (
                        <span className="text-xs text-[var(--subtext)] line-through ml-2">
                          {moneyAdapter.formatVND(product.original_price)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--card)] py-8 mt-12 text-center text-xs text-[var(--subtext)]">
        <p>© 2026 E-Commerce Platform. Nền tảng xây dựng phục vụ đồ án đa kênh.</p>
      </footer>
    </div>
  );
}
