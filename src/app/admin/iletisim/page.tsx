"use client";

import { useState, useEffect, useCallback } from "react";
import { ContactDetailSheet } from "@/components/admin/ContactDetailSheet";
import type { ContactRequestRow, ContactStatus } from "@/lib/admin/contacts";
import { listAdminContactRequests } from "@/lib/admin/contacts";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User,
  Mail,
  ChevronRight,
  AlertCircle,
  Inbox,
} from "lucide-react";

export default function AdminContactsPage() {
  return <ContactsContent />;
}

const STATUS_OPTIONS: Array<{ value: ContactStatus | "all"; label: string }> = [
  { value: "all", label: "Tüm Durumlar / All Statuses" },
  { value: "new", label: "Yeni (New)" },
  { value: "in_progress", label: "İşlemde (In Progress)" },
  { value: "resolved", label: "Çözüldü (Resolved)" },
  { value: "spam", label: "Spam (Spam)" },
];

function ContactsContent() {
  const [contacts, setContacts] = useState<ContactRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selected Contact for Detail View
  const [selectedContact, setSelectedContact] = useState<ContactRequestRow | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await listAdminContactRequests({
      status: statusFilter,
      search: searchTerm,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setLoading(false);
    if (error) setErrorMsg(error);
    else setContacts(data);
  }, [statusFilter, searchTerm, startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);

      listAdminContactRequests({
        status: statusFilter,
        search: searchTerm,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }).then(({ data, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) {
            setErrorMsg(error);
          } else {
            setContacts(data);
          }
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [statusFilter, searchTerm, startDate, endDate]);

  const handleStatusUpdated = () => {
    fetchContacts();
    setSelectedContact(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              İletişim Talepleri / Contact Requests
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Web sitesinden gönderilen tüm iletişim ve bilgi alma taleplerini yönetin.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchContacts}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
        >
          {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
          <span>Yenile / Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="size-4 text-[#10271B]" />
          <span>Filtreleme & Arama</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="İsim, e-posta, konu veya mesaj…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ContactStatus | "all")}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
              title="Başlangıç Tarihi"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
              title="Bitiş Tarihi"
            />
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={fetchContacts}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="İletişim talepleri yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            İletişim Talebi Bulunamadı / No Contact Requests
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Henüz gönderilmiş iletişim talebi yok veya filtrenizle eşleşen kayıt bulunamadı.
          </p>
        </div>
      )}

      {/* Data Table (Desktop) */}
      {!loading && !errorMsg && contacts.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Gönderen / Contact</th>
                  <th className="px-4 py-3">Konu & Özet</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="cursor-pointer transition-colors hover:bg-background-soft/80"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#10271B]/10 text-[#10271B] font-semibold">
                          <User className="size-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">
                            {contact.full_name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Mail className="size-3 text-muted-foreground" />
                            <span>{contact.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs truncate">
                      <div className="font-semibold text-foreground truncate">
                        {contact.subject || "Konusuz İletişim Talebi"}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {contact.message}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <StatusBadge status={contact.status as ContactStatus} />
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3 text-muted-foreground" />
                        <span>{new Date(contact.created_at).toLocaleDateString("tr-TR")}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContact(contact);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        <span>Oku / Detay</span>
                        <ChevronRight className="size-3 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contact Detail Sheet */}
      <ContactDetailSheet
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: ContactStatus }) {
  switch (status) {
    case "new":
      return (
        <span className="inline-flex items-center rounded-md bg-[#819586]/15 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-[#819586]">
          Yeni (New)
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
          İşlemde
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          Çözüldü
        </span>
      );
    case "spam":
      return (
        <span className="inline-flex items-center rounded-md bg-muted border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Spam
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {status}
        </span>
      );
  }
}
