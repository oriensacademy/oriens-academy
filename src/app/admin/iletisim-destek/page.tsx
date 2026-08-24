"use client";

import { useState } from "react";
import { Headphones, Inbox, Mail } from "lucide-react";
import AdminContactsPage from "../iletisim/page";
import AdminSupportPage from "../destek/page";
import { UnifiedCommunicationInbox } from "@/components/admin/UnifiedCommunicationInbox";

type View = "inbox" | "web" | "support";

export default function CommunicationSupportPage() {
  const [view, setView] = useState<View>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tabs = [
    { id: "inbox" as const, label: "Gelen Kutusu", icon: Inbox },
    { id: "web" as const, label: "Web Talepleri", icon: Mail },
    { id: "support" as const, label: "Öğrenci Destek", icon: Headphones },
  ];
  return (
    <div className="space-y-5">
      <header className="border-b border-border pb-5">
        <h1 className="text-xl font-bold tracking-tight text-ink">
          İletişim & Destek
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Web taleplerini ve öğrenci destek konuşmalarını tek gelen kutusundan
          yönetin.
        </p>
      </header>
      <div className="inline-flex w-full rounded-xl border border-border bg-white p-1 shadow-xs sm:w-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSelectedId(null);
              setView(id);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold sm:flex-none ${view === id ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {view === "inbox" && (
        <UnifiedCommunicationInbox
          onOpenWeb={(id) => { setSelectedId(id); setView("web"); }}
          onOpenSupport={(id) => { setSelectedId(id); setView("support"); }}
        />
      )}
      {view === "web" && <AdminContactsPage initialContactId={selectedId} embedded />}
      {view === "support" && <AdminSupportPage initialThreadId={selectedId} embedded />}
    </div>
  );
}
