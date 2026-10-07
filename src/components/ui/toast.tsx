"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import adminToastStyles from "./admin-toast.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  /** milliseconds until auto-dismiss */
  duration: number;
  action?: ToastAction;
}

export interface ToastAction {
  label: string;
  onAction: () => void;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// Bilgi/başarı bildirimleri 2.6 sn (admin kılavuzu). Hata ve uyarılar
// okunabilmeleri için daha uzun kalır.
const DURATIONS: Record<ToastVariant, number> = {
  success: 2600,
  error: 7000,
  warning: 5000,
  info: 2600,
};

// Referans listToast: eylem düğmeli bildirim 6 sn kalır.
const ACTION_DURATION = 6000;
const MAX_TOASTS = 5;
const DEDUP_WINDOW_MS = 1000;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let globalPush: ((message: string, variant?: ToastVariant, action?: ToastAction) => void) | null = null;

export const toast = {
  success: (msg: string) => (globalPush ? globalPush(msg, "success") : console.log("[toast:success]", msg)),
  error: (msg: string) => (globalPush ? globalPush(msg, "error") : console.error("[toast:error]", msg)),
  warning: (msg: string) => (globalPush ? globalPush(msg, "warning") : console.warn("[toast:warning]", msg)),
  info: (msg: string) => (globalPush ? globalPush(msg, "info") : console.info("[toast:info]", msg)),
  /** Eylem düğmeli başarı bildirimi (ör. "Geri al", "Detayı aç"). */
  action: (msg: string, action: ToastAction) => (globalPush ? globalPush(msg, "success", action) : console.log("[toast:action]", msg)),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastRef = useRef<{ message: string; time: number }>({ message: "", time: 0 });

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Yönetim panelinde tek bildirim görünür; süresi dolunca öncekiler de kalkar.
  const dismissThrough = useCallback((id: string) => {
    setToasts((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      return index < 0 ? prev : prev.slice(index + 1);
    });
  }, []);

  const push = useCallback((message: string, variant: ToastVariant = "success", action?: ToastAction) => {
    const now = Date.now();
    // Duplicate prevention: same message within DEDUP_WINDOW_MS
    if (lastRef.current.message === message && now - lastRef.current.time < DEDUP_WINDOW_MS) {
      return;
    }
    lastRef.current = { message, time: now };

    const id = `toast-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = action ? ACTION_DURATION : DURATIONS[variant];

    setToasts((prev) => {
      const next = [...prev, { id, message, variant, createdAt: now, duration, action }];
      // Keep only the latest MAX_TOASTS
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });
  }, []);

  useEffect(() => {
    globalPush = push;
    return () => {
      if (globalPush === push) globalPush = null;
    };
  }, [push]);

  const ctx: ToastContextValue = {
    toast: push,
    success: useCallback((msg: string) => push(msg, "success"), [push]),
    error: useCallback((msg: string) => push(msg, "error"), [push]),
    warning: useCallback((msg: string) => push(msg, "warning"), [push]),
    info: useCallback((msg: string) => push(msg, "info"), [push]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} onDismissThrough={dismissThrough} />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Container (portalled to body)
const emptySubscribe = () => () => {};

function ToastContainer({ toasts, onDismiss, onDismissThrough }: { toasts: ToastItem[]; onDismiss: (id: string) => void; onDismissThrough: (id: string) => void }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const pathname = usePathname();

  if (!mounted || typeof document === "undefined" || !toasts.length) return null;

  // Yönetim paneli: referanstaki tek, alt-orta bildirim (son gelen gösterilir).
  if (pathname?.startsWith("/admin")) {
    const last = toasts[toasts.length - 1];
    return createPortal(<AdminToast key={last.id} toast={last} onDismiss={onDismissThrough} />, document.body);
  }

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[200] flex flex-col-reverse items-end gap-2.5 pointer-events-none max-w-[min(420px,calc(100vw-2rem))]"
      style={{ zIndex: 200 }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Individual Toast Card
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<ToastVariant, { border: string; bg: string; text: string; icon: string }> = {
  success: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900", icon: "text-emerald-700" },
  error: { border: "border-red-200", bg: "bg-red-50", text: "text-red-900", icon: "text-red-700" },
  warning: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900", icon: "text-amber-700" },
  info: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-900", icon: "text-blue-700" },
};

const VARIANT_ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, toast.duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onDismiss]);

  const handleClose = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const s = VARIANT_STYLES[toast.variant];
  const Icon = VARIANT_ICONS[toast.variant];

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border ${s.border} ${s.bg} p-3.5 shadow-lg backdrop-blur-sm transition-all duration-200 ${
        exiting ? "translate-x-full opacity-0" : "animate-in slide-in-from-right-5 fade-in duration-200"
      }`}
      style={{ maxWidth: "100%" }}
    >
      <Icon className={`size-4 shrink-0 mt-0.5 ${s.icon}`} />
      <p className={`flex-1 text-xs font-medium leading-relaxed ${s.text}`}>{toast.message}</p>
      <button
        type="button"
        onClick={handleClose}
        className={`shrink-0 rounded-lg p-0.5 ${s.text} opacity-60 hover:opacity-100 transition-opacity cursor-pointer`}
        aria-label="Kapat"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// Referans: oriens-admin.js listToast — #10271B zemin, altın ikon, 2.6 sn.
// Hata/uyarı metinleri okunabilsin diye süreleri DURATIONS'tan gelir.
function AdminToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [shown, setShown] = useState(false);
  const usedRef = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const hide = setTimeout(() => setShown(false), toast.duration);
    const remove = setTimeout(() => onDismiss(toast.id), toast.duration + 200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [toast.id, toast.duration, onDismiss]);

  // Eylem bir kez çalışır; tıklanınca bildirim hemen kapanır.
  const runAction = () => {
    if (usedRef.current || !toast.action) return;
    usedRef.current = true;
    setShown(false);
    onDismiss(toast.id);
    toast.action.onAction();
  };

  const failed = toast.variant === "error" || toast.variant === "warning";
  return (
    <div className={`${adminToastStyles.toast}${shown ? ` ${adminToastStyles.show}` : ""}${toast.action ? ` ${adminToastStyles.hasAct}` : ""}`} role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"} id="toast">
      {failed ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
      )}
      <span>{toast.message}</span>
      {toast.action ? <button type="button" className={adminToastStyles.act} onClick={runAction}>{toast.action.label}</button> : null}
    </div>
  );
}
