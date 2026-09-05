"use client";

import { useRef } from "react";
import Image from "next/image";
import { Heading2, Heading3, List, Plus, RefreshCw, Trash2, Type } from "lucide-react";
import { InlineEditor } from "./InlineEditor";
import type {
  ImageAspect,
  ImageFit,
  InlineNode,
  PaneImage,
  PaneTextNode,
} from "@/lib/blog/blockSchema";

/**
 * Shared building blocks for the side-by-side ("split") and gallery editors:
 * a bounded rich-text pane and an image pane with its framing controls.
 * Deliberately not a free-form page builder -- the author picks from a small,
 * predictable set of options that the public renderer can lay out reliably.
 */

export const FIT_OPTIONS: { value: ImageFit; label: string }[] = [
  { value: "cover", label: "Alanı doldur" },
  { value: "contain", label: "Tamamı görünsün" },
];

export const ASPECT_OPTIONS: { value: ImageAspect; label: string }[] = [
  { value: "auto", label: "Orijinal" },
  { value: "16-9", label: "16:9" },
  { value: "4-3", label: "4:3" },
  { value: "1-1", label: "Kare" },
  { value: "3-4", label: "Dikey" },
];

const NODE_BUTTONS: { type: PaneTextNode["type"]; level?: 2 | 3; label: string; icon: typeof Type }[] = [
  { type: "paragraph", label: "Paragraf", icon: Type },
  { type: "heading", level: 2, label: "Başlık", icon: Heading2 },
  { type: "heading", level: 3, label: "Alt Başlık", icon: Heading3 },
  { type: "list", label: "Liste", icon: List },
];

function emptyPaneNode(type: PaneTextNode["type"], level: 2 | 3 = 2): PaneTextNode {
  if (type === "heading") return { type: "heading", level, content: [] };
  if (type === "list") return { type: "list", ordered: false, items: [[]] };
  return { type: "paragraph", content: [] };
}

export function PaneTextEditor({
  nodes,
  onChange,
  label,
}: {
  nodes: PaneTextNode[];
  onChange: (next: PaneTextNode[]) => void;
  label: string;
}) {
  function updateNode(index: number, next: PaneTextNode) {
    onChange(nodes.map((node, i) => (i === index ? next : node)));
  }
  function removeNode(index: number) {
    onChange(nodes.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-xl border border-input bg-white p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>

      <div className="space-y-2.5">
        {nodes.map((node, index) => (
          <div key={index} className="group/node flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              {node.type === "list" ? (
                <PaneListEditor node={node} onChange={(next) => updateNode(index, next)} />
              ) : (
                <InlineEditor
                  value={node.content}
                  onChange={(content: InlineNode[]) => updateNode(index, { ...node, content })}
                  placeholder={
                    node.type === "heading"
                      ? node.level === 2
                        ? "Başlık"
                        : "Alt başlık"
                      : "Metin…"
                  }
                  className={
                    node.type === "heading"
                      ? node.level === 2
                        ? "font-heading text-xl text-ink"
                        : "font-heading text-base text-ink"
                      : "text-sm leading-relaxed text-ink/90"
                  }
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => removeNode(index)}
              aria-label="Bu parçayı sil"
              className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover/node:opacity-100"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>

      {!nodes.length ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">
          Bu sütun henüz boş. Aşağıdan bir parça ekleyin.
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1 border-t border-border pt-2.5">
        {NODE_BUTTONS.map(({ type, level, label: nodeLabel, icon: Icon }) => (
          <button
            key={`${type}-${level ?? ""}`}
            type="button"
            onClick={() => onChange([...nodes, emptyPaneNode(type, level)])}
            className="inline-flex items-center gap-1 rounded-lg border border-input px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="size-3" />
            <Icon className="size-3" />
            {nodeLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaneListEditor({
  node,
  onChange,
}: {
  node: Extract<PaneTextNode, { type: "list" }>;
  onChange: (next: PaneTextNode) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => onChange({ ...node, ordered: false })}
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${!node.ordered ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          Madde işaretli
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...node, ordered: true })}
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${node.ordered ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          Numaralı
        </button>
      </div>
      <ul className={node.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
        {node.items.map((item, index) => (
          <li key={index} className="group/item flex items-start gap-1">
            <InlineEditor
              value={item}
              onChange={(content) =>
                onChange({ ...node, items: node.items.map((entry, i) => (i === index ? content : entry)) })
              }
              placeholder="Madde…"
              className="flex-1 text-sm leading-relaxed text-ink/90"
            />
            <button
              type="button"
              onClick={() => {
                const items = node.items.filter((_, i) => i !== index);
                onChange({ ...node, items: items.length ? items : [[]] });
              }}
              aria-label="Maddeyi sil"
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-red-600 group-hover/item:opacity-100"
            >
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange({ ...node, items: [...node.items, []] })}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
      >
        <Plus className="size-3" />
        Madde ekle
      </button>
    </div>
  );
}

export function PaneImageEditor({
  pane,
  onChange,
  onReplace,
  uploading,
  label,
}: {
  pane: PaneImage;
  onChange: (next: PaneImage) => void;
  onReplace: (file: File) => void;
  uploading: boolean;
  label: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-input bg-white p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>

      <div className="relative overflow-hidden rounded-lg border border-border bg-surface-muted">
        <Image
          src={pane.url}
          alt={pane.alt || ""}
          width={800}
          height={600}
          unoptimized
          className={`h-44 w-full ${pane.fit === "contain" ? "object-contain" : "object-cover"}`}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Görseli değiştir"
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${uploading ? "animate-spin" : ""}`} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onReplace(file);
            event.currentTarget.value = "";
          }}
        />
      </div>

      <div className="mt-2.5 space-y-2.5">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Görsel Davranışı</p>
          <div className="flex flex-wrap gap-1">
            {FIT_OPTIONS.map(({ value, label: optionLabel }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...pane, fit: value })}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${pane.fit === value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
              >
                {optionLabel}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Oran</p>
          <div className="flex flex-wrap gap-1">
            {ASPECT_OPTIONS.map(({ value, label: optionLabel }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...pane, aspect: value })}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${pane.aspect === value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
              >
                {optionLabel}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-[11px] font-bold text-muted-foreground">
          Alt Metni
          <input
            value={pane.alt}
            onChange={(event) => onChange({ ...pane, alt: event.target.value })}
            placeholder="Görselin kısa açıklaması (SEO / erişilebilirlik)"
            className="mt-1 h-9 w-full rounded-lg border border-input px-2.5 text-xs font-normal text-ink"
          />
        </label>
        <label className="block text-[11px] font-bold text-muted-foreground">
          Açıklama
          <input
            value={pane.caption}
            onChange={(event) => onChange({ ...pane, caption: event.target.value })}
            placeholder="Görsel altında görünecek yazı (opsiyonel)"
            className="mt-1 h-9 w-full rounded-lg border border-input px-2.5 text-xs font-normal text-ink"
          />
        </label>
      </div>
    </div>
  );
}
