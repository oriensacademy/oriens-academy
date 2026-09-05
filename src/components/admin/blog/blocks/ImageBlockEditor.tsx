"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AlignLeft, AlignCenter, AlignRight, StretchHorizontal, Settings2, RefreshCw } from "lucide-react";
import { ASPECT_OPTIONS, FIT_OPTIONS } from "./PaneEditors";
import type { BlockAlign, BlockWidth, BlogBlock } from "@/lib/blog/blockSchema";

type ImageBlock = Extract<BlogBlock, { type: "image" }>;

const ALIGN_OPTIONS: { value: BlockAlign; label: string; icon: typeof AlignLeft }[] = [
  { value: "left", label: "Sol", icon: AlignLeft },
  { value: "center", label: "Orta", icon: AlignCenter },
  { value: "right", label: "Sağ", icon: AlignRight },
  { value: "full", label: "Tam genişlik", icon: StretchHorizontal },
];

const WIDTH_OPTIONS: { value: BlockWidth; label: string }[] = [
  { value: 25, label: "%25" },
  { value: 50, label: "%50" },
  { value: 75, label: "%75" },
  { value: 100, label: "%100" },
];

export function ImageBlockEditor({ block, onChange, onReplace, uploading }: {
  block: ImageBlock;
  onChange: (next: ImageBlock) => void;
  onReplace: (file: File) => void;
  uploading: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-muted">
        <button type="button" onClick={() => setSettingsOpen((value) => !value)} className="block w-full cursor-pointer" aria-label="Görsel ayarlarını aç">
          <Image
            src={block.url}
            alt={block.alt || ""}
            width={1200}
            height={800}
            unoptimized
            className={`h-auto max-h-[26rem] w-full ${block.fit === "contain" ? "object-contain" : "object-cover"}`}
          />
        </button>
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button type="button" onClick={() => setSettingsOpen((value) => !value)} className="flex size-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur hover:bg-black/70" aria-label="Ayarlar">
            <Settings2 className="size-4" />
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex size-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur hover:bg-black/70 disabled:opacity-50" aria-label="Görseli değiştir">
            <RefreshCw className={`size-4 ${uploading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onReplace(file);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {settingsOpen ? (
        <div className="mt-2 space-y-3 rounded-xl border border-border bg-white p-3">
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hizalama</p>
            <div className="flex flex-wrap gap-1">
              {ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...block, align: value, wrap: value === "left" || value === "right" ? block.wrap : false })}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${block.align === value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {block.align !== "full" ? (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Boyut</p>
              <div className="flex flex-wrap gap-1">
                {WIDTH_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange({ ...block, width: value })}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${block.width === value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Görsel Davranışı</p>
            <div className="flex flex-wrap gap-1">
              {FIT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...block, fit: value })}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${block.fit === value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Oran</p>
            <div className="flex flex-wrap gap-1">
              {ASPECT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...block, aspect: value })}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${block.aspect === value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {block.align === "left" || block.align === "right" ? (
            <label className="flex items-center gap-2 text-[11px] font-semibold text-ink">
              <input type="checkbox" checked={block.wrap} onChange={(event) => onChange({ ...block, wrap: event.target.checked })} className="size-3.5 accent-primary" />
              Yazı görselin etrafından aksın (masaüstü)
            </label>
          ) : null}

          <label className="block text-[11px] font-bold text-muted-foreground">
            Alt Metni
            <input
              value={block.alt}
              onChange={(event) => onChange({ ...block, alt: event.target.value })}
              placeholder="Görselin kısa açıklaması (SEO/erişilebilirlik)"
              className="mt-1 h-9 w-full rounded-lg border border-input px-2.5 text-xs font-normal text-ink"
            />
          </label>
          <label className="block text-[11px] font-bold text-muted-foreground">
            Açıklama / Caption
            <input
              value={block.caption}
              onChange={(event) => onChange({ ...block, caption: event.target.value })}
              placeholder="Görsel altında görünecek açıklama (opsiyonel)"
              className="mt-1 h-9 w-full rounded-lg border border-input px-2.5 text-xs font-normal text-ink"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
