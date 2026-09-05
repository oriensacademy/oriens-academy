"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import AdminContactsPage from "../iletisim/page";

/**
 * Admin -> İletişim Talepleri.
 *
 * The legacy student support/ticket tab ("Öğrenci Destek") was removed together
 * with the support_threads/support_messages system; this module is now the public
 * contact/consultation request inbox only. The route is kept (rather than moved to
 * /admin/iletisim) so existing notification deep links "?id=<contactId>" keep
 * opening the right request.
 */
function CommunicationContent() {
  const params = useSearchParams();
  const selectedId = params.get("id");

  return (
    <div className="space-y-5">
      <header className="border-b border-border pb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink font-heading">
          <Mail className="size-5 text-primary" />
          İletişim Talepleri
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Web sitesi üzerinden gelen iletişim ve danışmanlık taleplerini yönetin.
        </p>
      </header>

      <AdminContactsPage initialContactId={selectedId} embedded />
    </div>
  );
}

export default function CommunicationPage() {
  return (
    <Suspense fallback={null}>
      <CommunicationContent />
    </Suspense>
  );
}
