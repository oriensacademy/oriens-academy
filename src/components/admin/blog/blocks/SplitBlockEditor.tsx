"use client";

import { AlignVerticalJustifyCenter, AlignVerticalJustifyStart, Columns2, ImageIcon, TextIcon } from "lucide-react";
import { PaneImageEditor, PaneTextEditor } from "./PaneEditors";
import type {
  BlogBlock,
  PaneImage,
  PaneTextNode,
  SplitPane,
  SplitRatio,
  SplitVAlign,
  SplitVariant,
} from "@/lib/blog/blockSchema";

type SplitBlock = Extract<BlogBlock, { type: "split" }>;

const VARIANT_OPTIONS: { value: SplitVariant; label: string; icon: typeof Columns2 }[] = [
  { value: "text-image", label: "Yazı Solda — Görsel Sağda", icon: TextIcon },
  { value: "image-text", label: "Görsel Solda — Yazı Sağda", icon: ImageIcon },
  { value: "text-text", label: "İki Kolon Metin", icon: Columns2 },
];

const RATIO_OPTIONS: { value: SplitRatio; label: string }[] = [
  { value: "50-50", label: "50 / 50" },
  { value: "40-60", label: "40 / 60" },
  { value: "60-40", label: "60 / 40" },
];

const VALIGN_OPTIONS: { value: SplitVAlign; label: string; icon: typeof AlignVerticalJustifyStart }[] = [
  { value: "top", label: "Üstten hizala", icon: AlignVerticalJustifyStart },
  { value: "center", label: "Ortadan hizala", icon: AlignVerticalJustifyCenter },
];

export function emptyTextPane(): SplitPane {
  return { kind: "text", nodes: [{ type: "paragraph", content: [] }] };
}

export function imagePaneFromUrl(url: string): SplitPane {
  return { kind: "image", url, alt: "", caption: "", fit: "cover", aspect: "4-3" };
}

/**
 * Side-by-side block editor. The author picks the intent
 * ("Yazı Solda — Görsel Sağda"), not the underlying pane types: switching the
 * variant re-shapes the panes and keeps whatever content still fits, so the
 * stored block can never disagree with the label the author chose.
 */
export function SplitBlockEditor({
  block,
  onChange,
  onReplacePaneImage,
  onPickPaneImage,
  uploadingSide,
}: {
  block: SplitBlock;
  onChange: (next: SplitBlock) => void;
  onReplacePaneImage: (side: "left" | "right", file: File) => void;
  onPickPaneImage: (side: "left" | "right") => void;
  uploadingSide: "left" | "right" | null;
}) {
  function switchVariant(variant: SplitVariant) {
    if (variant === block.variant) return;
    const keptText =
      block.left.kind === "text" ? block.left : block.right.kind === "text" ? block.right : emptyTextPane();
    const keptImage =
      block.left.kind === "image" ? block.left : block.right.kind === "image" ? block.right : null;

    let left: SplitPane;
    let right: SplitPane;
    if (variant === "text-image") {
      left = keptText;
      right = keptImage ?? emptyTextPane();
    } else if (variant === "image-text") {
      left = keptImage ?? emptyTextPane();
      right = keptText;
    } else {
      left = keptText;
      right = block.right.kind === "text" ? block.right : emptyTextPane();
    }
    onChange({ ...block, variant, left, right });
  }

  function updatePane(side: "left" | "right", pane: SplitPane) {
    onChange({ ...block, [side]: pane });
  }

  function renderPane(side: "left" | "right") {
    const pane = block[side];
    const label = side === "left" ? "Sol Sütun" : "Sağ Sütun";

    if (pane.kind === "image") {
      return (
        <PaneImageEditor
          pane={pane}
          label={label}
          uploading={uploadingSide === side}
          onChange={(next: PaneImage) => updatePane(side, { kind: "image", ...next })}
          onReplace={(file) => onReplacePaneImage(side, file)}
        />
      );
    }

    // A variant that wants an image here but has no upload yet.
    const wantsImage =
      (block.variant === "text-image" && side === "right") || (block.variant === "image-text" && side === "left");
    if (wantsImage) {
      return (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-muted/30 p-4 text-center">
          <ImageIcon className="size-6 text-muted-foreground" />
          <p className="mt-2 text-[11px] font-semibold text-ink">{label} için görsel seçin</p>
          <button
            type="button"
            onClick={() => onPickPaneImage(side)}
            disabled={uploadingSide === side}
            className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-input bg-white px-3 text-[11px] font-semibold text-ink transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploadingSide === side ? "Yükleniyor…" : "Görsel Yükle"}
          </button>
        </div>
      );
    }

    return (
      <PaneTextEditor
        nodes={pane.nodes}
        label={label}
        onChange={(nodes: PaneTextNode[]) => updatePane(side, { kind: "text", nodes })}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-muted/30 p-3">
      <div className="flex flex-wrap gap-1">
        {VARIANT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => switchVariant(value)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
              block.variant === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-white text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Genişlik</span>
          {RATIO_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...block, ratio: value })}
              className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                block.ratio === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hizalama</span>
          {VALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...block, valign: value })}
              title={label}
              aria-label={label}
              className={`rounded-lg border px-2 py-1 ${
                block.valign === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {renderPane("left")}
        {renderPane("right")}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Mobilde iki sütun otomatik olarak alt alta gelir; soldaki sütun üstte görünür.
      </p>
    </div>
  );
}
