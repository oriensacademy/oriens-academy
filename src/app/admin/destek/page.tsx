"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * REMOVED: student support / ticket module.
 *
 * The support_threads / support_messages system and its emails were decommissioned
 * (see 20260905150000_remove_student_support_ticket_system.sql). Public contact
 * requests remain the single inbound channel and live at /admin/iletisim-destek.
 *
 * This route only redirects so that old bookmarks do not 404. The file itself can
 * be deleted once no one is relying on the old URL.
 */
export default function RemovedSupportPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/iletisim-destek/");
  }, [router]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-xs text-muted-foreground">
      Öğrenci destek modülü kaldırıldı. İletişim taleplerine yönlendiriliyorsunuz…
    </div>
  );
}
