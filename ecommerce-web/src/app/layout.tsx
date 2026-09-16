import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shopee Minimal - Sàn Thương Mại Điện Tử Tối Giản",
  description: "Nền tảng thương mại điện tử đa người bán phong cách tối giản, nhẹ nhàng và cuốn hút",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-[#FAF8F5] text-stone-800 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
