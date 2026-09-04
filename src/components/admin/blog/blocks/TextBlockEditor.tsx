"use client";

import { InlineEditor, type BlockConvertTarget } from "./InlineEditor";
import type { BlogBlock, InlineNode } from "@/lib/blog/blockSchema";

type TextBlock = Extract<BlogBlock, { type: "paragraph" | "heading" | "quote" }>;

const WRAPPER_CLASS: Record<string, string> = {
  paragraph: "text-base leading-relaxed text-ink/90",
  heading2: "font-heading text-2xl text-ink",
  heading3: "font-heading text-xl text-ink",
  quote: "border-l-4 border-primary/40 bg-surface-muted/50 py-2.5 pl-4 pr-3 text-base italic leading-relaxed text-ink/80",
};

const PLACEHOLDER: Record<string, string> = {
  paragraph: "Yazınıza başlayın…",
  heading2: "Başlık H2",
  heading3: "Başlık H3",
  quote: "Alıntı metni…",
};

function variantKey(block: TextBlock): string {
  if (block.type === "heading") return `heading${block.level}`;
  return block.type;
}

/** Converts the in-place bubble-menu target into a new block, preserving text/id. */
export function convertTextBlock(block: TextBlock, target: BlockConvertTarget): TextBlock {
  if (target === "paragraph") return { id: block.id, type: "paragraph", content: block.content };
  if (target === "quote") return { id: block.id, type: "quote", content: block.content };
  return { id: block.id, type: "heading", level: target === "heading3" ? 3 : 2, content: block.content };
}

export function TextBlockEditor({ block, onChange, onConvert }: {
  block: TextBlock;
  onChange: (content: InlineNode[]) => void;
  onConvert: (target: BlockConvertTarget) => void;
}) {
  const key = variantKey(block);
  return (
    <InlineEditor
      value={block.content}
      onChange={onChange}
      placeholder={PLACEHOLDER[key]}
      onConvert={onConvert}
      className={WRAPPER_CLASS[key]}
    />
  );
}
