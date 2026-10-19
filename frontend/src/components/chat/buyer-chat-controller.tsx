"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChatWidget, type ChatProductContext } from "@/components/chat/chat-widget";
import { Icon } from "@/components/ui/icon";
import Image from "next/image";
import { repositories } from "@/lib/repositories/repository-factory";
import type { WireChatConversation } from "@/lib/api/chat.api";

interface BuyerChatContextValue {
  openInbox: (opener?: HTMLElement) => void;
  openProduct: (context: ChatProductContext, opener?: HTMLElement) => void;
}

const BuyerChatContext = createContext<BuyerChatContextValue | null>(null);

export function useBuyerChat() {
  const value = useContext(BuyerChatContext);
  if (!value) throw new Error("useBuyerChat must be used inside BuyerChatController");
  return value;
}

export function BuyerChatController({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"inbox" | "conversation">("inbox");
  const [conversations, setConversations] = useState<WireChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WireChatConversation | null>(null);
  const [productContext, setProductContext] = useState<ChatProductContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(false);
    try {
      const result = await repositories.chat().getConversations();
      setConversations([...result].sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at)));
    } catch {
      setError(true);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const initialLoad = window.setTimeout(() => void loadConversations(false), 0);
    const interval = window.setInterval(() => void loadConversations(false), 10000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [enabled, loadConversations]);

  const openInbox = useCallback((opener?: HTMLElement) => {
    restoreFocusRef.current = opener ?? launcherRef.current;
    setSelectedConversation(null);
    setProductContext(null);
    setView("inbox");
    setIsOpen(true);
    void loadConversations();
  }, [loadConversations]);

  const openProduct = useCallback((context: ChatProductContext, opener?: HTMLElement) => {
    restoreFocusRef.current = opener ?? launcherRef.current;
    setSelectedConversation(null);
    setProductContext(context);
    setView("conversation");
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    restoreFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, isOpen]);

  const unreadCount = conversations.reduce((total, item) => total + (item.unread_count ?? 0), 0);
  const selectedProductContext: ChatProductContext | null = productContext ?? (selectedConversation?.current_product_id
    ? {
        productId: selectedConversation.current_product_id,
        shopId: selectedConversation.shop_id,
        shopName: selectedConversation.shop_name,
        productName: selectedConversation.product_name || "Sản phẩm đang hỏi",
        imageUrl: selectedConversation.product_image,
      }
    : null);

  return (
    <BuyerChatContext.Provider value={{ openInbox, openProduct }}>
      {children}
      {enabled && (
        <>
          <button
            ref={launcherRef}
            type="button"
            aria-label={isOpen ? "Đóng hộp thư chat" : "Mở hộp thư chat"}
            aria-expanded={isOpen}
            onClick={() => isOpen ? close() : openInbox()}
            className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-xl transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] md:bottom-5"
          >
            <Icon name="chat" className="h-6 w-6" />
            {unreadCount > 0 && (
              <span aria-label={`${unreadCount} tin nhắn chưa đọc`} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {isOpen && view === "inbox" && (
            <section role="dialog" aria-label="Hộp thư chat" className="buyer-chat-panel fixed bottom-[calc(154px+env(safe-area-inset-bottom))] right-3 z-[60] flex h-[min(580px,calc(100dvh-170px-env(safe-area-inset-bottom)))] w-[390px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl md:bottom-24 md:right-4 md:h-[580px]">
              <header className="flex items-center justify-between bg-[var(--primary)] px-4 py-3 text-white">
                <h2 className="text-sm font-bold">Tin nhắn của bạn</h2>
                <button type="button" aria-label="Đóng chat" onClick={close} className="rounded-lg p-1.5 hover:bg-white/20">✕</button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
                {isLoading ? (
                  <p className="p-6 text-center text-sm text-[var(--subtext)]">Đang tải hội thoại…</p>
                ) : error ? (
                  <div role="alert" className="space-y-3 p-6 text-center text-sm">
                    <p>Chưa tải được danh sách chat. Vui lòng thử lại.</p>
                    <button type="button" onClick={() => void loadConversations()} className="rounded-lg border border-[var(--border)] px-3 py-2 font-semibold text-[var(--primary)]">Thử lại</button>
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="p-8 text-center text-sm text-[var(--subtext)]">Bạn chưa có cuộc trò chuyện nào.</p>
                ) : conversations.map((item) => (
                  <button
                    key={item.conversation_id}
                    type="button"
                    onClick={() => {
                      setProductContext(null);
                      setSelectedConversation(item);
                      setView("conversation");
                    }}
                    className="flex w-full items-start gap-3 border-b border-[var(--border)] p-3 text-left transition-colors hover:bg-[var(--card-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--primary)]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-subtle)] text-sm font-bold text-[var(--primary)]">
                      {item.product_image ? <Image src={item.product_image} alt="" width={40} height={40} className="h-full w-full object-cover" /> : item.shop_name?.charAt(0) || "S"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-[var(--foreground)]">{item.shop_name || "Shop"}</span>
                        <time className="shrink-0 text-[10px] text-[var(--subtext)]">{new Date(item.last_message_at).toLocaleDateString("vi-VN")}</time>
                      </span>
                      {item.product_name && <span className="mt-0.5 block truncate text-xs font-medium text-[var(--primary)]">{item.product_name}</span>}
                      <span className="mt-0.5 block truncate text-xs text-[var(--subtext)]">{item.last_message || "Chưa có tin nhắn"}</span>
                    </span>
                    {(item.unread_count ?? 0) > 0 && <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{item.unread_count}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {isOpen && view === "conversation" && (
            <ChatWidget
              isOpen
              productContext={selectedProductContext}
              initialConversation={selectedConversation}
              onClose={close}
              onBackToInbox={() => openInbox(launcherRef.current ?? undefined)}
              onRead={() => void loadConversations(false)}
            />
          )}
        </>
      )}
    </BuyerChatContext.Provider>
  );
}
