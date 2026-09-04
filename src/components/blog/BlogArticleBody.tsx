import type { ReactNode } from "react";
import Image from "next/image";
import { FileText, Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import {
  sanitizeBlogContentJson,
  type BlogBlock,
  type BlockAlign,
  type BlockWidth,
  type InlineNode,
} from "@/lib/blog/blockSchema";

/**
 * Shared, safe renderer for block-based blog content -- used by both the
 * public article page and the admin draft preview, so what the author sees
 * in "Önizle" is exactly what ships (spec §16/§17). Re-validates the blob it
 * is given (sanitizeBlogContentJson) rather than trusting the caller, since
 * this also renders content fetched straight from the public REST endpoint.
 */

const WIDTH_CLASS: Record<BlockWidth, string> = {
  25: "md:w-1/4",
  50: "md:w-1/2",
  75: "md:w-3/4",
  100: "md:w-full",
};

const ALIGN_WRAP_CLASS: Record<BlockAlign, string> = {
  left: "md:float-left md:mr-7 md:mb-3",
  right: "md:float-right md:ml-7 md:mb-3",
  center: "mx-auto",
  full: "",
};

const ALIGN_BLOCK_CLASS: Record<BlockAlign, string> = {
  left: "",
  right: "ml-auto",
  center: "mx-auto",
  full: "",
};

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    let element: ReactNode = node.text;
    const link = node.marks?.find((mark): mark is { type: "link"; href: string } => typeof mark === "object");
    const isBold = node.marks?.includes("bold");
    const isItalic = node.marks?.includes("italic");
    const isUnderline = node.marks?.includes("underline");
    if (isUnderline) element = <u>{element}</u>;
    if (isItalic) element = <em>{element}</em>;
    if (isBold) element = <strong>{element}</strong>;
    if (link) {
      element = (
        <a
          href={link.href}
          target={link.href.startsWith("http") ? "_blank" : undefined}
          rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {element}
        </a>
      );
    }
    return <span key={key}>{element}</span>;
  });
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function BlockView({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="mb-5 text-base leading-relaxed text-ink/85">{renderInline(block.content, block.id)}</p>;
    case "heading": {
      const Tag = block.level === 2 ? "h2" : "h3";
      const className =
        block.level === 2
          ? "mt-9 mb-4 font-heading text-2xl text-ink first:mt-0 clear-both"
          : "mt-7 mb-3 font-heading text-xl text-ink first:mt-0 clear-both";
      return <Tag className={className}>{renderInline(block.content, block.id)}</Tag>;
    }
    case "quote":
      return (
        <blockquote className="my-7 border-l-4 border-primary/40 bg-surface-muted/60 py-3 pl-5 pr-4 text-base italic leading-relaxed text-ink/80 clear-both">
          {renderInline(block.content, block.id)}
        </blockquote>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={
            block.ordered
              ? "mb-5 list-decimal space-y-2 pl-6 text-base leading-relaxed text-ink/85 clear-both"
              : "mb-5 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink/85 clear-both"
          }
        >
          {block.items.map((item, index) => (
            <li key={`${block.id}-${index}`}>{renderInline(item, `${block.id}-${index}`)}</li>
          ))}
        </ListTag>
      );
    }
    case "divider":
      return <hr className="my-9 border-border clear-both" />;
    case "spacer": {
      const height = block.size === "sm" ? "h-4" : block.size === "lg" ? "h-16" : "h-9";
      return <div className={`${height} clear-both`} aria-hidden="true" />;
    }
    case "image": {
      const wrapClass = block.wrap && block.align !== "full" ? ALIGN_WRAP_CLASS[block.align] : ALIGN_BLOCK_CLASS[block.align];
      const widthClass = block.align === "full" ? "md:w-full" : WIDTH_CLASS[block.width];
      return (
        <figure className={`my-7 w-full overflow-hidden rounded-2xl border border-border bg-surface-muted ${widthClass} ${wrapClass}`}>
          <Image
            src={block.url}
            alt={block.alt || block.caption || "Blog görseli"}
            width={1400}
            height={900}
            unoptimized
            className="h-auto w-full object-cover"
          />
          {block.caption ? <figcaption className="px-4 py-3 text-center text-xs text-muted-foreground">{block.caption}</figcaption> : null}
        </figure>
      );
    }
    case "file":
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="my-7 flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-xs transition hover:border-primary/40 hover:bg-surface-muted/40 clear-both"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{block.name}</span>
            {block.size ? <span className="block text-xs text-muted-foreground">{formatFileSize(block.size)}</span> : null}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary">
            <Download className="size-3.5" />
            Dosyayı Görüntüle
          </span>
        </a>
      );
    case "button":
      return (
        <div className="my-7 clear-both">
          <ButtonLink href={block.url} variant={block.style === "primary" ? "default" : "outline"} size="lg" className="min-h-12">
            {block.label}
          </ButtonLink>
        </div>
      );
    default:
      return null;
  }
}

export function BlogArticleBody({ content }: { content: unknown }) {
  const safe = sanitizeBlogContentJson(content);
  if (!safe) return null;
  return (
    <div>
      {safe.blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  );
}
