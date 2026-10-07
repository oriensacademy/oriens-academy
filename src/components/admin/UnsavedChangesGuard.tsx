"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import pages from "./admin-pages.module.css";

// Referans: oriens-admin.js "Kaydedilmemiş değişiklik uyarısı" + fxConfirm
// (#fx-confirm). Panelde açılan form pencereleri (role=dialog aria-modal)
// izlenir: kullanıcı bir alanı değiştirdiyse Kapat / Vazgeç / İptal / Esc /
// dışarı tıklama önce onay ister. Pencerelerin kendisine dokunulmaz; olaylar
// window üzerinde capture aşamasında yakalanır ve onaydan sonra yeniden
// tetiklenir.

const MODAL = '[role="dialog"][aria-modal="true"]';
const FIELDS = 'input:not([type="file"]):not([type="search"]):not([type="hidden"]),textarea,select';
const CLOSE_TEXT = new Set(["İptal", "Vazgeç", "Kapat"]);

type Pending = { modal: Element | null; replay: () => void; title: string; text: string; ok?: string };

// Sayfa düzeyindeki formlar (Blog yazısı, Ayarlar > İletişim) aynı onay
// penceresini kullanır: confirmUnsaved() bu bileşen açıkken #fx-confirm'i açar.
type PageConfirm = { title: string; text: string; ok?: string; onConfirm: () => void };
let openPageConfirm: ((request: PageConfirm) => void) | null = null;

export function confirmUnsaved(request: PageConfirm) {
  // Guard AdminShell içinde her zaman bağlıdır. Bağlı değilse (panel dışı)
  // tarayıcının yerel confirm penceresi açılmaz; yenileme / sekme kapatma
  // koruması beforeunload ile sürer.
  if (openPageConfirm) openPageConfirm(request);
  else request.onConfirm();
}

/**
 * Kaydedilmemiş sayfa: tarayıcı kapatma/yenileme (beforeunload) ve panel içi
 * bağlantılarla sayfadan ayrılma onay ister. Referans: oriens-admin.js blog
 * "Kaydetmeden çık" ve Ayarlar iletişim beforeunload.
 */
export function usePageLeaveGuard(dirty: boolean, message: { title: string; text: string; ok?: string }) {
  const router = useRouter();
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  });
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      confirmUnsaved({ ...messageRef.current, onConfirm: () => router.push(url.pathname + url.search + url.hash) });
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, router]);
}

function snapshot(modal: Element) {
  const values = Array.from(modal.querySelectorAll<HTMLInputElement>(FIELDS)).map((field) =>
    field.type === "checkbox" || field.type === "radio" ? field.checked : field.value
  );
  const toggles = Array.from(modal.querySelectorAll("[aria-checked],[aria-pressed]")).map(
    (el) => el.getAttribute("aria-checked") ?? el.getAttribute("aria-pressed")
  );
  // Referans tarih seçici (.dp) bir input değil; gösterilen değer izlenir.
  const dates = Array.from(modal.querySelectorAll(".dp-val, [data-guard-val]")).map((el) => el.textContent);
  return JSON.stringify([values, toggles, dates]);
}

function modalTitle(modal: Element) {
  const id = modal.getAttribute("aria-labelledby");
  const heading = (id && document.getElementById(id)) || modal.querySelector("h2, h3");
  return heading?.textContent?.trim() || "Form";
}

function isFullScreen(el: Element) {
  const rect = el.getBoundingClientRect();
  return rect.width >= window.innerWidth - 2 && rect.height >= window.innerHeight - 2;
}

