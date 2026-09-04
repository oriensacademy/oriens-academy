"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

/** Drag handle + delete gutter shared by every block type in the visual editor. */
export function BlockShell({ id, onDelete, children }: { id: string; onDelete: () => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="group relative flex gap-1.5 rounded-xl border border-transparent p-2 transition hover:border-border sm:gap-2">
      <div className="flex shrink-0 flex-col items-center gap-1 pt-1 opacity-40 transition group-hover:opacity-100 group-focus-within:opacity-100 sm:opacity-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Sürükle"
          className="touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onDelete} aria-label="Bloğu sil" className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
