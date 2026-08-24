"use client";

import { useState } from "react";
import { Headphones, Mail } from "lucide-react";
import AdminContactsPage from "../iletisim/page";
import AdminSupportPage from "../destek/page";

type View = "web" | "support";

const STORAGE_KEY = "oriens_admin_communication_tab";

export default function CommunicationSupportPage() {
  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.sessionStorage?.getItem(STORAGE_KEY) as View | null;
        if (saved === "web" || saved === "support") {
          return saved;
        }
      } catch {
        // Ignore storage errors
      }
    }
    return "web";
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleTabChange = (newView: View) => {
    setSelectedId(null);
    setView(newView);
    try {
      window.sessionStorage?.setItem(STORAGE_KEY, newView);
    } catch {
      // Ignore storage errors
    }
  };

  const tabs = [
    { id: "web" as const, label: "Web Talepleri", icon: Mail },
    { id: "support" as const, label: "Öğrenci Destek", icon: Headphones },
  ];

  return (
    <div className="space-y-5">
      <header className="border-b border-border pb-5">
        <h1 className="text-xl font-bold tracking-tight text-ink font-heading">
          İletişim & Destek
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Web iletişim ve danışmanlık talepleri ile kayıtlı öğrenci destek mesajlarını yönetin.
        </p>
      </header>

      {/* Primary 2-Tab Navigation */}
      <div className="inline-flex w-full rounded-xl border border-border bg-white p-1 shadow-xs sm:w-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleTabChange(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold sm:flex-none cursor-pointer transition-colors ${
              view === id ? "bg-ink text-white shadow-2xs" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {view === "web" && <AdminContactsPage initialContactId={selectedId} embedded />}
      {view === "support" && <AdminSupportPage initialThreadId={selectedId} embedded />}
    </div>
  );
}
