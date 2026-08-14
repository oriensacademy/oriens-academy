"use client";

import { useEffect, useRef } from "react";
import { LogOut, X } from "lucide-react";
import { Wave } from "@/components/ui/wave";

interface LogoutConfirmationModalProps {
  open: boolean;
  signingOut: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmationModal({ open, signingOut, onCancel, onConfirm }: LogoutConfirmationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const signingOutRef = useRef(signingOut);
  signingOutRef.current = signingOut;

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !signingOutRef.current) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#10271B]/35 backdrop-blur-xs"
        aria-label="Çıkış penceresini kapat"
        onClick={signingOut ? undefined : onCancel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={signingOut}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-[#667085] transition-colors duration-200 hover:bg-[#F2F5EF] hover:text-[#10271B] disabled:opacity-50"
          aria-label="Kapat"
        >
          <X className="size-4" />
        </button>
        <div className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700">
          <LogOut className="size-5" />
        </div>
        <h2 id="logout-dialog-title" className="mt-4 text-lg font-semibold text-[#172033]">
          Çıkış yapmak istiyor musunuz?
        </h2>
        <p id="logout-dialog-description" className="mt-2 text-sm leading-6 text-[#667085]">
          Yönetim panelindeki oturumunuz sonlandırılacaktır.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={signingOut}
            className="rounded-xl border border-[#D6DED5] bg-white px-4 py-2 text-sm font-semibold text-[#10271B] transition-colors duration-200 hover:bg-[#F2F5EF] disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={signingOut}
            className="inline-flex min-w-24 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signingOut ? <Wave className="h-4 w-8 text-white" aria-label="Çıkış yapılıyor" /> : "Çıkış Yap"}
          </button>
        </div>
      </div>
    </div>
  );
}
