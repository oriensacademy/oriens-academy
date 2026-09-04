"use client";

import { Plus, Trash2, List, ListOrdered } from "lucide-react";
import { InlineEditor } from "./InlineEditor";
import type { BlogBlock, InlineNode } from "@/lib/blog/blockSchema";

type ListBlock = Extract<BlogBlock, { type: "list" }>;

export function ListBlockEditor({ block, onChange }: { block: ListBlock; onChange: (next: ListBlock) => void }) {
  function updateItem(index: number, content: InlineNode[]) {
    const items = block.items.slice();
    items[index] = content;
    onChange({ ...block, items });
  }
  function removeItem(index: number) {
    const items = block.items.filter((_, i) => i !== index);
    onChange({ ...block, items: items.length ? items : [[]] });
  }
  function addItem() {
    onChange({ ...block, items: [...block.items, []] });
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange({ ...block, ordered: false })}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${!block.ordered ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <List className="size-3.5" />
          Madde işaretli
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...block, ordered: true })}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${block.ordered ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <ListOrdered className="size-3.5" />
          Numaralı
        </button>
      </div>
      <ul className={block.ordered ? "list-decimal space-y-1.5 pl-5" : "list-disc space-y-1.5 pl-5"}>
        {block.items.map((item, index) => (
          <li key={index} className="group/item flex items-start gap-1.5">
            <InlineEditor value={item} onChange={(content) => updateItem(index, content)} placeholder="Madde…" className="flex-1 text-base leading-relaxed text-ink/90" />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-red-50 hover:text-red-600 group-hover/item:opacity-100"
              aria-label="Maddeyi sil"
            >
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addItem} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
        <Plus className="size-3" />
        Madde ekle
      </button>
    </div>
  );
}
