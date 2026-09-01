"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LogOut, X } from "lucide-react";
import { Wave } from "@/components/ui/wave";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";

export interface LogoutConfirmationModalProps {
  open: boolean;
  signingOut: boolean;
  locale?: "tr" | "en";
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function LogoutConfirmationModal({
  open,
  signingOut,
  locale = "tr",
  title,
  description,
  onCancel,
  onConfirm,
  returnFocusRef,
}: LogoutConfirmationModalProps) {
  const isTr = locale === "tr";
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const signingOutRef = useRef(signingOut);
  useEffect(() => {
    signingOutRef.current = signingOut;
  }, [signingOut]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const explicitReturnFocus = returnFocusRef?.current;
    const unlockBodyScroll = lockBodyScroll();
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
      unlockBodyScroll();
      const focusTarget = explicitReturnFocus || previouslyFocusedRef.current;
      if (focusTarget?.isConnected) focusTarget.focus();
    };
  }, [open, onCancel, returnFocusRef]);

  if (!open || typeof document === "undefined") return null;

  const defaultTitle = isTr
    ? "Çıkış yapmak istediğinize emin misiniz?"
    : "Are you sure you want to sign out?";

  const defaultDescription = isTr
    ? "Hesabınızdan güvenli bir şekilde çıkış yapacaksınız."
    : "You will be securely signed out of your account.";

  return createPortal(
    <div className="fixed inset-0 z-[140] flex min-h-dvh w-screen items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#10271B]/35 backdrop-blur-xs"
        aria-label={isTr ? "Çıkış penceresini kapat" : "Close sign out dialog"}
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
          aria-label={isTr ? "Kapat" : "Close"}
        >
          <X className="size-4" />
        </button>
        <div className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700">
          <LogOut className="size-5" />
        </div>
        <h2 id="logout-dialog-title" className="mt-4 text-lg font-semibold text-[#172033]">
          {title || defaultTitle}
        </h2>
        <p id="logout-dialog-description" className="mt-2 text-sm leading-6 text-[#667085]">
          {description || defaultDescription}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={signingOut}
            className="rounded-xl border border-[#D6DED5] bg-white px-4 py-2 text-sm font-semibold text-[#10271B] transition-colors duration-200 hover:bg-[#F2F5EF] disabled:opacity-50"
          >
            {isTr ? "Vazgeç" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={signingOut}
            className="inline-flex min-w-24 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signingOut ? (
              <Wave className="h-4 w-8 text-white" aria-label={isTr ? "Çıkış yapılıyor" : "Signing out"} />
            ) : isTr ? (
              "Çıkış Yap"
            ) : (
              "Sign Out"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default LogoutConfirmationModal;
