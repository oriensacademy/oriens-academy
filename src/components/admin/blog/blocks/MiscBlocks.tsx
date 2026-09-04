"use client";

import type { BlogBlock, SpacerSize } from "@/lib/blog/blockSchema";

export function DividerBlockEditor() {
  return (
    <div className="flex items-center gap-3 py-1">
      <hr className="flex-1 border-border" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ayırıcı</span>
      <hr className="flex-1 border-border" />
    </div>
  );
}

type SpacerBlock = Extract<BlogBlock, { type: "spacer" }>;
const SIZE_OPTIONS: { value: SpacerSize; label: string; height: string }[] = [
  { value: "sm", label: "Küçük", height: "h-4" },
  { value: "md", label: "Orta", height: "h-9" },
  { value: "lg", label: "Büyük", height: "h-16" },
];

export function SpacerBlockEditor({ block, onChange }: { block: SpacerBlock; onChange: (next: SpacerBlock) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/40 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Boşluk</span>
      <div className="ml-auto flex gap-1">
        {SIZE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...block, size: value })}
            className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${block.size === value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
