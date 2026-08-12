import Link from "next/link";
import { CompassMark } from "@/components/brand/CompassMark";
import "./globals.css";

/**
 * The bare `/` route. There is deliberately no `app/layout.tsx` above
 * this — the app's real root layout lives at `app/[lang]/layout.tsx` (see
 * that file's comment, and the Next.js internationalization guide, which
 * documents nesting the root layout inside the locale segment). Since `/`
 * falls outside `[lang]`, it has no layout ancestor at all, so this page
 * is self-contained and renders its own `<html>/<body>`.
 *
 * This is a small, fully static locale entry point — a meta-refresh
 * (works with zero JavaScript, safe on static export/shared hosting) plus
 * real, crawlable `<a>` links to both locales. No server redirect, no
 * middleware.
 */
export default function RootEntry() {
  return (
    <html lang="tr">
      <head>
        <title>Oriens Academy</title>
        <meta httpEquiv="refresh" content="0; url=/tr/" />
      </head>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center antialiased">
        <CompassMark size={36} />
        <p className="text-sm text-muted-foreground">Yönlendiriliyor… / Redirecting…</p>
        <nav aria-label="Language" className="flex gap-6 text-sm font-medium">
          <Link href="/tr/" className="text-ink underline underline-offset-4">
            Türkçe
          </Link>
          <Link href="/en/" className="text-ink underline underline-offset-4">
            English
          </Link>
        </nav>
      </body>
    </html>
  );
}
