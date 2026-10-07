"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Referans be-blk kabuğu: başlıkta blok türü (sürükleme tutamacı da buradadır)
 * ve yukarı / aşağı / çoğalt / sil düğmeleri. Drag-and-drop alone is not enough
 * -- it is unreliable on touch and invisible to keyboard users -- so every
 * reorder is also reachable through a plain button.
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

  return (
    <div ref={setNodeRef} style={style} className="be-blk">
      <div className="be-blk-h">
        <span className="be-blk-t">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`${label} bloğunu sürükle`}
            style={{ display: "inline-flex", border: 0, background: "none", padding: 0, color: "inherit", cursor: "grab", touchAction: "none" }}
          >
            <GripVertical width={16} height={16} aria-hidden="true" />
          </button>
          {label}
        </span>
        <span className="be-blk-a">
          <button type="button" title="Yukarı taşı" aria-label={`${label} bloğunu yukarı taşı`} onClick={onMoveUp} disabled={!canMoveUp}>↑</button>
          <button type="button" title="Aşağı taşı" aria-label={`${label} bloğunu aşağı taşı`} onClick={onMoveDown} disabled={!canMoveDown}>↓</button>
          <button type="button" title="Bloğu çoğalt" aria-label={`${label} bloğunu çoğalt`} onClick={onDuplicate}>⧉</button>
          <button type="button" title="Bloğu sil" aria-label={`${label} bloğunu sil`} onClick={onDelete} data-rm="">✕</button>
        </span>
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
