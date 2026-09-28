"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./icon";

type ToastKind = "success" | "error" | "info";
type ToastMessage = { id: number; title?: string; message: string; kind: ToastKind };
type ToastContextValue = { showToast: (message: string, kind?: ToastKind, title?: string) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([]);
  const showToast = useCallback((message: string, kind: ToastKind = "info", title?: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, message, kind, title }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-label="Thông báo" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div className={`toast toast--${item.kind}`} key={item.id} role={item.kind === "error" ? "alert" : "status"} aria-live={item.kind === "error" ? "assertive" : "polite"}>
            <Icon name={item.kind === "success" ? "check" : item.kind === "error" ? "warning" : "info"} />
            <div className="toast__message">{item.title && <span className="toast__title">{item.title}</span>}{item.message}</div>
            <button className="icon-button" type="button" aria-label="Đóng thông báo" onClick={() => setItems((current) => current.filter((toast) => toast.id !== item.id))}>
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context.showToast;
}
