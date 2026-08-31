"use client";

import { useState, useEffect, useCallback } from "react";
import { AuditDetailSheet } from "@/components/admin/AuditDetailSheet";
import type { AuditLogRow } from "@/lib/admin/audit";
import { listAdminAuditLogs } from "@/lib/admin/audit";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  FileCheck,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User,
  ChevronRight,
  AlertCircle,
  Inbox,
  Tag,
  ShieldCheck,
  ChevronLeft,
} from "lucide-react";

export default function AdminAuditPage() {
  return <AuditContent />;
}

const ENTITY_OPTIONS = [
  { value: "all", label: "Tüm Varlıklar / All Entities" },
  { value: "booking", label: "Randevu (booking)" },
  { value: "contact_request", label: "İletişim Talebi (contact_request)" },
  { value: "availability_slot", label: "Müsaitlik (availability_slot)" },
  { value: "pricing_package", label: "Fiyat Paketi (pricing_package)" },
  { value: "testimonial", label: "Öğrenci Yorumu (testimonial)" },
  { value: "site_setting", label: "Site Ayarı (site_setting)" },
];

function AuditContent() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Pagination State
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selected Log for Detail View
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, totalCount: count, error } = await listAdminAuditLogs({
      entityType: entityFilter !== "all" ? entityFilter : undefined,
      action: actionFilter,
      dateFrom,
      dateTo,
      search: searchTerm,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    setLoading(false);
    if (error) {
      setErrorMsg(error);
    } else {
      setLogs(data);
      setTotalCount(count);
    }
  }, [actionFilter, dateFrom, dateTo, entityFilter, searchTerm, page]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);
      listAdminAuditLogs({
        entityType: entityFilter !== "all" ? entityFilter : undefined,
        action: actionFilter,
        dateFrom,
        dateTo,
        search: searchTerm,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }).then(({ data, totalCount: count, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) {
            setErrorMsg(error);
          } else {
            setLogs(data);
            setTotalCount(count);
          }
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [actionFilter, dateFrom, dateTo, entityFilter, searchTerm, page]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Denetim & İşlem Logları / Audit Logs
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Yöneticiler ve sistem tarafından gerçekleştirilen tüm veri değişikliklerini izleyin (Salt Okunur).
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
        >
          {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
          <span>Yenile</span>
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
              placeholder="İşlem adı veya varlık kimliği (ID)…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden"
            />
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
            >
              {ENTITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <input type="text" value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }} placeholder="Action filtresi…" className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Başlangıç tarihi" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="min-w-0 rounded-lg border border-input bg-white px-2 py-2 text-xs text-foreground" />
            <input type="date" aria-label="Bitiş tarihi" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="min-w-0 rounded-lg border border-input bg-white px-2 py-2 text-xs text-foreground" />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Denetim logları yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            Denetim Kaydı Bulunamadı / No Audit Logs
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Filtreleme kriterlerinize uygun denetim işlem kaydı bulunmuyor.
          </p>
        </div>
      )}

      {/* Table (Desktop) */}
      {!loading && !errorMsg && logs.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden space-y-3 p-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">İşlem (Action)</th>
                  <th className="px-4 py-3">Varlık (Entity)</th>
                  <th className="px-4 py-3">Aktör / Kullanıcı</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="cursor-pointer transition-colors hover:bg-background-soft/80"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs font-semibold text-[#10271B]">
                        {log.action}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground capitalize">
                        <Tag className="size-3 text-muted-foreground" />
                        <span>{log.entity_type}</span>
                      </div>
                      {log.entity_id && (
                        <div className="text-[10px] font-mono text-muted-foreground truncate max-w-xs">
                          ID: {log.entity_id}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-[11px]">
                          {log.actor_user_id ? log.actor_user_id.slice(0, 8) + "…" : "Sistem"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3 text-muted-foreground" />
                        <span>{new Date(log.created_at).toLocaleString("tr-TR")}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        <span>İncele</span>
                        <ChevronRight className="size-3 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>
                Toplam <span className="font-bold text-foreground">{totalCount}</span> denetim kaydı (Salt Okunur)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
                <span>Önceki</span>
              </button>
              <span className="font-semibold text-foreground">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <span>Sonraki</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <AuditDetailSheet log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
