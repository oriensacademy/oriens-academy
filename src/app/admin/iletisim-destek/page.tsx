"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  return <AdminContactsPage initialContactId={params.get("id")} />;
}

export default function CommunicationPage() {
  return (
    <Suspense fallback={null}>
      <CommunicationContent />
    </Suspense>
  );
}
