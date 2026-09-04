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
    }
  | { id: string; type: "file"; url: string; name: string; size: number }
  | { id: string; type: "button"; label: string; url: string; style: ButtonStyle };

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
  for (const block of content.blocks) {
    switch (block.type) {
      case "paragraph":
      case "quote":
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
      default:
        break;
    }
  }
  const text = lines.join("\n\n").trim();
  return text || " ";
}

export function isBlogContentEmpty(content: BlogContentJson | null | undefined): boolean {
  return !content || content.blocks.length === 0;
}
