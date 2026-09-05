"use client";

import { useRef } from "react";
import Image from "next/image";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ImagePlus, Info, Trash2 } from "lucide-react";
import { InlineEditor } from "./InlineEditor";
import type { BlogBlock, CalloutTone, GalleryItem, InlineNode } from "@/lib/blog/blockSchema";

type GalleryBlock = Extract<BlogBlock, { type: "gallery" }>;
type CtaBlock = Extract<BlogBlock, { type: "cta" }>;
type CalloutBlock = Extract<BlogBlock, { type: "callout" }>;

/** 2 or 3 responsive columns on desktop, always one column on mobile. */
export function GalleryBlockEditor({
  block,
  onChange,
  onAddImage,
  uploading,
}: {
  block: GalleryBlock;
  onChange: (next: GalleryBlock) => void;
  onAddImage: (file: File) => void;
  uploading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function updateItem(index: number, patch: Partial<GalleryItem>) {
    onChange({ ...block, items: block.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= block.items.length) return;
    const items = block.items.slice();
    const [moved] = items.splice(index, 1);
    items.splice(target, 0, moved);
    onChange({ ...block, items });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-muted/30 p-3">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sütun</span>
        {([2, 3] as const).map((columns) => (
          <button
            key={columns}
            type="button"
            onClick={() => onChange({ ...block, columns })}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
              block.columns === columns
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-white text-muted-foreground hover:bg-muted"
            }`}
          >
            {columns} görsel
          </button>
        ))}
      </div>

      <div className={`grid gap-3 ${block.columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {block.items.map((item, index) => (
          <div key={item.id} className="rounded-xl border border-input bg-white p-2">
            <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
              <Image src={item.url} alt={item.alt || ""} width={600} height={450} unoptimized className="h-28 w-full object-cover" />
            </div>
            <input
              value={item.alt}
              onChange={(event) => updateItem(index, { alt: event.target.value })}
              placeholder="Alt metni"
              className="mt-2 h-8 w-full rounded-lg border border-input px-2 text-[11px] text-ink"
            />
            <input
              value={item.caption}
              onChange={(event) => updateItem(index, { caption: event.target.value })}
              placeholder="Açıklama (opsiyonel)"
              className="mt-1.5 h-8 w-full rounded-lg border border-input px-2 text-[11px] text-ink"
            />
            <div className="mt-1.5 flex items-center justify-end gap-0.5">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Sola taşı" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                <ArrowUp className="size-3" />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === block.items.length - 1} aria-label="Sağa taşı" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                <ArrowDown className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}
                aria-label="Görseli kaldır"
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-[11px] font-semibold text-ink transition hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <ImagePlus className="size-3.5" />
        {uploading ? "Yükleniyor…" : "Galeriye görsel ekle"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onAddImage(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export function CtaBlockEditor({ block, onChange }: { block: CtaBlock; onChange: (next: CtaBlock) => void }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Harekete Geçirme Bölümü</p>
      <input
        value={block.title}
        onChange={(event) => onChange({ ...block, title: event.target.value })}
        placeholder="Başlık — örn. Hazırlığa bugün başlayın"
        className="h-10 w-full rounded-lg border border-input bg-white px-3 font-heading text-sm text-ink"
      />
      <textarea
        value={block.description}
        onChange={(event) => onChange({ ...block, description: event.target.value })}
        rows={2}
        maxLength={500}
        placeholder="Kısa açıklama (opsiyonel)"
        className="w-full rounded-lg border border-input bg-white p-2.5 text-xs leading-relaxed text-ink"
      />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block text-[11px] font-bold text-muted-foreground">
          Buton Yazısı
          <input
            value={block.buttonLabel}
            onChange={(event) => onChange({ ...block, buttonLabel: event.target.value })}
            placeholder="Ücretleri İncele"
            className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2.5 text-xs font-normal text-ink"
          />
        </label>
        <label className="block text-[11px] font-bold text-muted-foreground">
          Buton Bağlantısı
          <input
            value={block.buttonUrl}
            onChange={(event) => onChange({ ...block, buttonUrl: event.target.value })}
            placeholder="/tr/ucretler/ veya https://…"
            className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2.5 text-xs font-normal text-ink"
          />
        </label>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Buton yalnızca hem yazısı hem de bağlantısı doldurulduğunda yayında görünür.
      </p>
    </div>
  );
}

const TONE_OPTIONS: { value: CalloutTone; label: string; icon: typeof Info; className: string }[] = [
  { value: "info", label: "Bilgi", icon: Info, className: "border-primary/30 bg-primary/5" },
  { value: "success", label: "İpucu", icon: CheckCircle2, className: "border-emerald-300 bg-emerald-50" },
  { value: "warning", label: "Uyarı", icon: AlertTriangle, className: "border-amber-300 bg-amber-50" },
];

export function CalloutBlockEditor({ block, onChange }: { block: CalloutBlock; onChange: (next: CalloutBlock) => void }) {
  const tone = TONE_OPTIONS.find((option) => option.value === block.tone) ?? TONE_OPTIONS[0];
  const Icon = tone.icon;
  return (
    <div className={`rounded-2xl border p-3 ${tone.className}`}>
      <div className="mb-2 flex flex-wrap gap-1">
        {TONE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...block, tone: value })}
            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
              block.tone === value
                ? "border-primary bg-white text-primary"
                : "border-transparent bg-white/60 text-muted-foreground hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <InlineEditor
          value={block.content}
          onChange={(content: InlineNode[]) => onChange({ ...block, content })}
          placeholder="Okurun dikkatini çekmek istediğiniz not…"
          className="min-w-0 flex-1 text-sm leading-relaxed text-ink/90"
        />
      </div>
    </div>
  );
}
