/**
 * Blog Editor V2 acceptance suite.
 *
 * Two layers, both offline -- no database, no network, no published content:
 *   1. Behavioural: compiles src/lib/blog/blockSchema.ts (dependency-free) and
 *      exercises the real sanitizer/round-trip logic for every block type.
 *   2. Structural: asserts the canonical renderer and the editor both handle
 *      every block type in the schema union, so adding a block type can never
 *      silently ship without a renderer (which is what "preview differs from
 *      production" always turns out to be).
 *
 *   node scripts/test-blog-editor-v2.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
/** Source with comments removed -- assertions about code must not match prose. */
const readCode = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

let passed = 0;
const failures = [];
function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("  FAIL  " + name + (detail ? " -- " + detail : ""));
  }
}

// ---------------------------------------------------------------------------
// Compile the schema module on its own. It imports nothing, so plain tsc with
// no project config produces runnable ESM.
// ---------------------------------------------------------------------------
const outDir = mkdtempSync(path.join(tmpdir(), "blogschema-"));
execFileSync(
  process.execPath,
  [
    path.join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    "src/lib/blog/blockSchema.ts",
    "--outDir",
    outDir,
    "--module",
    "esnext",
    "--target",
    "es2022",
    "--moduleResolution",
    "bundler",
    "--skipLibCheck",
  ],
  { cwd: ROOT, stdio: "pipe" }
);
const schema = await import(pathToFileURL(path.join(outDir, "blockSchema.js")).href);
const { sanitizeBlogContentJson, deriveLegacyContentFallback, newBlockId } = schema;

const wrap = (blocks) => sanitizeBlogContentJson({ version: 1, blocks });
const text = (value) => [{ type: "text", text: value }];
const IMG = "https://cdn.example.com/a.jpg";

console.log("\n[1] TEXT BLOCKS");
{
  const out = wrap([
    { id: "a", type: "heading", level: 2, content: text("Başlık") },
    { id: "b", type: "heading", level: 3, content: text("Alt") },
    { id: "c", type: "paragraph", content: text("Paragraf") },
    { id: "d", type: "list", ordered: false, items: [text("bir"), text("iki")] },
    { id: "e", type: "list", ordered: true, items: [text("bir")] },
    { id: "f", type: "quote", content: text("Alıntı") },
    { id: "g", type: "callout", tone: "warning", content: text("Dikkat") },
  ]);
  check("all seven text-family blocks survive", out?.blocks.length === 7);
  check("heading levels preserved", out.blocks[0].level === 2 && out.blocks[1].level === 3);
  check("ordered flag preserved", out.blocks[3].ordered === false && out.blocks[4].ordered === true);
  check("callout tone preserved", out.blocks[6].tone === "warning");
  check("unknown callout tone falls back to info", wrap([{ id: "x", type: "callout", tone: "nope", content: text("t") }]).blocks[0].tone === "info");
  check("empty text block is dropped", wrap([{ id: "x", type: "paragraph", content: [] }]) === null);
}

console.log("\n[2] IMAGE BLOCK + BACKWARD COMPATIBILITY");
{
  const modern = wrap([{ id: "i", type: "image", url: IMG, alt: "a", caption: "c", align: "center", width: 50, wrap: false, fit: "contain", aspect: "16-9" }]);
  check("fit/aspect round-trip", modern.blocks[0].fit === "contain" && modern.blocks[0].aspect === "16-9");
  // A row written by the previous editor version has no fit/aspect at all.
  const legacy = wrap([{ id: "i", type: "image", url: IMG, alt: "", caption: "", align: "left", width: 75, wrap: true }]);
  check("legacy image row still parses", legacy !== null && legacy.blocks.length === 1);
  check("legacy image gets safe defaults", legacy.blocks[0].fit === "cover" && legacy.blocks[0].aspect === "auto");
  check("legacy align/width/wrap untouched", legacy.blocks[0].align === "left" && legacy.blocks[0].width === 75 && legacy.blocks[0].wrap === true);
  check("non-https image url rejected", wrap([{ id: "i", type: "image", url: "javascript:alert(1)", alt: "", caption: "", align: "center", width: 100, wrap: false }]) === null);
}