export function UnsavedChangesGuard() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingRef = useRef<Pending | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const cleanRef = useRef<(modal: Element) => void>(() => {});

  useEffect(() => {
    const snaps = new WeakMap<Element, string>();
    const touched = new WeakSet<Element>();
    let frame = 0;

    const own = (el: Element | null) => !!el && !!dialogRef.current && dialogRef.current.contains(el);
    const modals = () =>
      Array.from(document.querySelectorAll(MODAL)).filter((modal) => !own(modal) && modal.querySelector(FIELDS));

    // Kullanıcı dokunana kadar anlık görüntü her DOM değişikliğinde tazelenir:
    // veriyi pencere açıldıktan sonra yükleyen formlar yanlışlıkla "değişti"
    // sayılmaz.
    const refresh = () => {
      frame = 0;
      for (const modal of modals()) if (!touched.has(modal)) snaps.set(modal, snapshot(modal));
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(refresh);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-checked", "aria-pressed"] });
    refresh();

    const dirty = (modal: Element) => touched.has(modal) && snaps.get(modal) !== snapshot(modal);
    const blocked = () => !!pendingRef.current || dialogRef.current?.open || !!document.querySelector('[role="alertdialog"]');

    const ask = (modal: Element, replay: () => void) => {
      const next: Pending = {
        modal,
        replay,
        title: modalTitle(modal),
        text: modal.querySelector("textarea") && /yanıt/i.test(modalTitle(modal))
          ? "Yazdığınız yanıt gönderilmedi. Pencereyi kapatırsanız silinecek."
          : "Yaptığınız değişiklikler kaydedilmedi. Pencereyi kapatırsanız kaybolacak.",
      };
      pendingRef.current = next;
      setPending(next);
    };

    const markTouched = (event: Event) => {
      const modal = (event.target as Element | null)?.closest?.(MODAL);
      if (modal && !own(modal)) touched.add(modal);
    };

    // Kapatma hedefi: pencere içindeki Kapat/Vazgeç/İptal düğmesi ya da tam
    // ekran arka plan (pencere kabının kendisi veya dışındaki örtü).
    const closeTarget = (target: Element): { modal: Element; backdrop: boolean } | null => {
      const open = modals().filter(dirty);
      if (!open.length) return null;
      const inside = target.closest(MODAL);
      if (inside && open.includes(inside)) {
        if (target === inside) return isFullScreen(inside) ? { modal: inside, backdrop: true } : null;
        const button = target.closest("button");
        if (!button || button.type === "submit" || !inside.contains(button)) return null;
        const label = button.getAttribute("aria-label") ?? "";
        const text = button.textContent?.trim() ?? "";
        if (button.hasAttribute("data-close") || /kapat|close/i.test(label) || CLOSE_TEXT.has(text)) return { modal: inside, backdrop: false };
        return null;
      }
      if (!inside && isFullScreen(target)) return { modal: open[open.length - 1], backdrop: true };
      return null;
    };

    // Fare basışında sorulur ve ardından gelen click yutulur; klavyeyle
    // tetiklenen (mousedown'suz) click ise kendisi sorar.
    let swallowClick = false;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || own(target)) {
        swallowClick = false;
        return;
      }
      if (event.type === "click" && swallowClick) {
        swallowClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.type === "click" && target.closest(".dp-day, .fx-link, [data-guard-pick]")) markTouched(event);
      if (blocked() || event.button !== 0) return;
      const hit = closeTarget(target);
      if (!hit) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      swallowClick = event.type === "mousedown";
      ask(hit.modal, () => {
        if (hit.backdrop) target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        (target as HTMLElement).click();
      });
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || blocked()) return;
      // Esc yalnız en üstteki pencereyi kapatır: iç içe açık temiz bir pencere
      // (ör. Sınıf Yönetimi) varsa alttaki değişmiş form sorulmaz.
      const open = modals().filter((item) => item.closest("dialog")?.open !== false);
      const modal = open[open.length - 1];
      if (!modal || !dirty(modal)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const origin = (document.activeElement as HTMLElement | null) ?? document.body;
      ask(modal, () => {
        // Yerel <dialog>: yapay keydown "cancel" üretmez; olay doğrudan gönderilir.
        const dialog = modal.closest("dialog");
        if (dialog?.open) {
          if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
          return;
        }
        origin.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      });
    };

    // Onay sonrası yeniden tetiklemede pencere "temiz" sayılır.
    cleanRef.current = (modal: Element) => {
      touched.delete(modal);
    };

    openPageConfirm = (request) => {
      const next: Pending = { modal: null, replay: request.onConfirm, title: request.title, text: request.text, ok: request.ok };
      pendingRef.current = next;
      setPending(next);
    };

    document.addEventListener("input", markTouched, true);
    document.addEventListener("change", markTouched, true);
    window.addEventListener("mousedown", onPointer, true);
    window.addEventListener("click", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      openPageConfirm = null;
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.removeEventListener("input", markTouched, true);
      document.removeEventListener("change", markTouched, true);
      window.removeEventListener("mousedown", onPointer, true);
      window.removeEventListener("click", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (pending && dialog && !dialog.open) dialog.showModal();
  }, [pending]);

  const close = () => {
    dialogRef.current?.close();
  };

  const discard = () => {
    const current = pendingRef.current;
    close();
    if (!current) return;
    if (current.modal) cleanRef.current(current.modal);
    current.replay();
  };

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={dialogRef}
        className="arc"
        id="fx-confirm"
        onClose={() => {
          pendingRef.current = null;
          setPending(null);
        }}
      >
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="fxc-title">
          <div className="m-head">
            <div className="m-hicon" style={{ background: "#FBECEA", color: "#9A3324" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="fxc-title" className="m-htitle">Kaydedilmemiş değişiklikler</h2>
              <span className="m-hsub">{pending?.title ?? ""}</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="m-body"><p>{pending?.text ?? ""}</p></div>
          <div className="m-foot">
            <button type="button" className="m-cancel" onClick={close}>Vazgeç</button>
            <button type="button" className="m-delok" onClick={discard}>{pending?.ok ?? "Kaydetmeden kapat"}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
