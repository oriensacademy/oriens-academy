"use client";

import { useRef } from "react";
import { FileText, RefreshCw } from "lucide-react";
import type { BlogBlock } from "@/lib/blog/blockSchema";

type FileBlock = Extract<BlogBlock, { type: "file" }>;

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FileBlockEditor({ block, onReplace, uploading }: { block: FileBlock; onReplace: (file: File) => void; uploading: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FileText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{block.name}</span>
        {block.size ? <span className="block text-xs text-muted-foreground">{formatFileSize(block.size)}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:bg-muted disabled:opacity-50"
      >
        <RefreshCw className={`size-3.5 ${uploading ? "animate-spin" : ""}`} />
        Değiştir
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onReplace(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
