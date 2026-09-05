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

const BLOCK_OPTIONS: { type: AddableBlockType; label: string; icon: typeof Type }[] = [
  { type: "paragraph", label: "Metin", icon: Type },
  { type: "heading", label: "Başlık", icon: Heading2 },
  { type: "list", label: "Liste", icon: List },
  { type: "image", label: "Görsel", icon: ImagePlus },
  { type: "split-text-image", label: "Yazı Sol / Görsel Sağ", icon: AlignLeft },
  { type: "split-image-text", label: "Görsel Sol / Yazı Sağ", icon: ImagePlus },
  { type: "split-text-text", label: "İki Kolon", icon: Columns2 },
  { type: "gallery", label: "Galeri", icon: GalleryHorizontalEnd },
  { type: "quote", label: "Alıntı", icon: Quote },
  { type: "callout", label: "Bilgi Kutusu", icon: Info },
  { type: "cta", label: "CTA Bölümü", icon: Sparkles },
  { type: "button", label: "Buton", icon: Link2 },
  { type: "file", label: "PDF / Dosya", icon: FileText },
  { type: "divider", label: "Ayırıcı", icon: Minus },
  { type: "spacer", label: "Boşluk", icon: MoveVertical },
];

const PRESET_OPTIONS: { preset: SectionPreset; label: string; hint: string }[] = [
  { preset: "intro", label: "Giriş Bölümü", hint: "Başlık + açıklama + geniş görsel" },
  { preset: "image-right", label: "Görselli Anlatım — Sağ Görsel", hint: "Yazı solda, görsel sağda" },
  { preset: "image-left", label: "Görselli Anlatım — Sol Görsel", hint: "Görsel solda, yazı sağda" },
  { preset: "comparison", label: "İki Konu Karşılaştırması", hint: "Yan yana iki metin kolonu" },
  { preset: "gallery", label: "Görsel Galeri", hint: "2 veya 3 görsellik ızgara" },
  { preset: "closing-cta", label: "Sonuç + CTA", hint: "Kapanış metni ve buton" },
];

/**
 * The "+" control shown between every block. Image/PDF open a native file
 * picker immediately since those blocks cannot exist without a file; every
 * other type inserts an empty block the author fills in inline.
 */
export function AddBlockMenu({
  onInsert,
  onInsertImage,
  onInsertFile,
  onInsertPreset,
}: {
  onInsert: (type: Exclude<AddableBlockType, "image" | "file">) => void;
  onInsertImage: (file: File) => void;
  onInsertFile: (file: File) => void;
  onInsertPreset: (preset: SectionPreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"blocks" | "presets">("blocks");
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
    <div ref={rootRef} className="relative my-1 flex items-center justify-center">
      <div className="h-px flex-1 scale-y-50 bg-border opacity-0 transition group-hover:opacity-100" />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Blok ekle"
        aria-expanded={open}
        className="z-10 flex size-6 items-center justify-center rounded-full border border-border bg-white text-muted-foreground opacity-0 shadow-xs transition hover:border-primary hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-40"
      >
        <Plus className="size-3.5" />
      </button>
      <div className="h-px flex-1 scale-y-50 bg-border opacity-0 transition group-hover:opacity-100" />

      {open ? (
        <div className="absolute top-7 z-30 w-[min(22rem,calc(100vw-3rem))] rounded-xl border border-border bg-white p-2 shadow-lg">
          <div className="mb-2 flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setTab("blocks")}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${tab === "blocks" ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              Blok Ekle
            </button>
            <button
              type="button"
              onClick={() => setTab("presets")}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${tab === "presets" ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              Hazır Bölüm
            </button>
          </div>

          {tab === "blocks" ? (
            <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
              {BLOCK_OPTIONS.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelect(type)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-ink transition hover:bg-muted"
                >
                  <Icon className="size-3.5 shrink-0 text-primary" />
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {PRESET_OPTIONS.map(({ preset, label, hint }) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onInsertPreset(preset);
                  }}
                  className="block w-full rounded-lg px-2 py-2 text-left transition hover:bg-muted"
                >
                  <span className="block text-[11px] font-bold text-ink">{label}</span>
                  <span className="block text-[10px] text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          )}
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
