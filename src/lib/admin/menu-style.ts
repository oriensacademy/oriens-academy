"use client";

import { useSyncExternalStore } from "react";

// Sol menü görünümü (Ayarlar → Menü görünümü). Referanstaki KAYIT ile aynı
// anahtar: localStorage "oa.menuStil", JSON olarak saklanır.
export type AdminMenuStyle = "" | "blok" | "liste" | "koyu";

export const ADMIN_MENU_STYLES: { value: AdminMenuStyle; label: string; hint: string }[] = [
  { value: "", label: "Renkli bloklar", hint: "İkon ortada, 4 eşit parça" },
  { value: "blok", label: "Yatay bloklar", hint: "İkon solda, 4 eşit parça" },
  { value: "liste", label: "Sade liste", hint: "Beyaz, klasik menü" },
  { value: "koyu", label: "Koyu yeşil", hint: "Marka renginde menü" },
];

const KEY = "oa.menuStil";
const EVENT = "oa:menu-style";

function read(): AdminMenuStyle {
  try {
    const raw = window.localStorage.getItem(KEY);
    const value = raw === null ? "" : JSON.parse(raw);
    return ADMIN_MENU_STYLES.some((s) => s.value === value) ? (value as AdminMenuStyle) : "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setAdminMenuStyle(value: AdminMenuStyle) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* depolama kapalıysa yalnızca bu oturumda uygulanmaz */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAdminMenuStyle(): AdminMenuStyle {
  return useSyncExternalStore(subscribe, read, () => "");
}
