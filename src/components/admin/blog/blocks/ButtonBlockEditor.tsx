"use client";

import type { BlogBlock } from "@/lib/blog/blockSchema";

type ButtonBlock = Extract<BlogBlock, { type: "button" }>;

export function ButtonBlockEditor({ block, onChange }: { block: ButtonBlock; onChange: (next: ButtonBlock) => void }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-white p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block text-[11px] font-bold text-muted-foreground">
          Buton Yazısı
          <input
            value={block.label}
            onChange={(event) => onChange({ ...block, label: event.target.value })}
            placeholder="Ücretleri İncele"
            className="mt-1 h-9 w-full rounded-lg border border-input px-2.5 text-xs font-normal text-ink"
          />
        </label>
        <label className="block text-[11px] font-bold text-muted-foreground">
          URL
          <input
            value={block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="/tr/pricing/ veya https://…"
            className="mt-1 h-9 w-full rounded-lg border border-input px-2.5 text-xs font-normal text-ink"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...block, style: "primary" })}
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${block.style === "primary" ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
        >
          Dolu Buton
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...block, style: "secondary" })}
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${block.style === "secondary" ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
        >
          Çerçeveli Buton
        </button>
        <span
          className={
            block.style === "primary"
              ? "ml-auto inline-flex min-h-9 items-center rounded-xl bg-[#819586] px-4 text-xs font-semibold text-white"
              : "ml-auto inline-flex min-h-9 items-center rounded-xl border border-[#DDE4DC] bg-white px-4 text-xs font-semibold text-[#10271B]"
          }
        >
          {block.label || "Buton önizleme"}
        </span>
      </div>
    </div>
  );
}
