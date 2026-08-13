import Link from "next/link";
import { CompassMark } from "@/components/brand/CompassMark";

/**
 * Root entry point `/`. Automatically redirects to `/tr/` via meta-refresh
 * while providing crawlable locale links. Document shell is provided by
 * `app/layout.tsx`.
 */
export default function RootEntry() {
  return (
    <>
      <head>
        <title>Oriens Academy</title>
        <meta httpEquiv="refresh" content="0; url=/tr/" />
      </head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center antialiased">
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
      </div>
    </>
  );
}
