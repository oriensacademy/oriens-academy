"use client";

import { useState, type ReactNode } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon, Link2, Heading2, Heading3, Quote, Check, X } from "lucide-react";
import type { InlineNode } from "@/lib/blog/blockSchema";

/**
 * A scoped, inline-only Tiptap instance -- the underlying Document node is
 * overridden to accept only inline content (text + marks), so this is a
 * single rich-text "run", never a full page editor. Used inside paragraph,
 * heading, quote and list-item blocks. See BLOG VISUAL BLOCK EDITOR V3 plan:
 * a JSON array of typed blocks, not one continuous ProseMirror document.
 */
const InlineDocument = Document.extend({ content: "inline*" });

const SAFE_LINK_PATTERN = /^(https?:\/\/|\/|#)/i;

function tiptapDocToInline(doc: JSONContent): InlineNode[] {
  const nodes: InlineNode[] = [];
  for (const child of doc.content || []) {
    if (child.type !== "text" || !child.text) continue;
    const marks: InlineNode["marks"] = [];
    for (const mark of child.marks || []) {
      if (mark.type === "bold") marks.push("bold");
      else if (mark.type === "italic") marks.push("italic");
      else if (mark.type === "underline") marks.push("underline");
      else if (mark.type === "link" && typeof mark.attrs?.href === "string") marks.push({ type: "link", href: mark.attrs.href });
    }
    nodes.push(marks.length ? { type: "text", text: child.text, marks } : { type: "text", text: child.text });
  }
  return nodes;
}

function inlineToTiptapContent(nodes: InlineNode[]): JSONContent[] {
  return nodes
    .filter((node) => node.text)
    .map((node) => ({
      type: "text",
      text: node.text,
      marks: node.marks?.length
        ? node.marks.map((mark) => (typeof mark === "string" ? { type: mark } : { type: "link", attrs: { href: mark.href } }))
        : undefined,
    }));
}

export type BlockConvertTarget = "paragraph" | "heading2" | "heading3" | "quote";

interface InlineEditorProps {
  value: InlineNode[];
  onChange: (nodes: InlineNode[]) => void;
  placeholder: string;
  onConvert?: (target: BlockConvertTarget) => void;
  className?: string;
}

export function InlineEditor({ value, onChange, placeholder, onConvert, className }: InlineEditorProps) {
  const [linkEditing, setLinkEditing] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const editor = useEditor({
    extensions: [
      InlineDocument,
      Text,
      Bold,
      Italic,
      Underline,
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder, emptyNodeClass: "before:text-muted-foreground before:opacity-70" }),
    ],
    content: { type: "doc", content: inlineToTiptapContent(value) },
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => onChange(tiptapDocToInline(instance.getJSON())),
    editorProps: {
      attributes: { class: "outline-none" },
    },
  });

  if (!editor) return <div className={className} />;

  function openLinkEditor() {
    const existing = editor!.getAttributes("link").href as string | undefined;
    setLinkDraft(existing || "https://");
    setLinkEditing(true);
  }

  function confirmLink() {
    const url = linkDraft.trim();
    if (url && SAFE_LINK_PATTERN.test(url)) {
      editor!.chain().focus().setLink({ href: url }).run();
    } else {
      editor!.chain().focus().unsetLink().run();
    }
    setLinkEditing(false);
  }

  return (
    <div className={className}>
      <BubbleMenu editor={editor} className="flex items-center gap-0.5 rounded-lg border border-[#10271B] bg-[#10271B] p-1 shadow-lg">
        {linkEditing ? (
          <div className="flex items-center gap-1 px-1">
            <input
              autoFocus
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); confirmLink(); }
                if (event.key === "Escape") setLinkEditing(false);
              }}
              placeholder="https://…"
              className="h-7 w-44 rounded-md border-0 bg-white/10 px-2 text-xs text-white placeholder:text-white/50 outline-none focus:bg-white/20"
            />
            <button type="button" onClick={confirmLink} className="flex size-6 items-center justify-center rounded text-white hover:bg-white/15"><Check className="size-3.5" /></button>
            <button type="button" onClick={() => setLinkEditing(false)} className="flex size-6 items-center justify-center rounded text-white hover:bg-white/15"><X className="size-3.5" /></button>
          </div>
        ) : (
          <>
            <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Kalın"><BoldIcon className="size-3.5" /></ToolbarButton>
            <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="İtalik"><ItalicIcon className="size-3.5" /></ToolbarButton>
            <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Altı çizili"><UnderlineIcon className="size-3.5" /></ToolbarButton>
            <ToolbarButton active={editor.isActive("link")} onClick={openLinkEditor} label="Link"><Link2 className="size-3.5" /></ToolbarButton>
            {onConvert ? (
              <>
                <span className="mx-0.5 h-4 w-px bg-white/20" />
                <ToolbarButton onClick={() => onConvert("heading2")} label="Başlık H2"><Heading2 className="size-3.5" /></ToolbarButton>
                <ToolbarButton onClick={() => onConvert("heading3")} label="Başlık H3"><Heading3 className="size-3.5" /></ToolbarButton>
                <ToolbarButton onClick={() => onConvert("quote")} label="Alıntı"><Quote className="size-3.5" /></ToolbarButton>
              </>
            ) : null}
          </>
        )}
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex size-7 items-center justify-center rounded text-white transition ${active ? "bg-white/25" : "hover:bg-white/15"}`}
    >
      {children}
    </button>
  );
}
