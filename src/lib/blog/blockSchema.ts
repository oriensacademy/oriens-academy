/**
 * Structured block content for the visual blog editor (spec: BLOG VISUAL BLOCK
 * EDITOR V3). Stored as `blog_posts.content_json`. Legacy Markdown posts have
 * `content_json = null` and keep rendering through `renderBlogMarkdown`
 * (src/lib/blog/markdown.tsx) -- this module never touches that path.
 *
 * Nothing here is ever rendered via dangerouslySetInnerHTML. Every node is a
 * plain, typed JS value turned into JSX by the renderer -- there is no HTML
 * string anywhere in the model, so script/tag injection is not structurally
 * possible as long as callers keep using the renderer instead of raw HTML.
 */

export type InlineMark = "bold" | "italic" | "underline" | { type: "link"; href: string };

export interface InlineNode {
  type: "text";
  text: string;
  marks?: InlineMark[];
}

export type BlockAlign = "left" | "center" | "right" | "full";
export type BlockWidth = 25 | 50 | 75 | 100;
export type SpacerSize = "sm" | "md" | "lg";
export type ButtonStyle = "primary" | "secondary";

/** How an image fills its frame. `cover` crops to fill, `contain` letterboxes. */
export type ImageFit = "cover" | "contain";
/** Fixed frame proportion; `auto` keeps the file's own aspect ratio. */
export type ImageAspect = "auto" | "16-9" | "4-3" | "1-1" | "3-4";
/** Desktop column split for side-by-side blocks. Always stacks on mobile. */
export type SplitRatio = "50-50" | "40-60" | "60-40";
/** Vertical alignment of the two panes of a side-by-side block. */
export type SplitVAlign = "top" | "center";
/**
 * Authoring intent of a side-by-side block. The pane kinds are derived from
 * (and coerced to match) this value, so "Yazı Solda — Görsel Sağda" can never
 * silently end up holding two images.
 */
export type SplitVariant = "text-image" | "image-text" | "text-text";
export type CalloutTone = "info" | "success" | "warning";
export type GalleryColumns = 2 | 3;

/** The bounded set of rich nodes a side-by-side text pane may contain. */
export type PaneTextNode =
  | { type: "heading"; level: 2 | 3; content: InlineNode[] }
  | { type: "paragraph"; content: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] };

export interface PaneImage {
  url: string;
  alt: string;
  caption: string;
  fit: ImageFit;
  aspect: ImageAspect;
}

export type SplitPane =
  | { kind: "text"; nodes: PaneTextNode[] }
  | ({ kind: "image" } & PaneImage);

export interface GalleryItem {
  id: string;
  url: string;
  alt: string;
  caption: string;
}

export type BlogBlock =
  | { id: string; type: "paragraph"; content: InlineNode[] }
  | { id: string; type: "heading"; level: 2 | 3; content: InlineNode[] }
  | { id: string; type: "quote"; content: InlineNode[] }
  | { id: string; type: "list"; ordered: boolean; items: InlineNode[][] }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size: SpacerSize }
  | {
      id: string;
      type: "image";
      url: string;
      alt: string;
      caption: string;
      align: BlockAlign;
      width: BlockWidth;
      wrap: boolean;
      fit: ImageFit;
      aspect: ImageAspect;
    }
  | { id: string; type: "file"; url: string; name: string; size: number }
  | { id: string; type: "button"; label: string; url: string; style: ButtonStyle }
  | { id: string; type: "callout"; tone: CalloutTone; content: InlineNode[] }
  | {
      id: string;
      type: "split";
      variant: SplitVariant;
      ratio: SplitRatio;
      valign: SplitVAlign;
      left: SplitPane;
      right: SplitPane;
    }
  | { id: string; type: "gallery"; columns: GalleryColumns; items: GalleryItem[] }
  | {
      id: string;
      type: "cta";
      title: string;
      description: string;
      buttonLabel: string;
      buttonUrl: string;
    };

export interface BlogContentJson {
  version: 1;
  blocks: BlogBlock[];
}

/** Same allowlist the legacy Markdown renderer uses for links (http(s)/relative/hash only). */
const SAFE_URL_PATTERN = /^(https?:\/\/|\/|#)/i;
/** Image/file URLs only ever come from our own upload flow -- https only, no data:/javascript:. */
const SAFE_MEDIA_URL_PATTERN = /^https:\/\//i;

export function newBlockId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeUrl(value: unknown, pattern: RegExp): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !pattern.test(trimmed)) return null;
  return trimmed;
}

