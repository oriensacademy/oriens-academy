"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Wave } from "@/components/ui/wave";

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Sil",
  cancelLabel = "İptal",
  loading = false,
  destructive = true,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        event.preventDefault();
        onCancel();
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [loading, onCancel, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button type="button" aria-label="Onay penceresini kapat" className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-xs" onClick={loading ? undefined : onCancel} />
      <div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl">
        <button type="button" aria-label="Kapat" onClick={onCancel} disabled={loading} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-ink disabled:opacity-50"><X className="size-4" /></button>
        <div className={destructive ? "flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700" : "flex size-10 items-center justify-center rounded-full bg-amber-50 text-amber-700"}><AlertTriangle className="size-5" /></div>
        <h2 id={titleId} className="mt-4 pr-8 text-lg font-semibold text-ink">{title}</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={loading} className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-muted disabled:opacity-50">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={loading} className={destructive ? "inline-flex min-w-24 items-center justify-center rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60" : "inline-flex min-w-24 items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-forest disabled:opacity-60"}>{loading ? <Wave className="h-4 w-8 text-white" aria-label="İşlem sürüyor" /> : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