console.log("\n[3] SIDE-BY-SIDE (SPLIT) BLOCK");
{
  const textImage = wrap([{
    id: "s", type: "split", variant: "text-image", ratio: "40-60", valign: "center",
    left: { kind: "text", nodes: [{ type: "heading", level: 2, content: text("Sol") }, { type: "paragraph", content: text("Gövde") }] },
    right: { kind: "image", url: IMG, alt: "g", caption: "", fit: "cover", aspect: "4-3" },
  }]);
  check("text-left / image-right round-trips", textImage?.blocks[0].variant === "text-image");
  check("ratio + valign preserved", textImage.blocks[0].ratio === "40-60" && textImage.blocks[0].valign === "center");
  check("text pane keeps heading + paragraph", textImage.blocks[0].left.nodes.length === 2);
  check("image pane keeps url/aspect", textImage.blocks[0].right.url === IMG && textImage.blocks[0].right.aspect === "4-3");

  const imageText = wrap([{
    id: "s", type: "split", variant: "image-text", ratio: "60-40", valign: "top",
    left: { kind: "image", url: IMG, alt: "", caption: "", fit: "cover", aspect: "auto" },
    right: { kind: "text", nodes: [{ type: "paragraph", content: text("Sağ") }] },
  }]);
  check("image-left / text-right round-trips", imageText?.blocks[0].variant === "image-text" && imageText.blocks[0].left.kind === "image");

  const twoText = wrap([{
    id: "s", type: "split", variant: "text-text", ratio: "50-50", valign: "top",
    left: { kind: "text", nodes: [{ type: "paragraph", content: text("A") }] },
    right: { kind: "text", nodes: [{ type: "paragraph", content: text("B") }] },
  }]);
  check("two text columns round-trip", twoText?.blocks[0].left.kind === "text" && twoText.blocks[0].right.kind === "text");

  // Variant is authoritative: a pane that disagrees is coerced, never trusted.
  const mismatched = wrap([{
    id: "s", type: "split", variant: "text-text", ratio: "50-50", valign: "top",
    left: { kind: "image", url: IMG, alt: "", caption: "", fit: "cover", aspect: "auto" },
    right: { kind: "text", nodes: [{ type: "paragraph", content: text("B") }] },
  }]);
  check("pane kind coerced to match variant", mismatched?.blocks[0].left.kind === "text");
  check("bad ratio falls back to 50-50", wrap([{ id: "s", type: "split", variant: "text-text", ratio: "99-1", valign: "top", left: { kind: "text", nodes: [{ type: "paragraph", content: text("A") }] }, right: { kind: "text", nodes: [] } }]).blocks[0].ratio === "50-50");
  check("split with an unusable image pane is dropped", wrap([{ id: "s", type: "split", variant: "text-image", ratio: "50-50", valign: "top", left: { kind: "text", nodes: [{ type: "paragraph", content: text("A") }] }, right: { kind: "image", url: "http://insecure/x.jpg" } }]) === null);
  check("fully empty split is dropped", wrap([{ id: "s", type: "split", variant: "text-text", ratio: "50-50", valign: "top", left: { kind: "text", nodes: [] }, right: { kind: "text", nodes: [] } }]) === null);
}

console.log("\n[4] GALLERY / CTA");
{
  const gallery = wrap([{ id: "g", type: "gallery", columns: 3, items: [{ id: "1", url: IMG, alt: "a", caption: "" }, { url: IMG, alt: "", caption: "c" }, { url: "ftp://x", alt: "", caption: "" }] }]);
  check("gallery keeps only safe items", gallery?.blocks[0].items.length === 2);
  check("gallery columns preserved", gallery.blocks[0].columns === 3);
  check("gallery item gets an id when missing", typeof gallery.blocks[0].items[1].id === "string" && gallery.blocks[0].items[1].id.length > 0);
  check("empty gallery is dropped", wrap([{ id: "g", type: "gallery", columns: 2, items: [] }]) === null);

  const cta = wrap([{ id: "c", type: "cta", title: "Başla", description: "Açıklama", buttonLabel: "Git", buttonUrl: "/tr/ucretler/" }]);
  check("cta round-trips", cta?.blocks[0].buttonUrl === "/tr/ucretler/");
  const noUrl = wrap([{ id: "c", type: "cta", title: "Başla", description: "", buttonLabel: "Git", buttonUrl: "" }]);
  check("cta without a url drops the button but keeps the section", noUrl?.blocks[0].buttonLabel === "" && noUrl.blocks[0].title === "Başla");
  check("cta with an unsafe url drops the button", wrap([{ id: "c", type: "cta", title: "T", description: "", buttonLabel: "Git", buttonUrl: "javascript:alert(1)" }]).blocks[0].buttonUrl === "");
  check("fully empty cta is dropped", wrap([{ id: "c", type: "cta", title: "", description: "", buttonLabel: "", buttonUrl: "" }]) === null);
}

