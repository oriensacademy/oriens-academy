"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Headphones, Inbox, Mail, RefreshCw } from "lucide-react";
import {
  listAdminContactRequests,
  type ContactRequestRow,
} from "@/lib/admin/contacts";
import { listAdminSupportThreads } from "@/lib/support/admin";
import type { SupportThread } from "@/lib/support/types";

const fetchInbox = () =>
  Promise.all([
    listAdminContactRequests({ status: "all" }),
    listAdminSupportThreads({ status: "all", category: "all", search: "" }),
  ]);

export function UnifiedCommunicationInbox({
  onOpenWeb,
  onOpenSupport,
}: {
  onOpenWeb: (id: string) => void;
  onOpenSupport: (id: string) => void;
}) {
  const [contacts, setContacts] = useState<ContactRequestRow[]>([]);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [contactResult, threadResult] = await fetchInbox();
    setContacts(contactResult.data || []);
    setThreads(threadResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchInbox().then(([contactResult, threadResult]) => {
      if (!active) return;
      setContacts(contactResult.data || []);
      setThreads(threadResult.data || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => {
    const web = contacts.map((item) => ({
      id: `web-${item.id}`,
      kind: "web" as const,
      recordId: item.id,
      title: item.subject || "Web iletişim talebi",
      person: `${item.full_name} · ${item.email}`,
      preview: item.message,
      source:
        item.source === "quick_contact"
          ? "Web"
          : item.source === "booking"
            ? "Görüşme"
            : "Web",
      status: item.status,
      date: item.created_at,
    }));
    const support = threads.map((item) => ({
      id: `support-${item.id}`,
      kind: "support" as const,
      recordId: item.id,
      title: item.subject,
      person: `${item.student_profiles?.full_name || "Öğrenci"} · ${item.student_profiles?.email || ""}`,
      preview: item.category,
      source: item.category === "payment" ? "Ödeme" : "Öğrenci Destek",
      status: item.status,
      date: item.last_message_at,
    }));
    const normalized = [...web, ...support].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return term
      ? normalized.filter((item) =>
          `${item.title} ${item.person} ${item.preview}`
            .toLocaleLowerCase("tr-TR")
            .includes(term),
        )
      : normalized;
  }, [contacts, threads, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Gelen kutusunda ara</span>
          <Inbox className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="İsim, e-posta, konu veya mesaj ara…"
            className="min-h-10 w-full rounded-xl border border-input bg-white pl-10 pr-3 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-semibold text-ink hover:bg-muted"
        >
          <RefreshCw className="size-4" />
          Yenile
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Gelen kutusu yükleniyor…
          </p>
        ) : items.length ? (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  item.kind === "support"
                    ? onOpenSupport(item.recordId)
                    : onOpenWeb(item.recordId)
                }
                className="grid w-full gap-2 p-4 text-left hover:bg-background-soft sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-xl ${item.kind === "support" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}
                >
                  {item.kind === "support" ? (
                    <Headphones className="size-4" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm text-ink">
                      {item.title}
                    </strong>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {item.source}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {item.person}
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink/70">
                    {item.preview}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground sm:text-right">
                  {new Date(item.date).toLocaleString("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                  <span className="mt-1 block font-semibold">
                    {item.status}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Henüz iletişim veya destek talebi yok.
          </p>
        )}
      </div>
    </div>
  );
}