function sanitizeInlineNodes(raw: unknown): InlineNode[] {
  if (!Array.isArray(raw)) return [];
  const nodes: InlineNode[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (candidate.type !== "text" || typeof candidate.text !== "string") continue;
    if (!candidate.text) continue;
    const marks: InlineMark[] = [];
    if (Array.isArray(candidate.marks)) {
      for (const mark of candidate.marks) {
        if (mark === "bold" || mark === "italic" || mark === "underline") {
          marks.push(mark);
        } else if (mark && typeof mark === "object" && (mark as { type?: unknown }).type === "link") {
          const href = sanitizeUrl((mark as { href?: unknown }).href, SAFE_URL_PATTERN);
          if (href) marks.push({ type: "link", href });
        }
      }
    }
    nodes.push(marks.length ? { type: "text", text: candidate.text, marks } : { type: "text", text: candidate.text });
  }
  return nodes;
}

function inlineTextLength(nodes: InlineNode[]): number {
  return nodes.reduce((sum, node) => sum + node.text.length, 0);
}

const SPACER_SIZES = new Set<SpacerSize>(["sm", "md", "lg"]);
const ALIGNS = new Set<BlockAlign>(["left", "center", "right", "full"]);
const WIDTHS = new Set<BlockWidth>([25, 50, 75, 100]);
const BUTTON_STYLES = new Set<ButtonStyle>(["primary", "secondary"]);
const IMAGE_FITS = new Set<ImageFit>(["cover", "contain"]);
const IMAGE_ASPECTS = new Set<ImageAspect>(["auto", "16-9", "4-3", "1-1", "3-4"]);
const SPLIT_RATIOS = new Set<SplitRatio>(["50-50", "40-60", "60-40"]);
const SPLIT_VALIGNS = new Set<SplitVAlign>(["top", "center"]);
const SPLIT_VARIANTS = new Set<SplitVariant>(["text-image", "image-text", "text-text"]);
const CALLOUT_TONES = new Set<CalloutTone>(["info", "success", "warning"]);

function pickFit(value: unknown): ImageFit {
  return IMAGE_FITS.has(value as ImageFit) ? (value as ImageFit) : "cover";
}

function pickAspect(value: unknown): ImageAspect {
  return IMAGE_ASPECTS.has(value as ImageAspect) ? (value as ImageAspect) : "auto";
}

function trimmedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Bounded rich content for one half of a side-by-side block. */
function sanitizePaneTextNodes(raw: unknown): PaneTextNode[] {
  if (!Array.isArray(raw)) return [];
  const nodes: PaneTextNode[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const node = item as Record<string, unknown>;
    if (node.type === "heading") {
      const content = sanitizeInlineNodes(node.content);
      if (!inlineTextLength(content)) continue;
      nodes.push({ type: "heading", level: node.level === 3 ? 3 : 2, content });
    } else if (node.type === "paragraph") {
      const content = sanitizeInlineNodes(node.content);
      if (!inlineTextLength(content)) continue;
      nodes.push({ type: "paragraph", content });
    } else if (node.type === "list") {
      const items = Array.isArray(node.items)
        ? node.items.map((entry) => sanitizeInlineNodes(entry)).filter((entry) => inlineTextLength(entry) > 0)
        : [];
      if (!items.length) continue;
      nodes.push({ type: "list", ordered: node.ordered === true, items });
    }
  }
  return nodes;
}

function sanitizePaneImage(raw: unknown): ({ kind: "image" } & PaneImage) | null {
  if (!raw || typeof raw !== "object") return null;
  const pane = raw as Record<string, unknown>;
  const url = sanitizeUrl(pane.url, SAFE_MEDIA_URL_PATTERN);
  if (!url) return null;
  return {
    kind: "image",
    url,
    alt: trimmedText(pane.alt, 300),
    caption: trimmedText(pane.caption, 300),
    fit: pickFit(pane.fit),
    aspect: pickAspect(pane.aspect),
  };
}

/**
 * Coerces a stored pane to the kind the block's `variant` demands. A text pane
 * that is missing degrades to an empty text pane rather than being dropped, so
 * the block keeps its shape and the author can refill it.
 */
