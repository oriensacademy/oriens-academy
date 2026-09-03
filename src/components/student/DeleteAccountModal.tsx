"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Wave } from "@/components/ui/wave";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";
import { deleteOwnAccount } from "@/lib/student/auth";

export interface DeleteAccountModalProps {
  open: boolean;
  locale: "tr" | "en";
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteAccountModal({ open, locale, onClose, onDeleted }: DeleteAccountModalProps) {
  const isTr = locale === "tr";
  const dialogRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function handleClose() {
    if (submitting || done) return;
    setPassword("");
    setError("");
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const unlockBodyScroll = lockBodyScroll();
    passwordInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !done) {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
      const focusTarget = previouslyFocusedRef.current;
      if (focusTarget?.isConnected) focusTarget.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !password) return;
    setSubmitting(true);
    setError("");
    const result = await deleteOwnAccount(password, locale);
    if (!result.success) {
      setSubmitting(false);
      setError(
        result.message ||
          (isTr ? "Üyelik silme işlemi gerçekleştirilemedi." : "Your account could not be deleted.")
      );
      return;
    }
    setDone(true);
    window.setTimeout(() => onDeleted(), 1500);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex min-h-dvh w-screen items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#10271B]/35 backdrop-blur-xs"
        aria-label={isTr ? "Pencereyi kapat" : "Close dialog"}
        onClick={submitting || done ? undefined : handleClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-dialog-title"
        aria-describedby="delete-account-dialog-description"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting || done}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-[#667085] transition-colors duration-200 hover:bg-[#F2F5EF] hover:text-[#10271B] disabled:opacity-50"
          aria-label={isTr ? "Kapat" : "Close"}
        >
          <X className="size-4" />
        </button>
        <div className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700">
          <AlertTriangle className="size-5" />
        </div>

        {done ? (
          <>
            <h2 id="delete-account-dialog-title" className="mt-4 text-lg font-semibold text-[#172033]">
              {isTr ? "Üyeliğiniz silindi." : "Your account has been deleted."}
            </h2>
            <p id="delete-account-dialog-description" className="mt-2 text-sm leading-6 text-[#667085]">
              {isTr ? "Oturumunuz kapatılıyor…" : "Signing you out…"}
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="delete-account-dialog-title" className="mt-4 text-lg font-semibold text-[#172033]">
              {isTr ? "Üyeliğimi Sil" : "Delete My Account"}
            </h2>
            <p id="delete-account-dialog-description" className="mt-2 text-sm leading-6 text-[#667085]">
              {isTr
                ? "Bu işlem geri alınamaz. Devam etmek için mevcut şifrenizi giriniz."
                : "This action cannot be undone. Enter your current password to continue."}
            </p>

            <label className="mt-4 block text-xs font-semibold text-[#172033]">
              {isTr ? "Mevcut Şifre" : "Current Password"}
              <input
                ref={passwordInputRef}
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-60"
              />
            </label>

            {error ? (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-xl border border-[#D6DED5] bg-white px-4 py-2 text-sm font-semibold text-[#10271B] transition-colors duration-200 hover:bg-[#F2F5EF] disabled:opacity-50"
              >
                {isTr ? "Vazgeç" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitting || !password}
                className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <Wave className="h-4 w-8 text-white" aria-label={isTr ? "Siliniyor" : "Deleting"} />
                ) : isTr ? (
                  "Üyeliğimi Kalıcı Olarak Sil"
                ) : (
                  "Permanently Delete My Account"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

export default DeleteAccountModal;
