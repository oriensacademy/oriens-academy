"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookingDetailSheet } from "@/components/admin/BookingDetailSheet";
import type { BookingWithSlot, BookingStatus } from "@/lib/admin/bookings";
import { listAdminBookings } from "@/lib/admin/bookings";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  CalendarCheck,
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

export default function AdminBookingsPage() {
  return (
    <AdminGuard>
      <AdminShell>
        <BookingsContent />
      </AdminShell>
    </AdminGuard>
  );
}

const STATUS_OPTIONS: Array<{ value: BookingStatus | "all"; label: string }> = [
  { value: "all", label: "Tüm Durumlar / All Statuses" },
  { value: "pending", label: "Bekliyor (Pending)" },
  { value: "confirmed", label: "Onaylandı (Confirmed)" },
  { value: "completed", label: "Tamamlandı (Completed)" },
  { value: "cancelled", label: "İptal Edildi (Cancelled)" },
  { value: "no_show", label: "Gelmedi (No Show)" },
];

function BookingsContent() {
  const [bookings, setBookings] = useState<BookingWithSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selected Booking for Detail View
  const [selectedBooking, setSelectedBooking] = useState<BookingWithSlot | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await listAdminBookings({
      status: statusFilter,
      search: searchTerm,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setLoading(false);
    if (error) setErrorMsg(error);
    else setBookings(data);
  }, [statusFilter, searchTerm, startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);

      listAdminBookings({
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
            setBookings(data);
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
    fetchBookings();
    setSelectedBooking(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Randevu Yönetimi / Bookings
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tüm randevu taleplerini inceleyin, onaylayın veya durumlarını güncelleyin.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchBookings}
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
              placeholder="İsim, e-posta veya telefon…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BookingStatus | "all")}
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
            onClick={fetchBookings}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Randevular yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && bookings.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            Randevu Bulunamadı / No Bookings
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Filtreleme kriterlerine uyan kayıt bulunmuyor. Filtreleri değiştirerek tekrar arayabilirsiniz.
          </p>
        </div>
      )}

      {/* Data Table (Desktop) */}
      {!loading && !errorMsg && bookings.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Öğrenci / Client</th>
                  <th className="px-4 py-3">Randevu Zamanı</th>
                  <th className="px-4 py-3">Sınav / Ders</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Kayıt Tarihi</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((booking) => {
                  const slotStart = booking.availability_slots?.starts_at
                    ? new Date(booking.availability_slots.starts_at)
                    : null;
                  const slotEnd = booking.availability_slots?.ends_at
                    ? new Date(booking.availability_slots.ends_at)
                    : null;

                  return (
                    <tr
                      key={booking.id}
                      onClick={() => setSelectedBooking(booking)}
                      className="cursor-pointer transition-colors hover:bg-background-soft/80"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#10271B]/10 text-[#10271B] font-semibold">
                            <User className="size-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">
                              {booking.full_name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Mail className="size-3 text-muted-foreground" />
                              <span>{booking.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {slotStart && slotEnd ? (
                          <div>
                            <div className="font-semibold text-foreground">
                              {slotStart.toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {slotStart.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} –{" "}
                              {slotEnd.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Dilim atanamadı</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {booking.exam_code || booking.custom_exam || "Danışmanlık"}
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge status={booking.status as BookingStatus} />
                      </td>

                      <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3 text-muted-foreground" />
                          <span>{new Date(booking.created_at).toLocaleDateString("tr-TR")}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(booking);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          <span>Detay</span>
                          <ChevronRight className="size-3 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Booking Detail Sheet */}
      <BookingDetailSheet
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          Bekliyor
        </span>
      );
    case "confirmed":
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          Onaylandı
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
          Tamamlandı
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-800">
          İptal Edildi
        </span>
      );
    case "no_show":
      return (
        <span className="inline-flex items-center rounded-md bg-muted border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Gelmedi
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
