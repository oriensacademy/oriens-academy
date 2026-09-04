"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Type,
  Heading2,
  ImagePlus,
  FileText,
  Quote,
  Link2,
  Minus,
  List,
  MoveVertical,
} from "lucide-react";

export type AddableBlockType = "paragraph" | "heading" | "image" | "file" | "quote" | "button" | "divider" | "list" | "spacer";

const OPTIONS: { type: AddableBlockType; label: string; icon: typeof Type }[] = [
  { type: "paragraph", label: "Metin", icon: Type },
  { type: "heading", label: "Başlık", icon: Heading2 },
  { type: "image", label: "Görsel", icon: ImagePlus },
  { type: "file", label: "PDF / Dosya", icon: FileText },
  { type: "quote", label: "Alıntı", icon: Quote },
  { type: "list", label: "Liste", icon: List },
  { type: "button", label: "Buton", icon: Link2 },
  { type: "divider", label: "Ayırıcı", icon: Minus },
  { type: "spacer", label: "Boşluk", icon: MoveVertical },
];

/**
 * The "+ Blok Ekle" control shown between every block (spec §5). Image/PDF
 * open a native file picker immediately since those block types can't exist
 * without content; every other type inserts an empty block that the author
 * fills in inline.
 */
export function AddBlockMenu({ onInsert, onInsertImage, onInsertFile }: {
  onInsert: (type: Exclude<AddableBlockType, "image" | "file">) => void;
  onInsertImage: (file: File) => void;
  onInsertFile: (file: File) => void;
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
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function handleSelect(type: AddableBlockType) {
    setOpen(false);
    if (type === "image") { imageInputRef.current?.click(); return; }
    if (type === "file") { fileInputRef.current?.click(); return; }
    onInsert(type);
  }

  return (
    <div ref={rootRef} className="relative my-1 flex items-center justify-center">
      <div className="h-px flex-1 scale-y-50 bg-border opacity-0 transition group-hover:opacity-100" />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Blok ekle"
        className="z-10 flex size-6 items-center justify-center rounded-full border border-border bg-white text-muted-foreground opacity-0 shadow-xs transition hover:border-primary hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-40"
      >
        <Plus className="size-3.5" />
      </button>
      <div className="h-px flex-1 scale-y-50 bg-border opacity-0 transition group-hover:opacity-100" />

      {open ? (
        <div className="absolute top-7 z-20 grid w-56 grid-cols-2 gap-1 rounded-xl border border-border bg-white p-2 shadow-lg">
          {OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-ink hover:bg-muted"
            >
              <Icon className="size-3.5 shrink-0 text-primary" />
              {label}
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
