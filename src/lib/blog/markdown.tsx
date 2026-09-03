import type { ReactNode } from "react";

/**
 * Minimal, safe Markdown-to-JSX renderer for blog post bodies.
 *
 * Deliberately does NOT support raw HTML passthrough: everything is built as
 * React elements/text nodes (never dangerouslySetInnerHTML), so arbitrary
 * markup in stored content can never execute as HTML/script. Supports only
 * headings, paragraphs, bold/italic, links (http(s)/relative only), and
 * bullet/numbered lists -- enough for editorial blog content without a
 * markdown library dependency.
 */

const SAFE_LINK_PATTERN = /^(https?:\/\/|\/|#)/i;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: links first, then bold, then italic, applied as a single
  // left-to-right scan so nested/overlapping matches don't double-process.
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [, linkText, linkHref, boldText, italicText] = match;
    if (linkText !== undefined) {
      const safeHref = SAFE_LINK_PATTERN.test(linkHref) ? linkHref : "#";
      nodes.push(
        <a
          key={`${keyPrefix}-l-${i++}`}
          href={safeHref}
          target={safeHref.startsWith("http") ? "_blank" : undefined}
          rel={safeHref.startsWith("http") ? "noopener noreferrer" : undefined}
          className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {linkText}
        </a>
      );
    } else if (boldText !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i++}`}>{boldText}</strong>);
    } else if (italicText !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i-${i++}`}>{italicText}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function renderBlogMarkdown(content: string): ReactNode[] {
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    if (text) {
      blocks.push(
        <p key={`p-${key++}`} className="mb-5 text-base leading-relaxed text-ink/85">
          {renderInline(text, `p${key}`)}
        </p>
      );
    }
    paragraphBuffer = [];
  }

  function flushList() {
    if (!listBuffer) return;
    const { ordered, items } = listBuffer;
    const ListTag = ordered ? "ol" : "ul";
    blocks.push(
      <ListTag key={`list-${key++}`} className={ordered ? "mb-5 list-decimal space-y-2 pl-6 text-base leading-relaxed text-ink/85" : "mb-5 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink/85"}>
        {items.map((item, idx) => (
          <li key={idx}>{renderInline(item, `li${key}-${idx}`)}</li>
        ))}
      </ListTag>
    );
    listBuffer = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const className =
        level === 1
          ? "mt-8 mb-4 font-heading text-2xl text-ink first:mt-0"
          : level === 2
            ? "mt-7 mb-3 font-heading text-xl text-ink first:mt-0"
            : "mt-6 mb-2 font-heading text-lg text-ink first:mt-0";
      const HeadingTag = level === 1 ? "h2" : level === 2 ? "h3" : "h4"; // post title itself is the page h1
      blocks.push(
        <HeadingTag key={`h-${key++}`} className={className}>
          {renderInline(text, `h${key}`)}
        </HeadingTag>
      );
      continue;
    }

    const bulletMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph();
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      flushParagraph();
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(orderedMatch[1]);
      continue;
    }

    flushList();
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}
