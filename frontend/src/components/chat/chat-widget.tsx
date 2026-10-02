"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireChatConversation, WireChatMessage } from "@/lib/api/chat.api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export interface ChatProductContext {
  productId: string;
  shopId: string;
  shopName?: string;
  productName: string;
  price?: number | string;
  imageUrl?: string | null;
  totalStock?: number;
}

interface ChatWidgetProps {
  productContext: ChatProductContext | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatWidget({ productContext, isOpen, onClose }: ChatWidgetProps) {
  const [conversation, setConversation] = useState<WireChatConversation | null>(null);
  const [messages, setMessages] = useState<WireChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isHandoffLoading, setIsHandoffLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!isOpen || !productContext) return;

    let ignore = false;
    Promise.resolve().then(() => {
      if (ignore) return;
      setIsLoading(true);
      return repositories
        .chat()
        .createOrGetConversation(productContext.shopId, productContext.productId)
        .then((conv) => {
          if (ignore) return;
          setConversation(conv);
          return repositories.chat().getMessages(conv.conversation_id);
        })
        .then((msgs) => {
          if (ignore || !msgs) return;
          setMessages(msgs);
          setIsLoading(false);
        })
        .catch((err) => {
          if (ignore) return;
          console.error("Failed to load chat conversation", err);
          setIsLoading(false);
        });
    });

    return () => {
      ignore = true;
    };
  }, [isOpen, productContext]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time synchronization: định kỳ polling 4s để cập nhật tin nhắn mới từ Người bán
  useEffect(() => {
    if (!isOpen || !conversation?.conversation_id) return;

    const interval = setInterval(() => {
      repositories
        .chat()
        .getMessages(conversation.conversation_id)
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
  }, [isOpen, conversation?.conversation_id]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !conversation || isSending) return;

    setInputText("");
    setIsSending(true);

    try {
      const res = await repositories.chat().sendMessage(conversation.conversation_id, {
        content: text,
        product_id: productContext?.productId,
      });

      setMessages((prev) => {
        const next = [...prev, res.userMessage];
        if (res.botResponse) {
          next.push(res.botResponse);
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to send chat message", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleHandoff = async () => {
    if (!conversation || isHandoffLoading) return;
    setIsHandoffLoading(true);

    try {
      const res = await repositories.chat().requestHandoff(conversation.conversation_id);
      setConversation(res.conversation);
      setMessages((prev) => [...prev, res.systemMessage]);
    } catch (err) {
      console.error("Failed to request human handoff", err);
    } finally {
      setIsHandoffLoading(false);
    }
  };

  if (!isOpen) return null;

  const quickQuestions = [
    "Sản phẩm này còn hàng không shop?",
    "Cho mình hỏi bảng giá các phân loại",
    "Chất liệu của sản phẩm là gì?",
    "Chính sách bảo hành đổi trả thế nào?",
  ];

  return (
    <div
      role="dialog"
      aria-label="Cửa sổ chat với Shop"
      className="fixed bottom-4 right-4 z-50 flex h-[580px] w-[390px] max-w-[calc(100vw-32px)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--primary)] px-4 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white font-bold">
            <Icon name="chat" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight truncate max-w-[190px]">
              {productContext?.shopName || conversation?.shop_name || "Dino Shop"}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-white/90">
              <span
                className={`h-2 w-2 rounded-full ${
                  conversation?.mode === "LIVE_AGENT" ? "bg-emerald-400" : "bg-sky-300 animate-pulse"
                }`}
              />
              <span>
                {conversation?.mode === "LIVE_AGENT" ? "Đang chat với Người Bán" : "Trợ lý AI Sản Phẩm"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {conversation?.mode === "BOT_ASSISTANT" && (
            <button
              type="button"
              onClick={handleHandoff}
              disabled={isHandoffLoading}
              className="rounded-lg bg-white/15 hover:bg-white/25 px-2 py-1 text-[11px] font-semibold text-white transition-colors"
              title="Gặp người bán trực tiếp"
            >
              {isHandoffLoading ? "Đang gọi..." : "Gặp Shop"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            aria-label="Đóng chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Pinned Product Card (Context Scoping) */}
      {productContext && (
        <div className="border-b border-[var(--border)] bg-[var(--card-muted)] p-2.5">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
              {productContext.imageUrl ? (
                <Image
                  src={productContext.imageUrl}
                  alt={productContext.productName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[var(--subtext)]">
                  Ảnh
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--foreground)] truncate">
                {productContext.productName}
              </p>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs font-bold text-[var(--primary)]">
                  {productContext.price ? moneyAdapter.formatVND(Number(productContext.price)) : "Xem chi tiết"}
                </span>
                {typeof productContext.totalStock === "number" && (
                  <span className="text-[11px] text-[var(--subtext)]">
                    Kho: {productContext.totalStock} cái
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--background)]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--subtext)]">
            Đang kết nối phiên chat...
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary)]">
              🤖
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--foreground)]">
                Trợ lý AI của Shop sẵn sàng hỗ trợ!
              </p>
              <p className="text-[11px] text-[var(--subtext)] px-4">
                Hỏi nhanh về tồn kho các phân loại, giá bán hoặc chất liệu sản phẩm.
              </p>
            </div>

            {/* Quick Chips */}
            <div className="flex flex-col gap-1.5 px-2">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left text-xs text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--card-muted)] transition-all shadow-sm"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isBuyer = msg.sender_role === "BUYER";
            const isBot = msg.sender_role === "BOT";
            const isSystem = msg.message_type === "HANDOFF_REQUEST" || msg.message_type === "SYSTEM";

            if (isSystem) {
              return (
                <div key={msg.message_id} className="my-2 flex justify-center">
                  <div className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20 text-center">
                    🔔 {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.message_id}
                className={`flex flex-col ${isBuyer ? "items-end" : "items-start"}`}
              >
                {/* Sender Tag */}
                <div className="flex items-center gap-1 mb-1 text-[10px] text-[var(--subtext)]">
                  {isBot ? (
                    <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 font-bold text-sky-600 dark:text-sky-400">
                      🤖 Trả lời tự động từ Bot
                    </span>
                  ) : isBuyer ? (
                    <span>Bạn</span>
                  ) : (
                    <span className="font-bold text-[var(--foreground)]">Shop (Người thật)</span>
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm whitespace-pre-line ${
                    isBuyer
                      ? "bg-[var(--primary)] text-white rounded-br-none"
                      : isBot
                      ? "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-bl-none"
                      : "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 text-[var(--foreground)] rounded-bl-none"
                  }`}
                >
                  {msg.content}

                  {/* Inline Action for Bot Handoff */}
                  {isBot && msg.metadata?.suggest_handoff && conversation?.mode === "BOT_ASSISTANT" && (
                    <div className="mt-2.5 pt-2 border-t border-[var(--border)]">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleHandoff}
                        disabled={isHandoffLoading}
                        className="w-full h-7 text-[11px] font-bold text-[var(--primary)] border-[var(--primary)] hover:bg-[var(--primary-subtle)]"
                      >
                        <Icon name="chat" className="h-3.5 w-3.5 mr-1" />
                        Chuyển sang chat với Người Bán
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] p-2.5"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            conversation?.mode === "LIVE_AGENT"
              ? "Nhắn tin trực tiếp với Shop..."
              : "Hỏi tồn kho, giá bán, chất liệu..."
          }
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--subtext)] focus:border-[var(--primary)] focus:outline-none"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!inputText.trim() || isSending}
          className="h-8 px-3 text-xs font-bold shrink-0"
        >
          {isSending ? "..." : "Gửi"}
        </Button>
      </form>
    </div>
  );
}
