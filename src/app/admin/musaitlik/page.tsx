"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { CreateSlotModal } from "@/components/admin/CreateSlotModal";
import type { AvailabilitySlotWithBooking, SlotStatus } from "@/lib/admin/availability";
import {
  listAdminAvailabilitySlots,
  deleteAdminAvailabilitySlot,
} from "@/lib/admin/availability";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  Inbox,
  Filter,
} from "lucide-react";

export default function AdminAvailabilityPage() {
  return (
    <AdminGuard>
      <AdminShell>
        <AvailabilityContent />
      </AdminShell>
    </AdminGuard>
  );
}

function AvailabilityContent() {
  const [slots, setSlots] = useState<AvailabilitySlotWithBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<SlotStatus | "all">("all");
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState("");

  // Modal & Deletion State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await listAdminAvailabilitySlots({
      status: statusFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setLoading(false);
    if (error) setErrorMsg(error);
    else setSlots(data);
  }, [statusFilter, startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);

      listAdminAvailabilitySlots({
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }).then(({ data, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) {
            setErrorMsg(error);
          } else {
            setSlots(data);
          }
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [statusFilter, startDate, endDate]);

  const handleDeleteSlot = async (slotId: string) => {
    setDeletingId(slotId);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { success, error } = await deleteAdminAvailabilitySlot(slotId);

    setDeletingId(null);
    setConfirmDeleteId(null);

    if (error) {
      setErrorMsg(error);
    } else if (success) {
      setSuccessMsg("Müsaitlik zaman dilimi başarıyla silindi.");
      fetchSlots();
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Group slots by Date (YYYY-MM-DD)
  const groupedSlots = slots.reduce<Record<string, AvailabilitySlotWithBooking[]>>(
    (acc, slot) => {
      const dateKey = slot.starts_at.split("T")[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(slot);
      return acc;
    },
    {}
  );

  const dateKeys = Object.keys(groupedSlots).sort();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Müsaitlik Takvimi / Availability Schedule
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Öğrencilerin online randevu alabileceği zaman dilimlerini yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSlots}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
          >
            {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
            <span>Yenile</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4 text-amber-400" />
            <span>Müsaitlik Ekle / Add Slot</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="size-4 text-[#10271B]" />
          <span>Filtrele</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 flex-1 max-w-xl">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SlotStatus | "all")}
            className="rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
          >
            <option value="all">Tüm Durumlar (All)</option>
            <option value="available">Müsait (Available)</option>
            <option value="booked">Rezerve Edildi (Booked)</option>
            <option value="blocked">Engellendi (Blocked)</option>
          </select>

          {/* Start Date */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
            title="Başlangıç Tarihi"
          />

          {/* End Date */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
            title="Bitiş Tarihi"
          />
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={fetchSlots}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Müsaitlik dilimleri yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && dateKeys.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            Müsaitlik Dilimi Bulunamadı / No Availability Slots
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Seçilen tarih aralığında tanımlı zaman dilimi yok. Sağ üstteki &quot;Müsaitlik Ekle&quot; butonuna tıklayarak yeni zaman dilimleri oluşturabilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4 text-amber-400" />
            <span>İlk Müsaitlik Dilimini Ekle</span>
          </button>
        </div>
      )}

      {/* Date Grouped Slots View */}
      {!loading && !errorMsg && dateKeys.length > 0 && (
        <div className="space-y-6">
          {dateKeys.map((dateKey) => {
            const daySlots = groupedSlots[dateKey];
            const dateObj = new Date(`${dateKey}T00:00:00`);

            return (
              <div
                key={dateKey}
                className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-4"
              >
                {/* Date Header */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-[#819586]" />
                    <h2 className="text-xs font-bold text-foreground">
                      {dateObj.toLocaleDateString("tr-TR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {daySlots.length} Zaman Dilimi
                  </span>
                </div>

                {/* Slots Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((slot) => {
                    const startsAt = new Date(slot.starts_at);
                    const endsAt = new Date(slot.ends_at);
                    const isBooked = slot.status === "booked" || (slot.bookings && slot.bookings.length > 0);
                    const activeBooking = slot.bookings?.find(
                      (b) => b.status !== "cancelled"
                    );

                    return (
                      <div
                        key={slot.id}
                        className={`flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-colors ${
                          isBooked
                            ? "border-blue-200 bg-blue-50/40"
                            : slot.status === "blocked"
                            ? "border-input bg-muted opacity-60"
                            : "border-border bg-white"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                              <Clock className="size-3.5 text-[#10271B]" />
                              <span>
                                {startsAt.toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {" – "}
                                {endsAt.toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {/* Status Badge */}
                            {isBooked ? (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                                <Lock className="size-3" />
                                <span>Rezerve</span>
                              </span>
                            ) : slot.status === "blocked" ? (
                              <span className="inline-flex items-center rounded bg-sage-soft px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                Engelli
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                Müsait
                              </span>
                            )}
                          </div>

                          {/* Linked Booking info */}
                          {activeBooking && (
                            <div className="mt-2 rounded-lg border border-blue-200 bg-white p-2.5 text-[11px] space-y-1">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <User className="size-3 text-blue-600" />
                                <span>{activeBooking.full_name}</span>
                              </div>
                              <div className="text-muted-foreground truncate">
                                {activeBooking.email}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Slot Delete Action */}
                        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                          <span className="text-[10px] text-muted-foreground">
                            ID: {slot.id.slice(0, 6)}…
                          </span>

                          {confirmDeleteId === slot.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={deletingId === slot.id}
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-700"
                              >
                                {deletingId === slot.id ? "Siliniyor…" : "Evet, Sil"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded border border-input px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                              >
                                İptal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBooked}
                              onClick={() => setConfirmDeleteId(slot.id)}
                              title={
                                isBooked
                                  ? "Aktif randevusu olan dilimler silinemez."
                                  : "Dilimi sil"
                              }
                              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Sil</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Slot Modal */}
      <CreateSlotModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchSlots}
      />
    </div>
  );
}
