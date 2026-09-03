import process from "node:process";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Supabase QA configuration is missing.");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const marker = crypto.randomUUID();
const slug = `qa-blog-v2-${marker}`;
const imagePath = `image/qa/${marker}.png`;
const pdfPath = `file/qa/${marker}.pdf`;
let postId = null;

try {
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
  const imageUpload = await service.storage.from("blog-media").upload(imagePath, png, { contentType: "image/png" });
  if (imageUpload.error) throw imageUpload.error;
  const pdfUpload = await service.storage.from("blog-media").upload(pdfPath, pdf, { contentType: "application/pdf" });
  if (pdfUpload.error) throw pdfUpload.error;
  const imageUrl = service.storage.from("blog-media").getPublicUrl(imagePath).data.publicUrl;
  const pdfUrl = service.storage.from("blog-media").getPublicUrl(pdfPath).data.publicUrl;

  const inserted = await service.from("blog_posts").insert({
    slug, locale: "en", title: "QA Blog Editor V2", excerpt: "QA only", status: "draft",
    content: `Inline image\n\n![QA image](${imageUrl} \"QA caption\")\n\n[QA PDF](${pdfUrl})`,
    cover_image_url: imageUrl,
  }).select("id").single();
  if (inserted.error) throw inserted.error;
  postId = inserted.data.id;

  const draftRead = await anon.from("blog_posts").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (draftRead.error || draftRead.count !== 0) throw draftRead.error || new Error("Draft was public");
  const future = await service.from("blog_posts").update({ status: "published", published_at: new Date(Date.now() + 7_200_000).toISOString() }).eq("id", postId);
  if (future.error) throw future.error;
  const futureRead = await anon.from("blog_posts").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (futureRead.error || futureRead.count !== 0) throw futureRead.error || new Error("Scheduled post was public early");
  const live = await service.from("blog_posts").update({ published_at: new Date(Date.now() - 5_000).toISOString() }).eq("id", postId);
  if (live.error) throw live.error;
  const liveRead = await anon.from("blog_posts").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (liveRead.error || liveRead.count !== 1) throw liveRead.error || new Error("Published post was not immediately public");

  console.log(JSON.stringify({ draftHidden: true, futureHidden: true, liveWithoutRebuild: true, coverUpload: true, inlineImage: true, pdfUpload: true }));
} finally {
  if (postId) await service.from("blog_posts").delete().eq("id", postId);
  await service.storage.from("blog-media").remove([imagePath, pdfPath]);
}
