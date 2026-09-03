import type { Metadata } from "next";
import { isLocale } from "@/content/dictionaries";
import { BlogDetailPage } from "@/components/blog/BlogDetailPage";

type Params = { lang: string };

/**
 * Fixed static shell (not a dynamic [slug] route -- Next static export can't
 * pre-render an unbounded set of post slugs). A Cloudflare `_redirects` rule
 * rewrites /{locale}/blog/{slug}/ to this page with a 200 status, so the
 * browser URL bar keeps the pretty slug while this shell reads it from
 * window.location client-side. See BlogDetailPage for the actual fetch.
 * Metadata here is intentionally generic; BlogDetailPage sets the real
 * per-post title/description/canonical once the post loads client-side.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return {
    title: lang === "tr" ? "Blog | Oriens Academy" : "Blog | Oriens Academy",
    robots: { index: false, follow: true }, // avoid indexing the generic shell; individual posts self-canonicalize
  };
}

export default function BlogPostPage() {
  return <BlogDetailPage />;
}
