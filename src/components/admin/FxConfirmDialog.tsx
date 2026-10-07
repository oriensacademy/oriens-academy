"use client";

import { useEffect, useRef } from "react";
import pages from "./admin-pages.module.css";

// Referans fxConfirm (#fx-confirm): silme / arşivleme gibi geri dönüşü zor
// işlemler için onay penceresi. Bileşen açıkken gösterilir; kapanınca onClose.
export function FxConfirmDialog({ title, sub, text, ok, busy, tone = "danger", onConfirm, onClose }: {
  title: string;
  sub: string;
  text: string;
  ok: string;
  busy?: boolean;
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog ref={dialogRef} className="arc" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <div className="m-modal" role="alertdialog" aria-modal="true" aria-labelledby="fxc-title-local">
          <div className="m-head">
            <div className="m-hicon" style={tone === "danger" ? { background: "#FBECEA", color: "#9A3324" } : undefined}>
              {tone === "danger" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="fxc-title-local" className="m-htitle">{title}</h2>
              <span className="m-hsub">{sub}</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" disabled={busy} onClick={() => dialogRef.current?.close()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="m-body"><p>{text}</p></div>
          <div className="m-foot">
            <button type="button" className="m-cancel" disabled={busy} onClick={() => dialogRef.current?.close()}>Vazgeç</button>
            <button type="button" className={tone === "danger" ? "m-delok" : "m-save"} disabled={busy} onClick={onConfirm}>{busy ? "İşleniyor…" : ok}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
