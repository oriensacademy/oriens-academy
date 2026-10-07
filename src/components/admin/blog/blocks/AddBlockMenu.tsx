"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Columns2,
  FileText,
  GalleryHorizontalEnd,
  Heading2,
  ImagePlus,
  Info,
  Link2,
  List,
  Minus,
  MoveVertical,
  Plus,
  Quote,
  Sparkles,
  Type,
} from "lucide-react";

/**
 * Block types the author can insert directly. Labels are written the way an
 * editor thinks about the page ("Yazı Solda — Görsel Sağda"), never as schema
 * names or "Şablon 1 / Layout A".
 */
export type AddableBlockType =
  | "paragraph"
  | "heading"
  | "image"
  | "file"
  | "quote"
  | "callout"
  | "button"
  | "divider"
  | "list"
  | "spacer"
  | "split-text-image"
  | "split-image-text"
  | "split-text-text"
  | "gallery"
  | "cta";

/** Ready-made sections that expand into ordinary, individually editable blocks. */
export type SectionPreset = "intro" | "image-right" | "image-left" | "comparison" | "gallery" | "closing-cta";

const BLOCK_OPTIONS: { type: AddableBlockType; label: string; hint: string; icon: typeof Type }[] = [
  { type: "paragraph", label: "Metin", hint: "Paragraf yazısı", icon: Type },
  { type: "heading", label: "Ara başlık", hint: "Bölüm başlığı", icon: Heading2 },
  { type: "list", label: "Liste", hint: "Madde madde", icon: List },
  { type: "quote", label: "Alıntı", hint: "Vurgulu söz", icon: Quote },
  { type: "image", label: "Görsel", hint: "Yazı içi resim", icon: ImagePlus },
  { type: "cta", label: "Hazır bölüm", hint: "Tanışma görüşmesi daveti", icon: Sparkles },
  { type: "divider", label: "Ayırıcı", hint: "Bölümler arası çizgi", icon: Minus },
  { type: "split-text-image", label: "Yazı Sol / Görsel Sağ", hint: "Yan yana anlatım", icon: AlignLeft },
  { type: "split-image-text", label: "Görsel Sol / Yazı Sağ", hint: "Yan yana anlatım", icon: ImagePlus },
  { type: "split-text-text", label: "İki Kolon", hint: "Yan yana iki metin", icon: Columns2 },
  { type: "gallery", label: "Galeri", hint: "2 veya 3 görsellik ızgara", icon: GalleryHorizontalEnd },
  { type: "callout", label: "Bilgi kutusu", hint: "Renkli not alanı", icon: Info },
  { type: "button", label: "Buton", hint: "Bağlantı düğmesi", icon: Link2 },
  { type: "file", label: "PDF / Dosya", hint: "İndirilebilir dosya", icon: FileText },
  { type: "spacer", label: "Boşluk", hint: "Dikey boşluk", icon: MoveVertical },
];

const PRESET_OPTIONS: { preset: SectionPreset; label: string; hint: string }[] = [
  { preset: "intro", label: "Giriş Bölümü", hint: "Başlık + açıklama" },
  { preset: "image-right", label: "Görselli Anlatım — Sağ", hint: "Yazı solda, görsel sağda" },
  { preset: "image-left", label: "Görselli Anlatım — Sol", hint: "Görsel solda, yazı sağda" },
  { preset: "comparison", label: "Karşılaştırma", hint: "Yan yana iki metin kolonu" },
  { preset: "gallery", label: "Görsel Galeri", hint: "2 veya 3 görsellik ızgara" },
  { preset: "closing-cta", label: "Sonuç + Davet", hint: "Kapanış metni ve düğme" },
];

/**
 * Referans be-addbig / be-addsm + be-menu. Image/PDF open a native file
 * picker immediately since those blocks cannot exist without a file; every
 * other type inserts an empty block the author fills in inline.
 */
export function AddBlockMenu({
  onInsert,
  onInsertImage,
  onInsertFile,
  onInsertPreset,
  variant = "inline",
}: {
  onInsert: (type: Exclude<AddableBlockType, "image" | "file">) => void;
  onInsertImage: (file: File) => void;
  onInsertFile: (file: File) => void;
  onInsertPreset: (preset: SectionPreset) => void;
  /**
   * "prominent" is the reference "İçerik Ekle" card shown while the post has no
   * blocks; "inline" is the "Blok ekle" button under the last block.
   */
  variant?: "inline" | "prominent";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handleSelect(type: AddableBlockType) {
    setOpen(false);
    if (type === "image") {
      imageInputRef.current?.click();
      return;
    }
    if (type === "file") {
      fileInputRef.current?.click();
      return;
    }
    onInsert(type);
  }

  return (
    <div ref={rootRef} style={{ position: "relative", display: "flex", flexDirection: "column", flex: variant === "prominent" ? 1 : undefined }}>
      {variant === "prominent" ? (
        <button type="button" className="be-addbig" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span className="be-plus"><Plus className="size-[22px]" aria-hidden="true" /></span>
          <b>İçerik Ekle</b>
          <small>Metin, ara başlık, görsel, liste, alıntı veya hazır bölüm</small>
        </button>
      ) : (
        <button type="button" className="be-addsm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <Plus className="size-4" aria-hidden="true" />Blok ekle
        </button>
      )}

      {open ? (
        <div
          role="menu"
          aria-label="Eklenecek blok türü"
          className="be-menu"
          style={{ top: "calc(100% + 8px)", left: variant === "prominent" ? "50%" : 0, transform: variant === "prominent" ? "translateX(-50%)" : undefined, maxWidth: "calc(100vw - 32px)", maxHeight: 420, overflowY: "auto" }}
        >
          {BLOCK_OPTIONS.map(({ type, label, hint, icon: Icon }) => (
            <button key={type} type="button" role="menuitem" onClick={() => handleSelect(type)}>
              <span><Icon className="size-4" aria-hidden="true" /></span>
              <b>{label}</b>
              <small>{hint}</small>
            </button>
          ))}
          {PRESET_OPTIONS.map(({ preset, label, hint }) => (
            <button key={preset} type="button" role="menuitem" onClick={() => { setOpen(false); onInsertPreset(preset); }}>
              <span><Sparkles className="size-4" aria-hidden="true" /></span>
              <b>{label}</b>
              <small>{hint}</small>
            </button>
          ))}
        </div>
      ) : null}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onInsertImage(file);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onInsertFile(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
