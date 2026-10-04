"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { repositories } from "@/lib/repositories/repository-factory";
import type { ProductBotPermissions, WireChatConversation, WireChatMessage } from "@/lib/api/chat.api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { SellerHeaderNav } from "./seller-header-nav";

export function SellerChatInboxScreen() {
  const showToast = useToast();
  const [conversations, setConversations] = useState<WireChatConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<WireChatConversation | null>(null);
  const [messages, setMessages] = useState<WireChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isShopOnline, setIsShopOnline] = useState(true);
  const [permissions, setPermissions] = useState<ProductBotPermissions>({
    allow_stock: true,
    allow_price: true,
    allow_variants: true,
    allow_description: true,
  });
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const selectConversation = useCallback((conv: WireChatConversation) => {
    setSelectedConv(conv);
    setPermissions(conv.bot_permissions || {
      allow_stock: true,
      allow_price: true,
      allow_variants: true,
      allow_description: true,
    });

    repositories
      .chat()
      .getMessages(conv.conversation_id)
      .then((msgs) => {
        setMessages(msgs);
      })
      .catch((err) => {
        console.error("Failed to load messages", err);
      });

    if (conv.shop_id && repositories.chat().getShopPresence) {
      repositories
        .chat()
        .getShopPresence!(conv.shop_id)
        .then((res) => {
          setIsShopOnline(res.is_online);
        })
        .catch(() => undefined);
    }
  }, []);

  const loadConversations = useCallback(() => {
    Promise.resolve().then(() => {
      setIsLoading(true);
      return repositories
        .chat()
        .getConversations()
        .then((data) => {
          setConversations(data);
          if (data.length > 0) {
            setSelectedConv((current) => {
              if (!current) {
                selectConversation(data[0]);
                return data[0];
              }
              return current;
            });
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load conversations", err);
          setIsLoading(false);
        });
    });
  }, [selectConversation]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Real-time synchronization: định kỳ polling 4s để cập nhật tin nhắn mới từ Người mua trong hội thoại hiện tại
  useEffect(() => {
    if (!selectedConv?.conversation_id) return;

    const interval = setInterval(() => {
      repositories
        .chat()
        .getMessages(selectedConv.conversation_id)
        .then((latest) => {
          if (latest && latest.length > 0) {
            setMessages((prev) => {
              if (
                latest.length !== prev.length ||
                latest[latest.length - 1]?.message_id !== prev[prev.length - 1]?.message_id
              ) {
                return latest;
              }
              return prev;
            });
          }
        })
        .catch(() => undefined);
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedConv?.conversation_id]);

  // Real-time synchronization: định kỳ polling 10s để cập nhật danh sách hội thoại mới
  useEffect(() => {
    const interval = setInterval(() => {
      repositories
        .chat()
        .getConversations()
        .then((data) => {
          setConversations(data);
        })
        .catch(() => undefined);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !selectedConv || isSending) return;

    setInputText("");
    setIsSending(true);

    try {
      const res = await repositories.chat().sendMessage(selectedConv.conversation_id, {
        content: text,
      });

      setMessages((prev) => [...prev, res.userMessage]);
      setSelectedConv((prev) => (prev ? { ...prev, mode: "LIVE_AGENT" } : null));
    } catch (err) {
      console.error("Failed to send message", err);
      showToast("Không thể gửi tin nhắn. Vui lòng thử lại.", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedConv) return;
    setIsSavingPerms(true);

    try {
      const updated = await repositories
        .chat()
        .updatePermissions(selectedConv.conversation_id, permissions);

      setSelectedConv(updated);
      setConversations((prev) =>
        prev.map((c) => (c.conversation_id === updated.conversation_id ? updated : c))
      );
      showToast("Cập nhật quyền của Bot thành công", "success");
      setShowConfigModal(false);
    } catch (err) {
      console.error("Failed to update bot permissions", err);
      showToast("Không thể cập nhật quyền bot.", "error");
    } finally {
      setIsSavingPerms(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Sub-navigation tabs across all seller features */}
      <SellerHeaderNav />

      {/* Page Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
            Tin Nhắn Khách Hàng (Live Chat & AI Bot)
          </h1>
          <p className="text-xs text-[var(--subtext)] mt-1">
            Quản lý hội thoại trực tiếp với khách mua và giám sát câu trả lời tự động của Trợ lý AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Shop Online / Offline Toggle */}
          <button
            type="button"
            onClick={async () => {
              const nextState = !isShopOnline;
              setIsShopOnline(nextState);
              if (selectedConv?.shop_id && repositories.chat().setShopPresence) {
                try {
                  await repositories.chat().setShopPresence!(selectedConv.shop_id, nextState);
                } catch (err) {
                  console.error("Failed to update shop presence", err);
                }
              }
              showToast(
                nextState
                  ? "Shop đã chuyển sang trạng thái Trực Tuyến."
                  : "Shop đã chuyển sang trạng thái Tạm Vắng (Offline). Hệ thống sẽ thông báo khách hàng khi cần hỗ trợ.",
                "info"
              );
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isShopOnline
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isShopOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span>{isShopOnline ? "Shop Đang Trực Tuyến" : "Shop Tạm Vắng (Offline)"}</span>
          </button>

          <Button
            type="button"
            variant="secondary"
            onClick={loadConversations}
            className="self-start sm:self-auto text-xs"
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-col md:flex-row h-[680px] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
        {/* Left Pane: Conversations List */}
        <div className="w-full md:w-80 border-r border-[var(--border)] flex flex-col bg-[var(--card-muted)]">
          <div className="p-3 border-b border-[var(--border)]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--subtext)]">
              Danh Sách Hội Thoại ({conversations.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-[var(--subtext)]">
                Đang tải danh sách...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--subtext)] space-y-2">
                <Icon name="chat" className="mx-auto h-8 w-8 opacity-40" />
                <p>Chưa có cuộc trò chuyện nào từ khách hàng.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConv?.conversation_id === conv.conversation_id;
                const isLive = conv.mode === "LIVE_AGENT";

                return (
                  <button
                    key={conv.conversation_id}
                    type="button"
                    onClick={() => selectConversation(conv)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                      isSelected
                        ? "bg-[var(--card)] border-l-4 border-[var(--primary)]"
                        : "hover:bg-[var(--card)]"
                    }`}
                  >
                    <div className="relative h-10 w-10 shrink-0 rounded-full bg-[var(--primary-subtle)] text-[var(--primary)] font-bold flex items-center justify-center text-xs border border-[var(--border)] overflow-hidden">
                      {conv.product_image ? (
                        <Image src={conv.product_image} alt="" fill className="object-cover" />
                      ) : (
                        <span>{conv.buyer_name?.charAt(0) || "K"}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--foreground)] truncate">
                          {conv.buyer_name || "Khách Hàng"}
                        </span>
                        <span className="text-[10px] text-[var(--subtext)]">
                          {new Date(conv.last_message_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {conv.product_name && (
                        <p className="text-[11px] text-[var(--primary)] truncate font-medium mt-0.5">
                          SP: {conv.product_name}
                        </p>
                      )}

                      <p className="text-[11px] text-[var(--subtext)] truncate mt-0.5">
                        {conv.last_message || "Chưa có tin nhắn"}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2">
                        {isLive ? (
                          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Cần Shop trả lời
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                            Bot đang trực
                          </span>
                        )}

                        {conv.unread_count && conv.unread_count > 0 ? (
                          <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                            {conv.unread_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Conversation */}
        <div className="flex-1 flex flex-col bg-[var(--background)]">
          {selectedConv ? (
            <>
              {/* Active Conversation Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--foreground)]">
                      {selectedConv.buyer_name || "Khách Hàng"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--subtext)]">
                      <span>Chế độ:</span>
                      <span
                        className={`font-semibold ${
                          selectedConv.mode === "LIVE_AGENT"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-sky-600 dark:text-sky-400"
                        }`}
                      >
                        {selectedConv.mode === "LIVE_AGENT" ? "Người bán trực tiếp" : "Trợ lý AI"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowConfigModal(true)}
                    className="text-xs h-8"
                  >
                    ⚙️ Quyền của Bot
                  </Button>
                </div>
              </div>

              {/* Pinned Product Preview */}
              {selectedConv.product_name && (
                <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card-muted)] px-4 py-2 text-xs">
                  <span className="font-semibold text-[var(--subtext)]">Khách đang hỏi về:</span>
                  <span className="font-bold text-[var(--foreground)] truncate">
                    {selectedConv.product_name}
                  </span>
                </div>
              )}

              {/* Shop Offline Status Alert Banner */}
              {!isShopOnline && (
                <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <Icon name="bell" className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    <strong>Shop đang vắng mặt (Offline):</strong> Khi người mua yêu cầu hỗ trợ người thật, hệ thống sẽ lưu tin nhắn vào hàng đợi và phản hồi thông báo Shop hiện đang ngoại tuyến.
                  </span>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--subtext)]">
                    Chưa có tin nhắn trong hội thoại này
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSeller = msg.sender_role === "SELLER";
                    const isBot = msg.sender_role === "BOT";
                    const isSystem = msg.message_type === "HANDOFF_REQUEST" || msg.message_type === "SYSTEM";

                    if (isSystem) {
                      return (
                        <div key={msg.message_id} className="my-2 flex justify-center">
                          <div className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            🔔 {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.message_id}
                        className={`flex flex-col ${isSeller ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1 mb-1 text-[10px] text-[var(--subtext)]">
                          {isBot ? (
                            <span className="font-bold text-sky-600 dark:text-sky-400">
                              🤖 Trợ lý AI Shop
                            </span>
                          ) : isSeller ? (
                            <span className="font-bold text-[var(--primary)]">Bạn (Người bán)</span>
                          ) : (
                            <span>{selectedConv.buyer_name || "Khách Hàng"}</span>
                          )}
                          <span>•</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>

                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow-sm ${
                            isSeller
                              ? "bg-[var(--primary)] text-white rounded-br-none"
                              : isBot
                              ? "bg-sky-50 border border-sky-200 dark:bg-sky-950/30 dark:border-sky-800 text-[var(--foreground)] rounded-bl-none"
                              : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-bl-none"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] p-3"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Nhập tin nhắn phản hồi cho khách hàng..."
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--subtext)] focus:border-[var(--primary)] focus:outline-none"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!inputText.trim() || isSending}
                  className="h-8 px-4 text-xs font-bold shrink-0"
                >
                  {isSending ? "Đang gửi..." : "Gửi phản hồi"}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--subtext)]">
              Chọn một cuộc hội thoại từ danh sách bên trái để xem nội dung
            </div>
          )}
        </div>
      </div>

      {/* Bot Permissions Modal */}
      {showConfigModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--foreground)]">
              Cấu hình Quyền Dữ liệu cho Chatbox AI
            </h3>
            <p className="text-xs text-[var(--subtext)] mt-1">
              Chọn các trường thông tin sản phẩm mà bạn cho phép Chatbot biết và tự động trả lời khách:
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--card-muted)]">
                <div>
                  <span className="text-xs font-bold text-[var(--foreground)] block">
                    Số lượng tồn kho (allow_stock)
                  </span>
                  <span className="text-[11px] text-[var(--subtext)]">
                    Cho phép bot báo số lượng tồn kho thực tế của các phân loại
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_stock}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, allow_stock: e.target.checked }))
                  }
                  className="h-4 w-4 rounded accent-[var(--primary)]"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--card-muted)]">
                <div>
                  <span className="text-xs font-bold text-[var(--foreground)] block">
                    Bảng giá sản phẩm (allow_price)
                  </span>
                  <span className="text-[11px] text-[var(--subtext)]">
                    Cho phép bot báo giá niêm yết theo từng biến thể SKU
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_price}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, allow_price: e.target.checked }))
                  }
                  className="h-4 w-4 rounded accent-[var(--primary)]"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--card-muted)]">
                <div>
                  <span className="text-xs font-bold text-[var(--foreground)] block">
                    Danh sách phân loại (allow_variants)
                  </span>
                  <span className="text-[11px] text-[var(--subtext)]">
                    Cho phép bot liệt kê màu sắc, size kích thước có sẵn
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_variants}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, allow_variants: e.target.checked }))
                  }
                  className="h-4 w-4 rounded accent-[var(--primary)]"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--card-muted)]">
                <div>
                  <span className="text-xs font-bold text-[var(--foreground)] block">
                    Mô tả & Công năng (allow_description)
                  </span>
                  <span className="text-[11px] text-[var(--subtext)]">
                    Cho phép bot giải đáp chất liệu, kích thước, xuất xứ từ mô tả
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_description}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, allow_description: e.target.checked }))
                  }
                  className="h-4 w-4 rounded accent-[var(--primary)]"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowConfigModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isSavingPerms}
                onClick={handleSavePermissions}
              >
                {isSavingPerms ? "Đang lưu..." : "Lưu cấu hình"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
