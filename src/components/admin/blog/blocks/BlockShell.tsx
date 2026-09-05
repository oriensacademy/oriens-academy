"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Per-block gutter: drag handle plus the explicit move up / move down /
 * duplicate / delete controls. Drag-and-drop alone is not enough -- it is
 * unreliable on touch and invisible to keyboard users -- so every reorder is
 * also reachable through a plain button.
 */
export function BlockShell({
  id,
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  children,
}: {
  id: string;
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const iconButton =
    "rounded p-1 text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex gap-1.5 rounded-xl border border-transparent p-2 transition hover:border-border sm:gap-2"
    >
      <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1 opacity-40 transition group-hover:opacity-100 group-focus-within:opacity-100 sm:opacity-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${label} bloğunu sürükle`}
          className="touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label={`${label} bloğunu yukarı taşı`} className={iconButton}>
          <ChevronUp className="size-3.5" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label={`${label} bloğunu aşağı taşı`} className={iconButton}>
          <ChevronDown className="size-3.5" />
        </button>
        <button type="button" onClick={onDuplicate} aria-label={`${label} bloğunu çoğalt`} className={iconButton}>
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${label} bloğunu sil`}
          className="rounded p-1 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