function sanitizeSplitPane(raw: unknown, expected: "text" | "image"): SplitPane | null {
  if (expected === "image") return sanitizePaneImage(raw);
  const pane = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { kind: "text", nodes: sanitizePaneTextNodes(pane.nodes) };
}

function paneKinds(variant: SplitVariant): ["text" | "image", "text" | "image"] {
  if (variant === "text-image") return ["text", "image"];
  if (variant === "image-text") return ["image", "text"];
  return ["text", "text"];
}

function sanitizeBlock(raw: unknown): BlogBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const block = raw as Record<string, unknown>;
  const id = typeof block.id === "string" && block.id ? block.id : newBlockId();

  switch (block.type) {
    case "paragraph": {
      const content = sanitizeInlineNodes(block.content);
      if (!inlineTextLength(content)) return null;
      return { id, type: "paragraph", content };
    }
    case "heading": {
      const content = sanitizeInlineNodes(block.content);
      if (!inlineTextLength(content)) return null;
      const level = block.level === 3 ? 3 : 2;
      return { id, type: "heading", level, content };
    }
    case "quote": {
      const content = sanitizeInlineNodes(block.content);
      if (!inlineTextLength(content)) return null;
      return { id, type: "quote", content };
    }
    case "list": {
      const items = Array.isArray(block.items)
        ? block.items.map((item) => sanitizeInlineNodes(item)).filter((item) => inlineTextLength(item) > 0)
        : [];
      if (!items.length) return null;
      return { id, type: "list", ordered: block.ordered === true, items };
    }
    case "divider":
      return { id, type: "divider" };
    case "spacer": {
      const size = SPACER_SIZES.has(block.size as SpacerSize) ? (block.size as SpacerSize) : "md";
      return { id, type: "spacer", size };
    }
    case "image": {
      const url = sanitizeUrl(block.url, SAFE_MEDIA_URL_PATTERN);
      if (!url) return null;
      return {
        id,
        type: "image",
        url,
        alt: typeof block.alt === "string" ? block.alt.slice(0, 300) : "",
        caption: typeof block.caption === "string" ? block.caption.slice(0, 300) : "",
        align: ALIGNS.has(block.align as BlockAlign) ? (block.align as BlockAlign) : "center",
        width: WIDTHS.has(block.width as BlockWidth) ? (block.width as BlockWidth) : 100,
        wrap: block.wrap === true,
        fit: pickFit(block.fit),
        aspect: pickAspect(block.aspect),
      };
    }
    case "file": {
      const url = sanitizeUrl(block.url, SAFE_MEDIA_URL_PATTERN);
      if (!url) return null;
      const name = typeof block.name === "string" && block.name.trim() ? block.name.trim().slice(0, 200) : "Dosya";
      const size = typeof block.size === "number" && Number.isFinite(block.size) && block.size >= 0 ? block.size : 0;
      return { id, type: "file", url, name, size };
    }
    case "button": {
      const url = sanitizeUrl(block.url, SAFE_URL_PATTERN);
      const label = typeof block.label === "string" ? block.label.trim().slice(0, 80) : "";
      if (!url || !label) return null;
      const style = BUTTON_STYLES.has(block.style as ButtonStyle) ? (block.style as ButtonStyle) : "primary";
      return { id, type: "button", label, url, style };
    }
    case "callout": {
      const content = sanitizeInlineNodes(block.content);
      if (!inlineTextLength(content)) return null;
      const tone = CALLOUT_TONES.has(block.tone as CalloutTone) ? (block.tone as CalloutTone) : "info";
      return { id, type: "callout", tone, content };
    }
    case "split": {
      const variant = SPLIT_VARIANTS.has(block.variant as SplitVariant)
        ? (block.variant as SplitVariant)
        : "text-image";
      const kinds = paneKinds(variant);
      const left = sanitizeSplitPane(block.left, kinds[0]);
      const right = sanitizeSplitPane(block.right, kinds[1]);
      // An image pane with no usable URL (still uploading, or a broken legacy
      // row) would render as a hole -- drop the whole block instead.
      if (!left || !right) return null;
      const bothTextEmpty =
        left.kind === "text" && !left.nodes.length && right.kind === "text" && !right.nodes.length;
      if (bothTextEmpty) return null;
      return {
        id,
        type: "split",
        variant,
        ratio: SPLIT_RATIOS.has(block.ratio as SplitRatio) ? (block.ratio as SplitRatio) : "50-50",
        valign: SPLIT_VALIGNS.has(block.valign as SplitVAlign) ? (block.valign as SplitVAlign) : "top",
        left,
        right,
      };
    }
    case "gallery": {
      const rawItems = Array.isArray(block.items) ? block.items : [];
      const items: GalleryItem[] = [];
      for (const entry of rawItems) {
        if (!entry || typeof entry !== "object") continue;
        const item = entry as Record<string, unknown>;
        const url = sanitizeUrl(item.url, SAFE_MEDIA_URL_PATTERN);
        if (!url) continue;
        items.push({
          id: typeof item.id === "string" && item.id ? item.id : newBlockId(),
          url,
          alt: trimmedText(item.alt, 300),
          caption: trimmedText(item.caption, 300),
        });
      }
      if (!items.length) return null;
      return { id, type: "gallery", columns: block.columns === 3 ? 3 : 2, items };
    }
    case "cta": {
      const title = trimmedText(block.title, 160).trim();
      const description = trimmedText(block.description, 500).trim();
      const buttonLabel = trimmedText(block.buttonLabel, 80).trim();
      const buttonUrl = sanitizeUrl(block.buttonUrl, SAFE_URL_PATTERN);
      if (!title && !description && !buttonLabel) return null;
      const hasButton = Boolean(buttonUrl && buttonLabel);
      return {
        id,
        type: "cta",
        title,
        description,
        buttonLabel: hasButton ? buttonLabel : "",
        buttonUrl: hasButton ? (buttonUrl as string) : "",
      };
    }
    default:
      return null;
  }
}

