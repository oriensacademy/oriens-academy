"use client";

import { useState, useEffect, useCallback } from "react";
import { NotificationDetailSheet } from "@/components/admin/NotificationDetailSheet";
import type { NotificationDeliveryRow, DeliveryStatus } from "@/lib/admin/notifications";
import { listAdminNotifications, humanizeNotificationSubject, humanizeEventType } from "@/lib/admin/notifications";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  Bell,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Mail,
  ChevronRight,
  AlertCircle,
  Inbox,
  CheckCircle2,
  Clock,
  ChevronLeft,
} from "lucide-react";

export default function AdminNotificationsPage() {
  return <NotificationsContent />;
}

function NotificationsContent() {
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Pagination State
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected Notification for Detail Sheet
  const [selectedDelivery, setSelectedDelivery] = useState<NotificationDeliveryRow | null>(null);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, totalCount: count, error } = await listAdminNotifications({
      status: statusFilter,
      eventType: eventTypeFilter !== "all" ? eventTypeFilter : undefined,
      channel: channelFilter !== "all" ? channelFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: searchTerm,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    setLoading(false);
    if (error) {
      setErrorMsg(error);
    } else {
      setDeliveries(data);
      setTotalCount(count);
    }
  }, [statusFilter, eventTypeFilter, channelFilter, dateFrom, dateTo, searchTerm, page, pageSize]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);
      listAdminNotifications({
        status: statusFilter,
        eventType: eventTypeFilter !== "all" ? eventTypeFilter : undefined,
        channel: channelFilter !== "all" ? channelFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchTerm,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }).then(({ data, totalCount: count, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) {
            setErrorMsg(error);
          } else {
            setDeliveries(data);
            setTotalCount(count);
          }
        }
      });
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [statusFilter, eventTypeFilter, channelFilter, dateFrom, dateTo, searchTerm, page, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Bildirim ve E-Posta Teslimatları
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sistem tarafından gönderilen tüm e-posta bildirimlerinin canlı teslimat durumlarını ve şablon konularını inceleyin.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDeliveries}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
        >
          {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
          <span>Yenile</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Filter className="size-4 text-[#10271B]" />
            <span>Filtreleme & Arama</span>
          </div>
          {(statusFilter !== "all" || eventTypeFilter !== "all" || channelFilter !== "all" || dateFrom || dateTo || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setEventTypeFilter("all");
                setChannelFilter("all");
                setDateFrom("");
                setDateTo("");
                setSearchTerm("");
                setPage(1);
              }}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Alıcı, konu, referans veya mesaj ID…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as DeliveryStatus | "all");
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="sent">Gönderildi</option>
              <option value="failed">Başarısız</option>
              <option value="pending">Bekliyor</option>
              <option value="processing">İşleniyor</option>
            </select>
          </div>

          {/* Channel Dropdown */}
          <div>
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
            >
              <option value="all">Tüm Kanallar</option>
              <option value="email">E-posta</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
            </select>
          </div>

          {/* Event Type Dropdown */}
          <div>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
            >
              <option value="all">Tüm Olay Türleri</option>
              <option value="welcome">Hoş Geldiniz</option>
              <option value="booking">Randevu / Onay</option>
              <option value="appointment">Ders / Seans</option>
              <option value="payment">Ödeme & Paket</option>
              <option value="contact">İletişim Formu</option>
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Başlangıç:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white px-2.5 py-1.5 text-xs text-foreground"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Bitiş:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white px-2.5 py-1.5 text-xs text-foreground"
            />
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
            onClick={fetchDeliveries}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Bildirim teslimatları yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && deliveries.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            Bildirim Kaydı Bulunamadı
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Filtreleme kriterlerinize uygun bildirim teslimat kaydı bulunmuyor.
          </p>
        </div>
      )}

      {/* Table (Desktop) */}
      {!loading && !errorMsg && deliveries.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden space-y-3 p-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Konu & Bildirim Türü</th>
                  <th className="px-4 py-3">Alıcı</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map((del) => {
                  const subject = humanizeNotificationSubject(del, "tr");
                  const humanType = humanizeEventType(del.event_type, "tr");
                  return (
                    <tr
                      key={del.id}
                      onClick={() => setSelectedDelivery(del)}
                      className="cursor-pointer transition-colors hover:bg-background-soft/80"
                    >
                      <td className="px-4 py-3.5 max-w-sm">
                        <div className="text-xs font-semibold text-[#10271B] truncate">
                          {subject}
                        </div>
                        <div className="text-[11px] text-[#819586] font-medium truncate">
                          {humanType}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground font-mono">
                          <Mail className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{del.recipient}</span>
                        </div>
                        {del.provider_message_id && (
                          <div className="text-[10px] font-mono text-muted-foreground truncate max-w-xs">
                            ID: {del.provider_message_id}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <DeliveryStatusBadge status={del.status as DeliveryStatus} />
                      </td>

                      <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3 text-muted-foreground" />
                          <span>{new Date(del.created_at).toLocaleString("tr-TR")}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDelivery(del);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          <span>İncele</span>
                          <ChevronRight className="size-3 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                Toplam <strong className="text-foreground">{totalCount}</strong> bildirim
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <span>Sayfa Başına:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded border border-input bg-white px-2 py-0.5 text-xs text-foreground font-medium"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
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
              <span className="font-semibold text-foreground px-1">
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
      <NotificationDetailSheet
        delivery={selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
      />
    </div>
  );
}

function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  switch (status) {
    case "sent":
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
          <CheckCircle2 className="size-3" />
          <span>Gönderildi</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-bold text-red-800">
          <AlertCircle className="size-3" />
          <span>Başarısız</span>
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          <Clock className="size-3" />
          <span>Bekliyor</span>
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
