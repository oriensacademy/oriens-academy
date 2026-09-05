"use client";

import { useRef, useState } from "react";
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
import { AddBlockMenu, type AddableBlockType, type SectionPreset } from "./blocks/AddBlockMenu";
import { TextBlockEditor, convertTextBlock } from "./blocks/TextBlockEditor";
import { ListBlockEditor } from "./blocks/ListBlockEditor";
import { ImageBlockEditor } from "./blocks/ImageBlockEditor";
import { FileBlockEditor } from "./blocks/FileBlockEditor";
import { ButtonBlockEditor } from "./blocks/ButtonBlockEditor";
import { DividerBlockEditor, SpacerBlockEditor } from "./blocks/MiscBlocks";
import { SplitBlockEditor, emptyTextPane, imagePaneFromUrl } from "./blocks/SplitBlockEditor";
import { CalloutBlockEditor, CtaBlockEditor, GalleryBlockEditor } from "./blocks/GalleryCtaCalloutEditors";
import { newBlockId, type BlogBlock, type SplitVariant } from "@/lib/blog/blockSchema";
import type { BlockConvertTarget } from "./blocks/InlineEditor";

type SimpleBlockType = Exclude<AddableBlockType, "image" | "file">;

const BLOCK_LABEL: Record<BlogBlock["type"], string> = {
  paragraph: "Metin",
  heading: "Başlık",
  quote: "Alıntı",
  list: "Liste",
  divider: "Ayırıcı",
  spacer: "Boşluk",
  image: "Görsel",
  file: "Dosya",
  button: "Buton",
  callout: "Bilgi kutusu",
  split: "Yan yana",
  gallery: "Galeri",
  cta: "CTA",
};

function splitVariantOf(type: SimpleBlockType): SplitVariant | null {
  if (type === "split-text-image") return "text-image";
  if (type === "split-image-text") return "image-text";
  if (type === "split-text-text") return "text-text";
  return null;
}

function emptySplit(variant: SplitVariant): BlogBlock {
  return {
    id: newBlockId(),
    type: "split",
    variant,
    ratio: "50-50",
    valign: "top",
    // Image panes start as empty text panes; the author uploads into them from
    // the pane's own "Görsel Yükle" button. sanitizeBlogContentJson coerces the
    // pane back to the variant's expected kind on save.
    left: emptyTextPane(),
    right: emptyTextPane(),
  };
}

function emptyBlock(type: SimpleBlockType): BlogBlock {
  const variant = splitVariantOf(type);
  if (variant) return emptySplit(variant);
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
    case "callout":
      return { id: newBlockId(), type: "callout", tone: "info", content: [] };
    case "gallery":
      return { id: newBlockId(), type: "gallery", columns: 2, items: [] };
    case "cta":
      return { id: newBlockId(), type: "cta", title: "", description: "", buttonLabel: "", buttonUrl: "" };
    case "button":
    default:
      return { id: newBlockId(), type: "button", label: "", url: "", style: "primary" };
  }
}

/** Section presets expand into ordinary blocks the author can then edit freely. */
function presetBlocks(preset: SectionPreset): BlogBlock[] {
  switch (preset) {
    case "intro":
      return [emptyBlock("heading"), emptyBlock("paragraph")];
    case "image-right":
      return [emptySplit("text-image")];
    case "image-left":
      return [emptySplit("image-text")];
    case "comparison":
      return [emptySplit("text-text")];
    case "gallery":
      return [emptyBlock("gallery")];
    case "closing-cta":
    default:
      return [emptyBlock("paragraph"), emptyBlock("cta")];
  }
}