/**
 * Validates and strips an arbitrary value down to a safe BlogContentJson, or
 * null if it doesn't look like block content at all (legacy/empty posts).
 * Called both before persisting a draft and again when the public renderer
 * reads content back -- a stored blob is never trusted as already-safe.
 */
export function sanitizeBlogContentJson(raw: unknown): BlogContentJson | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.blocks)) return null;
  const blocks = value.blocks.map((block) => sanitizeBlock(block)).filter((block): block is BlogBlock => block !== null);
  if (!blocks.length) return null;
  return { version: 1, blocks };
}

function inlineToPlainText(nodes: InlineNode[]): string {
  return nodes.map((node) => node.text).join("");
}

/**
 * Derives a plain-text fallback for the legacy `content` column (NOT NULL,
 * length-checked) so posts authored in the block editor still satisfy that
 * constraint and remain searchable by any future full-text use of `content`.
 * This text is never used to render the post once content_json is present.
 */
export function deriveLegacyContentFallback(content: BlogContentJson): string {
  const lines: string[] = [];

  const pushPaneNodes = (nodes: PaneTextNode[]) => {
    for (const node of nodes) {
      if (node.type === "heading") lines.push(`${"#".repeat(node.level)} ${inlineToPlainText(node.content)}`);
      else if (node.type === "paragraph") lines.push(inlineToPlainText(node.content));
      else for (const item of node.items) lines.push(`- ${inlineToPlainText(item)}`);
    }
  };

  for (const block of content.blocks) {
    switch (block.type) {
      case "paragraph":
      case "quote":
      case "callout":
        lines.push(inlineToPlainText(block.content));
        break;
      case "heading":
        lines.push(`${"#".repeat(block.level)} ${inlineToPlainText(block.content)}`);
        break;
      case "list":
        for (const item of block.items) lines.push(`- ${inlineToPlainText(item)}`);
        break;
      case "button":
        lines.push(block.label);
        break;
      case "split":
        for (const pane of [block.left, block.right]) {
          if (pane.kind === "text") pushPaneNodes(pane.nodes);
          else if (pane.caption) lines.push(pane.caption);
        }
        break;
      case "gallery":
        for (const item of block.items) if (item.caption) lines.push(item.caption);
        break;
      case "cta":
        if (block.title) lines.push(block.title);
        if (block.description) lines.push(block.description);
        if (block.buttonLabel) lines.push(block.buttonLabel);
        break;
      default:
        break;
    }
  }
  const text = lines.join("\n\n").trim();
  // `blog_posts.content` is NOT NULL with a 1..50000 length CHECK, so this must
  // never be empty and never exceed the cap.
  return text ? text.slice(0, 50000) : " ";
}

export function isBlogContentEmpty(content: BlogContentJson | null | undefined): boolean {
  return !content || content.blocks.length === 0;
}
