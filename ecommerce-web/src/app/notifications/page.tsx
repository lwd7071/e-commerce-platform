"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Bell, 
  Package, 
  Tag, 
  ShieldAlert, 
  CheckCheck, 
  ArrowLeft, 
  ChevronRight
} from "lucide-react";

interface NotificationItem {
  id: string;
  type: "ORDER" | "PROMOTION" | "SYSTEM";
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  link?: string;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "ORDER" | "PROMOTION" | "SYSTEM">("ALL");

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      type: "ORDER",
      title: "Đơn hàng đang trên đường giao đến bạn",
      message: "Đơn hàng #DH-2026-004 gồm Áo sơ mi Linen dáng suông đang được vận chuyển bởi ĐVVC Express. Dự kiến giao hôm nay!",
      time: "10 phút trước",
      isRead: false,
      link: "/orders",
    },
    {
      id: "notif-2",
      type: "PROMOTION",
      title: "Tặng bạn Voucher giảm 50.000₫ từ Mori Official",
      message: "Nhập mã SPRING2026 khi thanh toán đơn từ 200.000₫. Hạn sử dụng đến hết ngày 30/09/2026.",
      time: "2 giờ trước",
      isRead: false,
      link: "/cart",
    },
    {
      id: "notif-3",
      type: "ORDER",
      title: "Đơn hàng đã được xác nhận thành công",
      message: "Shop An Yên Ceramic đã xác nhận đơn hàng #DH-2026-002 và đang tiến hành đóng gói sản phẩm.",
      time: "Hôm qua lúc 18:30",
      isRead: true,
      link: "/orders",
    },
    {
      id: "notif-4",
      type: "SYSTEM",
      title: "Nâng cấp giao diện Mori Minimal 2026",
      message: "Hệ thống sàn vừa cập nhật phong cách tối giản thanh lịch, nâng tầm trải nghiệm mua sắm của bạn.",
      time: "3 ngày trước",
      isRead: true,
    },
    {
      id: "notif-5",
      type: "PROMOTION",
      title: "Siêu hội hoàn xu cuối tháng - Hoàn đến 50.000 xu",
      message: "Cơ hội săn deal đồ gốm và thời trang cao cấp với ưu đãi freeship toàn sàn cho đơn từ 0₫.",
      time: "5 ngày trước",
      link: "/",
      isRead: true,
    }
  ]);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? ({ ...n, isRead: true }) : n));
  };

  const filteredNotifs = activeTab === "ALL" 
    ? notifications 
    : notifications.filter(n => n.type === activeTab);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-24 text-[#221C1F]">
      {/* Top Header */}
      <header className="bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl text-[#7E7077] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="text-xl font-bold tracking-tight text-[#221C1F] mr-2">
              Mori<span className="text-[#FF7AAC]">.</span>
            </Link>
            <h1 className="text-xs font-semibold text-[#7E7077] pl-3 border-l border-[#F2E8EC] flex items-center gap-2">
              Thông báo
              {unreadCount > 0 && (
                <span className="bg-[#FF7AAC] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} mới
                </span>
              )}
            </h1>
          </div>

          <button
            onClick={markAllAsRead}
            className="btn-matte-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            Đánh dấu đã đọc
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 scrollbar-none">
          {([
            { key: "ALL", label: `Tất cả (${notifications.length})` },
            { key: "ORDER", label: "Đơn hàng" },
            { key: "PROMOTION", label: "Khuyến mãi & Voucher" },
            { key: "SYSTEM", label: "Hệ thống sàn" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "bg-[#FF7AAC] text-white"
                  : "bg-white text-[#7E7077] border border-[#F2E8EC] hover:bg-[#FFF0F6]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifs.length === 0 ? (
            <div className="matte-card p-12 text-center">
              <Bell className="w-10 h-10 text-[#FF7AAC] mx-auto mb-3 opacity-50" />
              <h3 className="text-sm font-bold text-[#221C1F]">Không có thông báo nào</h3>
              <p className="text-xs text-[#7E7077] mt-1">Các cập nhật quan trọng về đơn hàng và ưu đãi sẽ xuất hiện ở đây.</p>
            </div>
          ) : (
            filteredNotifs.map(n => {
              const getIcon = () => {
                switch (n.type) {
                  case "ORDER":
                    return <Package className="w-5 h-5 text-[#FF7AAC]" />;
                  case "PROMOTION":
                    return <Tag className="w-5 h-5 text-amber-500" />;
                  case "SYSTEM":
                    return <ShieldAlert className="w-5 h-5 text-blue-500" />;
                }
              };

              return (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`matte-card p-4 sm:p-5 flex items-start gap-4 transition-all cursor-pointer ${
                    !n.isRead ? "border-l-4 border-l-[#FF7AAC] bg-white" : "bg-[#FAF6F8]/60"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FFF0F6] border border-[#FFD1E3] flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-xs sm:text-sm font-bold truncate ${!n.isRead ? "text-[#221C1F]" : "text-[#7E7077]"}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-[#7E7077] shrink-0">{n.time}</span>
                    </div>

                    <p className="text-xs text-[#7E7077] mt-1 line-clamp-2">
                      {n.message}
                    </p>

                    {n.link && (
                      <Link
                        href={n.link}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF7AAC] hover:underline mt-2"
                      >
                        Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
