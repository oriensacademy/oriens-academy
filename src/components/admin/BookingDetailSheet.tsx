"use client";

import { useState } from "react";
import type { BookingWithSlot, BookingStatus } from "@/lib/admin/bookings";
import { updateAdminBookingStatus } from "@/lib/admin/bookings";
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  BookOpen,
  Globe,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

interface BookingDetailSheetProps {
  booking: BookingWithSlot | null;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const STATUS_LABELS: Record<BookingStatus, { label: string; bgClass: string; textClass: string }> = {
  pending: {
    label: "Bekliyor / Pending",
    bgClass: "bg-amber-100 border-amber-300",
    textClass: "text-amber-800",
  },
  confirmed: {
    label: "Onaylandı / Confirmed",
    bgClass: "bg-emerald-100 border-emerald-300",
    textClass: "text-emerald-800",
  },
  completed: {
    label: "Tamamlandı / Completed",
    bgClass: "bg-blue-100 border-blue-300",
    textClass: "text-blue-800",
  },
  cancelled: {
    label: "İptal Edildi / Cancelled",
    bgClass: "bg-red-100 border-red-300",
    textClass: "text-red-800",
  },
  no_show: {
    label: "Gelmedi / No Show",
    bgClass: "bg-sage-soft border-input",
    textClass: "text-muted-foreground",
  },
};

export function BookingDetailSheet({
  booking,
  onClose,
  onStatusUpdated,
}: BookingDetailSheetProps) {
  const [updating, setUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState(booking?.notes || "");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!booking) return null;

  const currentStatusInfo = STATUS_LABELS[booking.status as BookingStatus] || {
    label: booking.status,
    bgClass: "bg-muted border-border",
    textClass: "text-foreground",
  };

  const handleStatusChange = async (targetStatus: BookingStatus) => {
    if (targetStatus === "cancelled" && !confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }

    setUpdating(true);
    setErrorMsg(null);

    const { success, error } = await updateAdminBookingStatus(
      booking.id,
      targetStatus,
      adminNotes
    );

    setUpdating(false);
    setConfirmingCancel(false);

    if (error) {
      setErrorMsg(error);
    } else if (success) {
      onStatusUpdated();
    }
  };

  const slotStart = booking.availability_slots?.starts_at
    ? new Date(booking.availability_slots.starts_at)
    : null;
  const slotEnd = booking.availability_slots?.ends_at
    ? new Date(booking.availability_slots.ends_at)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl z-10 border-l border-border">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-card text-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-[#819586]" />
            <h2 className="text-sm font-semibold tracking-wide">
              Randevu Detayı / Booking Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sage-soft hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {/* Status Banner */}
          <div className="flex items-center justify-between rounded-xl border p-4 shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Mevcut Durum / Current Status
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${currentStatusInfo.bgClass} ${currentStatusInfo.textClass}`}
                >
                  {currentStatusInfo.label}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              ID: <span className="font-mono text-[10px]">{booking.id.slice(0, 8)}…</span>
            </div>
          </div>

          {/* Appointment Slot Info */}
          <div className="rounded-xl border border-border bg-background-soft/50 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-[#819586]" />
              <span>Randevu Zamanı / Appointment Time</span>
            </h3>

            {slotStart && slotEnd ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Tarih / Date</span>
                  <span className="font-semibold text-foreground">
                    {slotStart.toLocaleDateString("tr-TR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Saat Dilimi / Time</span>
                  <span className="font-semibold text-foreground">
                    {slotStart.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {slotEnd.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                Ayrılmış zaman dilimi bulunamadı. / No linked slot details.
              </div>
            )}
          </div>

          {/* Client Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <User className="size-4 text-[#10271B]" />
              <span>Öğrenci & İletişim Bilgileri / Client Info</span>
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
                <User className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-muted-foreground">Ad Soyad</div>
                  <div className="font-semibold text-foreground">
                    {booking.full_name}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
                <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-muted-foreground">E-Posta</div>
                  <a
                    href={`mailto:${booking.email}`}
                    className="font-semibold text-[#10271B] hover:underline"
                  >
                    {booking.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
                <Phone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-muted-foreground">Telefon</div>
                  <div className="font-semibold text-foreground">
                    {booking.phone || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
                <BookOpen className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-muted-foreground">Sınav / Ders</div>
                  <div className="font-semibold text-foreground">
                    {booking.exam_code || booking.custom_exam || "Genel Danışmanlık"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submission Context */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              <span>Başvuru Detayları / Submission Metadata</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground">Oluşturulma Tarihi</div>
                <div className="font-medium text-foreground">
                  {new Date(booking.created_at).toLocaleString("tr-TR")}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground">Dil / Locale</div>
                <div className="font-medium uppercase text-foreground">
                  {booking.locale}
                </div>
              </div>
            </div>
          </div>

          {/* Admin Notes */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <span>Yönetici Notları / Admin Notes</span>
            </label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Randevu ile ilgili not ekleyin..."
              className="w-full rounded-lg border border-input p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden"
            />
          </div>

          {/* Status Change Controls */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-xs font-bold text-foreground">
              Durumu Güncelle / Change Status
            </div>

            {confirmingCancel && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span>Randevuyu İptal Etmek İstediğinizden Emin Misiniz?</span>
                </div>
                <p className="text-[11px]">
                  Bu işlem randevu durumunu &apos;cancelled&apos; yapacaktır.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleStatusChange("cancelled")}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {updating ? "İptal Ediliyor…" : "Evet, İptal Et"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="rounded-md border border-input bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            )}

            {!confirmingCancel && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  disabled={updating || booking.status === "confirmed"}
                  onClick={() => handleStatusChange("confirmed")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Onayla</span>
                </button>

                <button
                  type="button"
                  disabled={updating || booking.status === "completed"}
                  onClick={() => handleStatusChange("completed")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Tamamla</span>
                </button>

                <button
                  type="button"
                  disabled={updating || booking.status === "no_show"}
                  onClick={() => handleStatusChange("no_show")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-input bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-sage-soft disabled:opacity-40"
                >
                  <XCircle className="size-3.5" />
                  <span>Gelmedi</span>
                </button>

                <button
                  type="button"
                  disabled={updating || booking.status === "cancelled"}
                  onClick={() => handleStatusChange("cancelled")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-40"
                >
                  <AlertTriangle className="size-3.5" />
                  <span>İptal Et</span>
                </button>
              </div>
            )}

            {updating && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                <AdminWaveStatus label="Güncelleniyor…" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