/** Deep-clones a block and re-keys every id so duplication never aliases state. */
function duplicateBlock(block: BlogBlock): BlogBlock {
  const clone = structuredClone(block) as BlogBlock;
  clone.id = newBlockId();
  if (clone.type === "gallery") {
    clone.items = clone.items.map((item) => ({ ...item, id: newBlockId() }));
  }
  return clone;
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
  const paneTargetRef = useRef<{ blockId: string; side: "left" | "right" } | null>(null);
  const paneInputRef = useRef<HTMLInputElement>(null);
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

  function moveBlock(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    onChange(arrayMove(blocks, index, target));
  }

  function duplicateAt(index: number) {
    const next = blocks.slice();
    next.splice(index + 1, 0, duplicateBlock(blocks[index]));
    onChange(next);
  }

  function insertAt(index: number, inserted: BlogBlock[]) {
    const next = blocks.slice();
    next.splice(index, 0, ...inserted);
    onChange(next);
  }

  async function insertImageAt(index: number, file: File) {
    const pendingId = newBlockId();
    setUploadingId(pendingId);
    const result = await onUploadImage(file);
    setUploadingId(null);
    if (!result.url) {
      onError(result.error || "Görsel yüklenemedi.");
      return;
    }
    insertAt(index, [
      {
        id: pendingId,
        type: "image",
        url: result.url,
        alt: "",
        caption: "",
        align: "center",
        width: 100,
        wrap: false,
        fit: "cover",
        aspect: "auto",
      },
    ]);
  }

  async function insertFileAt(index: number, file: File) {
    const pendingId = newBlockId();
    setUploadingId(pendingId);
    const result = await onUploadFile(file);
    setUploadingId(null);
    if (!result.url) {
      onError(result.error || "Dosya yüklenemedi.");
      return;
    }
    insertAt(index, [{ id: pendingId, type: "file", url: result.url, name: file.name, size: result.size }]);
  }

  async function replaceImage(block: Extract<BlogBlock, { type: "image" }>, file: File) {
    setUploadingId(block.id);
    const result = await onUploadImage(file);
    setUploadingId(null);
    if (!result.url) {
      onError(result.error || "Görsel yüklenemedi.");
      return;
    }
    updateBlock(block.id, { ...block, url: result.url });
  }

  async function replaceFile(block: Extract<BlogBlock, { type: "file" }>, file: File) {
    setUploadingId(block.id);
    const result = await onUploadFile(file);
    setUploadingId(null);
    if (!result.url) {
      onError(result.error || "Dosya yüklenemedi.");
      return;
    }
    updateBlock(block.id, { ...block, url: result.url, name: file.name, size: result.size });
  }

  async function addGalleryImage(block: Extract<BlogBlock, { type: "gallery" }>, file: File) {
    setUploadingId(block.id);
    const result = await onUploadImage(file);
    setUploadingId(null);
    if (!result.url) {
      onError(result.error || "Görsel yüklenemedi.");
      return;
    }
    updateBlock(block.id, {
      ...block,
      items: [...block.items, { id: newBlockId(), url: result.url, alt: "", caption: "" }],
    });
  }

  /** One shared file input for every side-by-side image pane. */
  function pickPaneImage(blockId: string, side: "left" | "right") {
    paneTargetRef.current = { blockId, side };
    paneInputRef.current?.click();
  }

  async function uploadPaneImage(file: File) {
    const target = paneTargetRef.current;
    paneTargetRef.current = null;
    if (!target) return;
    const block = blocks.find((entry) => entry.id === target.blockId);
    if (!block || block.type !== "split") return;
    setUploadingId(`${target.blockId}:${target.side}`);
    const result = await onUploadImage(file);
    setUploadingId(null);
    if (!result.url) {
      onError(result.error || "Görsel yüklenemedi.");
      return;
    }
    // Re-read from props: the author may have edited the other pane meanwhile.
    const current = blocks.find((entry) => entry.id === target.blockId);
    if (!current || current.type !== "split") return;
    updateBlock(current.id, { ...current, [target.side]: imagePaneFromUrl(result.url) });
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

  function renderAddMenu(index: number) {
    return (
      <AddBlockMenu
        onInsert={(type) => insertAt(index, [emptyBlock(type)])}
        onInsertImage={(file) => void insertImageAt(index, file)}
        onInsertFile={(file) => void insertFileAt(index, file)}
        onInsertPreset={(preset) => insertAt(index, presetBlocks(preset))}
      />
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <div className="group">
          {renderAddMenu(0)}
          {blocks.map((block, index) => (
            <div key={block.id} className="group">
              <BlockShell
                id={block.id}
                label={BLOCK_LABEL[block.type]}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
                onMoveUp={() => moveBlock(index, -1)}
                onMoveDown={() => moveBlock(index, 1)}
                onDuplicate={() => duplicateAt(index)}
                onDelete={() => removeBlock(block.id)}
              >
                {block.type === "paragraph" || block.type === "heading" || block.type === "quote" ? (
                  <TextBlockEditor
                    block={block}
                    onChange={(content) => updateBlock(block.id, { ...block, content })}
                    onConvert={(target) => handleConvert(block, target)}
                  />
                ) : block.type === "list" ? (
                  <ListBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                ) : block.type === "image" ? (
                  <ImageBlockEditor
                    block={block}
                    onChange={(next) => updateBlock(block.id, next)}
                    onReplace={(file) => void replaceImage(block, file)}
                    uploading={uploadingId === block.id}
                  />
                ) : block.type === "file" ? (
                  <FileBlockEditor block={block} onReplace={(file) => void replaceFile(block, file)} uploading={uploadingId === block.id} />
                ) : block.type === "button" ? (
                  <ButtonBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                ) : block.type === "callout" ? (
                  <CalloutBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                ) : block.type === "cta" ? (
                  <CtaBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                ) : block.type === "gallery" ? (
                  <GalleryBlockEditor
                    block={block}
                    onChange={(next) => updateBlock(block.id, next)}
                    onAddImage={(file) => void addGalleryImage(block, file)}
                    uploading={uploadingId === block.id}
                  />
                ) : block.type === "split" ? (
                  <SplitBlockEditor
                    block={block}
                    onChange={(next) => updateBlock(block.id, next)}
                    onPickPaneImage={(side) => pickPaneImage(block.id, side)}
                    onReplacePaneImage={(side, file) => {
                      paneTargetRef.current = { blockId: block.id, side };
                      void uploadPaneImage(file);
                    }}
                    uploadingSide={
                      uploadingId === `${block.id}:left` ? "left" : uploadingId === `${block.id}:right` ? "right" : null
                    }
                  />
                ) : block.type === "divider" ? (
                  <DividerBlockEditor />
                ) : (
                  <SpacerBlockEditor block={block} onChange={(next) => updateBlock(block.id, next)} />
                )}
              </BlockShell>
              {renderAddMenu(index + 1)}
            </div>
          ))}
        </div>
      </SortableContext>

      {!blocks.length ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Yukarıdaki “+” ile ilk bloğunuzu ekleyin veya hazır bir bölüm seçin.
        </p>
      ) : null}

      <input
        ref={paneInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadPaneImage(file);
          event.currentTarget.value = "";
        }}
      />
    </DndContext>
  );
}
