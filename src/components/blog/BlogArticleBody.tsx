import type { ReactNode } from "react";
import Image from "next/image";
import { FileText, Download, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import {
  sanitizeBlogContentJson,
  type BlogBlock,
  type BlockAlign,
  type BlockWidth,
  type CalloutTone,
  type ImageAspect,
  type ImageFit,
  type InlineNode,
  type PaneTextNode,
  type SplitPane,
  type SplitRatio,
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

/**
 * Every class below is a complete literal string. Tailwind's scanner cannot see
 * classes assembled at runtime, so ratios/aspects must never be interpolated.
 */
const SPLIT_RATIO_CLASS: Record<SplitRatio, [string, string]> = {
  "50-50": ["md:w-1/2", "md:w-1/2"],
  "40-60": ["md:w-2/5", "md:w-3/5"],
  "60-40": ["md:w-3/5", "md:w-2/5"],
};

const ASPECT_CLASS: Record<ImageAspect, string> = {
  auto: "",
  "16-9": "aspect-[16/9]",
  "4-3": "aspect-[4/3]",
  "1-1": "aspect-square",
  "3-4": "aspect-[3/4]",
};

const CALLOUT_CLASS: Record<CalloutTone, string> = {
  info: "border-primary/30 bg-primary/5 text-ink/85",
  success: "border-emerald-300 bg-emerald-50 text-emerald-950",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
};

const CALLOUT_ICON: Record<CalloutTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

const CALLOUT_ICON_CLASS: Record<CalloutTone, string> = {
  info: "text-primary",
  success: "text-emerald-700",
  warning: "text-amber-700",
};

function fitClass(fit: ImageFit): string {
  return fit === "contain" ? "object-contain" : "object-cover";
}

/** One image inside a side-by-side pane or a gallery cell. */
function FramedImage({
  url,
  alt,
  caption,
  fit,
  aspect,
}: {
  url: string;
  alt: string;
  caption: string;
  fit: ImageFit;
  aspect: ImageAspect;
}) {
  const aspectClass = ASPECT_CLASS[aspect];
  return (
    <figure className="w-full overflow-hidden rounded-2xl border border-border bg-surface-muted">
      {aspectClass ? (
        <div className={`relative w-full ${aspectClass}`}>
          <Image src={url} alt={alt || caption || ""} fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className={fitClass(fit)} />
        </div>
      ) : (
        <Image
          src={url}
          alt={alt || caption || ""}
          width={1200}
          height={800}
          unoptimized
          className={`h-auto w-full ${fitClass(fit)}`}
        />
      )}
      {caption ? <figcaption className="px-4 py-3 text-center text-xs text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

/** Bounded rich content of a side-by-side text pane. */
function PaneTextView({ nodes, idPrefix }: { nodes: PaneTextNode[]; idPrefix: string }) {
  return (
    <div>
      {nodes.map((node, index) => {
        const key = `${idPrefix}-${index}`;
        if (node.type === "heading") {
          const Tag = node.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={key}
              className={
                node.level === 2
                  ? "mb-3 font-heading text-2xl text-ink first:mt-0"
                  : "mb-2.5 font-heading text-xl text-ink first:mt-0"
              }
            >
              {renderInline(node.content, key)}
            </Tag>
          );
        }
        if (node.type === "paragraph") {
          return (
            <p key={key} className="mb-4 text-base leading-relaxed text-ink/85 last:mb-0">
              {renderInline(node.content, key)}
            </p>
          );
        }
        const ListTag = node.ordered ? "ol" : "ul";
        return (
          <ListTag
            key={key}
            className={
              node.ordered
                ? "mb-4 list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink/85 last:mb-0"
                : "mb-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-ink/85 last:mb-0"
            }
          >
            {node.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

function SplitPaneView({ pane, idPrefix }: { pane: SplitPane; idPrefix: string }) {
  if (pane.kind === "image") {
    return <FramedImage url={pane.url} alt={pane.alt} caption={pane.caption} fit={pane.fit} aspect={pane.aspect} />;
  }
  return <PaneTextView nodes={pane.nodes} idPrefix={idPrefix} />;
}

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
      const aspectClass = ASPECT_CLASS[block.aspect];
      return (
        <figure className={`my-7 w-full overflow-hidden rounded-2xl border border-border bg-surface-muted ${widthClass} ${wrapClass}`}>
          {aspectClass ? (
            <div className={`relative w-full ${aspectClass}`}>
              <Image
                src={block.url}
                alt={block.alt || block.caption || "Blog görseli"}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 760px"
                className={fitClass(block.fit)}
              />
            </div>
          ) : (
            <Image
              src={block.url}
              alt={block.alt || block.caption || "Blog görseli"}
              width={1400}
              height={900}
              unoptimized
              className={`h-auto w-full ${fitClass(block.fit)}`}
            />
          )}
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
    case "callout": {
      const Icon = CALLOUT_ICON[block.tone];
      return (
        <div className={`my-7 flex gap-3 rounded-2xl border p-4 sm:p-5 clear-both ${CALLOUT_CLASS[block.tone]}`}>
          <Icon className={`mt-0.5 size-5 shrink-0 ${CALLOUT_ICON_CLASS[block.tone]}`} aria-hidden="true" />
          <div className="min-w-0 flex-1 text-base leading-relaxed">{renderInline(block.content, block.id)}</div>
        </div>
      );
    }
    case "split": {
      const ratio = SPLIT_RATIO_CLASS[block.ratio];
      // Mobile is always a single column in DOM order, so "Görsel Solda"
      // stacks image-then-text and "Yazı Solda" stacks text-then-image.
      return (
        <div
          className={`my-8 flex flex-col gap-6 clear-both md:flex-row md:gap-8 ${
            block.valign === "center" ? "md:items-center" : "md:items-start"
          }`}
        >
          <div className={`w-full min-w-0 ${ratio[0]}`}>
            <SplitPaneView pane={block.left} idPrefix={`${block.id}-l`} />
          </div>
          <div className={`w-full min-w-0 ${ratio[1]}`}>
            <SplitPaneView pane={block.right} idPrefix={`${block.id}-r`} />
          </div>
        </div>
      );
    }
    case "gallery":
      return (
        <div
          className={`my-8 grid grid-cols-1 gap-4 clear-both sm:gap-5 ${
            block.columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
          {block.items.map((item) => (
            <FramedImage key={item.id} url={item.url} alt={item.alt} caption={item.caption} fit="cover" aspect="4-3" />
          ))}
        </div>
      );
    case "cta":
      return (
        <div className="my-9 rounded-3xl border border-primary/25 bg-primary/5 p-6 text-center clear-both sm:p-8">
          {block.title ? <h2 className="font-heading text-2xl text-ink">{block.title}</h2> : null}
          {block.description ? (
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-ink/80">{block.description}</p>
          ) : null}
          {block.buttonLabel && block.buttonUrl ? (
            <div className="mt-6">
              <ButtonLink href={block.buttonUrl} size="lg" className="min-h-12">
                {block.buttonLabel}
              </ButtonLink>
            </div>
          ) : null}
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