console.log("\n[5] SAFETY");
{
  const linked = wrap([{ id: "p", type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", href: "javascript:alert(1)" }] }] }]);
  check("javascript: link mark stripped", !JSON.stringify(linked).includes("javascript"));
  const good = wrap([{ id: "p", type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", href: "https://ok.example" }, "bold"] }] }]);
  check("https link + bold mark kept", JSON.stringify(good).includes("https://ok.example") && JSON.stringify(good).includes("bold"));
  check("unknown block types are dropped", wrap([{ id: "z", type: "script", src: "x" }]) === null);
  check("non-object content rejected", sanitizeBlogContentJson("<script>") === null && sanitizeBlogContentJson(null) === null);
}

console.log("\n[6] LEGACY CONTENT FALLBACK (blog_posts.content is NOT NULL 1..50000)");
{
  const content = wrap([
    { id: "h", type: "heading", level: 2, content: text("Başlık") },
    { id: "s", type: "split", variant: "text-image", ratio: "50-50", valign: "top", left: { kind: "text", nodes: [{ type: "paragraph", content: text("Sol metin") }] }, right: { kind: "image", url: IMG, alt: "", caption: "Resim yazısı", fit: "cover", aspect: "auto" } },
    { id: "g", type: "gallery", columns: 2, items: [{ id: "1", url: IMG, alt: "", caption: "Galeri notu" }] },
    { id: "c", type: "cta", title: "CTA Başlık", description: "CTA açıklama", buttonLabel: "Git", buttonUrl: "/tr/" },
    { id: "k", type: "callout", tone: "info", content: text("Kutu metni") },
  ]);
  const fallback = deriveLegacyContentFallback(content);
  check("split text pane contributes to fallback", fallback.includes("Sol metin"));
  check("split image caption contributes", fallback.includes("Resim yazısı"));
  check("gallery caption contributes", fallback.includes("Galeri notu"));
  check("cta contributes", fallback.includes("CTA Başlık") && fallback.includes("CTA açıklama"));
  check("callout contributes", fallback.includes("Kutu metni"));
  check("fallback is never empty", deriveLegacyContentFallback({ version: 1, blocks: [{ id: "d", type: "divider" }] }).length >= 1);
  const huge = { version: 1, blocks: Array.from({ length: 4000 }, (_, i) => ({ id: "p" + i, type: "paragraph", content: text("x".repeat(40)) })) };
  check("fallback respects the 50000 char cap", deriveLegacyContentFallback(huge).length <= 50000);
  check("newBlockId returns unique ids", newBlockId() !== newBlockId());
}

console.log("\n[7] RENDERER / EDITOR COVERAGE (preview === production)");
{
  const schemaSrc = read("src/lib/blog/blockSchema.ts");
  const renderer = read("src/components/blog/BlogArticleBody.tsx");
  const editor = read("src/components/admin/blog/BlockEditor.tsx");
  const shell = read("src/components/blog/ArticleShell.tsx");
  const modal = read("src/components/admin/blog/BlogPreviewModal.tsx");

  const declared = [...schemaSrc.matchAll(/type:\s*"([a-z]+)"/g)].map((m) => m[1]);
  const blockTypes = [...new Set(declared)].filter((t) => !["text", "link"].includes(t));
  const missingRenderer = blockTypes.filter((t) => !new RegExp(`case "${t}"`).test(renderer));
  const missingEditor = blockTypes.filter((t) => !new RegExp(`"${t}"`).test(editor));
  check("every schema block type has a renderer case", missingRenderer.length === 0, missingRenderer.join(", "));
  check("every schema block type is handled by the editor", missingEditor.length === 0, missingEditor.join(", "));

  check("public article page uses the shared ArticleShell", read("src/components/blog/BlogDetailPage.tsx").includes("<ArticleShell"));
  check("admin preview modal uses the same ArticleShell", modal.includes("<ArticleShell"));
  check("standalone preview route uses the same ArticleShell", read("src/components/admin/BlogPreviewPage.tsx").includes("<ArticleShell"));
  check("ArticleShell delegates blocks to the single BlogArticleBody", shell.includes("<BlogArticleBody"));
  check("there is exactly one block renderer implementation", (renderer.match(/function BlockView/g) || []).length === 1);
  check("legacy markdown posts still fall back", shell.includes("renderBlogMarkdown(post.content)"));
}

console.log("\n[8] EDITOR UX CONTRACTS");
{
  const editor = read("src/components/admin/blog/BlockEditor.tsx");
  const shellSrc = read("src/components/admin/blog/blocks/BlockShell.tsx");
  const menu = read("src/components/admin/blog/blocks/AddBlockMenu.tsx");
  const page = read("src/components/admin/BlogEditorPage.tsx");
  const modal = read("src/components/admin/blog/BlogPreviewModal.tsx");

  check("move up / move down controls exist", /onMoveUp/.test(shellSrc) && /onMoveDown/.test(shellSrc));
  check("duplicate control exists", /onDuplicate/.test(shellSrc));
  check("delete control exists", /onDelete/.test(shellSrc));
  check("drag reorder retained", /useSortable/.test(shellSrc) && /arrayMove/.test(editor));
  check("duplicate re-keys ids (no aliasing)", /clone\.id = newBlockId\(\)/.test(editor));
  check("gallery duplicate re-keys item ids", /items\.map\(\(item\) => \(\{ \.\.\.item, id: newBlockId\(\) \}\)\)/.test(editor));

  for (const label of ["Yazı Sol / Görsel Sağ", "Görsel Sol / Yazı Sağ", "İki Kolon", "Galeri", "Bilgi Kutusu", "CTA Bölümü", "Alıntı", "Metin", "Görsel"]) {
    check("add-block menu offers: " + label, menu.includes(label));
  }
  check("no technical placeholder names in the menu", !/Template \d|Layout [A-Z]|Sample|Lorem|TODO/i.test(readCode("src/components/admin/blog/blocks/AddBlockMenu.tsx")));
  for (const preset of ["Giriş Bölümü", "Görselli Anlatım — Sağ Görsel", "Görselli Anlatım — Sol Görsel", "İki Konu Karşılaştırması", "Görsel Galeri", "Sonuç + CTA"]) {
    check("section preset offered: " + preset, menu.includes(preset));
  }
  check("presets expand into ordinary blocks", /function presetBlocks/.test(editor));

  check("preview opens without awaiting a save (no popup-blocker race)", /function openPreview\(\) \{\s*\n\s*setError\(""\);\s*\n\s*setPreviewOpen\(true\);/.test(page));
  check("preview no longer depends on window.open", !readCode("src/components/admin/BlogEditorPage.tsx").includes("window.open"));
  check("preview renders live editor state", page.includes("blocks: form.blocks"));
  check("preview offers desktop + mobile", modal.includes('value: "desktop"') && modal.includes('value: "mobile"'));
  check("preview offers tablet", modal.includes('value: "tablet"'));
  check("preview re-runs the production sanitizer", modal.includes("sanitizeBlogContentJson"));

  check("explicit draft save action exists", /async function saveDraft/.test(page));
  check("publish is guarded against double submit", /if \(publishing\) return;/.test(page));
  check("publish button shows a pending label", page.includes('publishing ? "Gönderiliyor…"'));
  check("update label shown for an already published post", page.includes('"Güncelle ve Yayınla"'));
  check("blob/object urls can never be persisted", /SAFE_MEDIA_URL_PATTERN = \/\^https:\\\/\\\/\/i/.test(read("src/lib/blog/blockSchema.ts")));
}

console.log("\n[9] NO PLACEHOLDER ARTIFACTS IN THE BLOG UI");
{
  const files = [
    "src/components/admin/BlogEditorPage.tsx",
    "src/components/admin/blog/BlockEditor.tsx",
    "src/components/admin/blog/BlogPreviewModal.tsx",
    "src/components/admin/blog/blocks/AddBlockMenu.tsx",
    "src/components/admin/blog/blocks/BlockShell.tsx",
    "src/components/admin/blog/blocks/PaneEditors.tsx",
    "src/components/admin/blog/blocks/SplitBlockEditor.tsx",
    "src/components/admin/blog/blocks/GalleryCtaCalloutEditors.tsx",
    "src/components/admin/blog/blocks/ButtonBlockEditor.tsx",
    "src/components/blog/BlogArticleBody.tsx",
  ];
  const banned = /\bLorem ipsum\b|\[object Object\]|\bTODO\b|Sample data|Template \d|>\s*undefined\s*<|>\s*null\s*</;
  const dirty = files.filter((f) => banned.test(read(f)));
  check("no lorem/TODO/[object Object]/null placeholders", dirty.length === 0, dirty.join(", "));
  check("button styles use human labels", read("src/components/admin/blog/blocks/ButtonBlockEditor.tsx").includes("Dolu Buton"));
}

rmSync(outDir, { recursive: true, force: true });

console.log("\n=======================================");
console.log("  " + passed + " passed, " + failures.length + " failed");
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("  BLOG EDITOR V2 ACCEPTANCE: ALL GREEN");
