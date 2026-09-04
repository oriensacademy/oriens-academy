"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { BlockShell } from "./blocks/BlockShell";
import { AddBlockMenu, type AddableBlockType } from "./blocks/AddBlockMenu";
import { TextBlockEditor, convertTextBlock } from "./blocks/TextBlockEditor";
import { ListBlockEditor } from "./blocks/ListBlockEditor";
import { ImageBlockEditor } from "./blocks/ImageBlockEditor";
import { FileBlockEditor } from "./blocks/FileBlockEditor";
import { ButtonBlockEditor } from "./blocks/ButtonBlockEditor";
import { DividerBlockEditor, SpacerBlockEditor } from "./blocks/MiscBlocks";
import { newBlockId, type BlogBlock } from "@/lib/blog/blockSchema";
import type { BlockConvertTarget } from "./blocks/InlineEditor";

function emptyBlock(type: Exclude<AddableBlockType, "image" | "file">): BlogBlock {
  switch (type) {
    case "paragraph":
      return { id: newBlockId(), type: "paragraph", content: [] };
    case "heading":
      return { id: newBlockId(), type: "heading", level: 2, content: [] };
    case "quote":
      return { id: newBlockId(), type: "quote", content: [] };
    case "list":
      return { id: newBlockId(), type: "list", ordered: false, items: [[]] };
    case "divider":
      return { id: newBlockId(), type: "divider" };
    case "spacer":
      return { id: newBlockId(), type: "spacer", size: "md" };
    case "button":
      return { id: newBlockId(), type: "button", label: "", url: "", style: "primary" };
  }
}

interface BlockEditorProps {
  blocks: BlogBlock[];
  onChange: (blocks: BlogBlock[]) => void;
  onUploadImage: (file: File) => Promise<{ url: string | null; error: string | null }>;
  onUploadFile: (file: File) => Promise<{ url: string | null; size: number; error: string | null }>;
  onError: (message: string) => void;
}

export function BlockEditor({ blocks, onChange, onUploadImage, onUploadFile, onError }: BlockEditorProps) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  function updateBlock(id: string, next: BlogBlock) {
    onChange(blocks.map((block) => (block.id === id ? next : block)));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((block) => block.id !== id));
  }

  function insertAt(index: number, block: BlogBlock) {
    const next = blocks.slice();
    next.splice(index, 0, block);
    onChange(next);
  }

  async function insertImageAt(index: number, file: File) {
    const pendingId = newBlockId();
    setUploadingId(pendingId);
    const result = await onUploadImage(file);
    setUploadingId(null);
    if (!result.url) { onError(result.error || "Görsel yüklenemedi."); return; }
    insertAt(index, { id: pendingId, type: "image", url: result.url, alt: "", caption: "", align: "center", width: 100, wrap: false });
  }

  async function insertFileAt(index: number, file: File) {
    const pendingId = newBlockId();
    setUploadingId(pendingId);
    const result = await onUploadFile(file);
    setUploadingId(null);
    if (!result.url) { onError(result.error || "Dosya yüklenemedi."); return; }
    insertAt(index, { id: pendingId, type: "file", url: result.url, name: file.name, size: result.size });
  }

  async function replaceImage(block: Extract<BlogBlock, { type: "image" }>, file: File) {
    setUploadingId(block.id);
    const result = await onUploadImage(file);
    setUploadingId(null);
    if (!result.url) { onError(result.error || "Görsel yüklenemedi."); return; }
    updateBlock(block.id, { ...block, url: result.url });
  }

  async function replaceFile(block: Extract<BlogBlock, { type: "file" }>, file: File) {
    setUploadingId(block.id);
    const result = await onUploadFile(file);
    setUploadingId(null);
    if (!result.url) { onError(result.error || "Dosya yüklenemedi."); return; }
    updateBlock(block.id, { ...block, url: result.url, name: file.name, size: result.size });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  function handleConvert(block: BlogBlock, target: BlockConvertTarget) {
    if (block.type !== "paragraph" && block.type !== "heading" && block.type !== "quote") return;
    updateBlock(block.id, convertTextBlock(block, target));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <div className="group">
          <AddBlockMenu
            onInsert={(type) => insertAt(0, emptyBlock(type))}
            onInsertImage={(file) => void insertImageAt(0, file)}
            onInsertFile={(file) => void insertFileAt(0, file)}
          />
          {blocks.map((block, index) => (
            <div key={block.id} className="group">
              <BlockShell id={block.id} onDelete={() => removeBlock(block.id)}>
                {block.type === "paragraph" || block.type === "heading" || block.type === "quote" ? (
                  <TextBlockEditor block={block} onChange={(content) => updateBlock(block.id, { ...block, content })} onConvert={(target) => handleConvert(block, target)} />
                ) : block.type === "list" ? (
                  <ListBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                ) : block.type === "image" ? (
                  <ImageBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} onReplace={(file) => void replaceImage(block, file)} uploading={uploadingId === block.id} />
                ) : block.type === "file" ? (
                  <FileBlockEditor block={block} onReplace={(file) => void replaceFile(block, file)} uploading={uploadingId === block.id} />
                ) : block.type === "button" ? (
                  <ButtonBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                ) : block.type === "divider" ? (
                  <DividerBlockEditor />
                ) : (
                  <SpacerBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                )}
              </BlockShell>
              <AddBlockMenu
                onInsert={(type) => insertAt(index + 1, emptyBlock(type))}
                onInsertImage={(file) => void insertImageAt(index + 1, file)}
                onInsertFile={(file) => void insertFileAt(index + 1, file)}
              />
            </div>
          ))}
        </div>
      </SortableContext>
      {!blocks.length ? <p className="py-8 text-center text-xs text-muted-foreground">Yukarıdaki “+” ile ilk bloğunuzu ekleyin.</p> : null}
    </DndContext>
  );
}
