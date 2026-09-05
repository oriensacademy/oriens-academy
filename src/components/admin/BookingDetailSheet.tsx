"use client";

import { useState } from "react";
import type { BookingWithSlot, BookingStatus, ScheduleEventType } from "@/lib/admin/bookings";
import {
  updateAdminBookingStatus,
  updateAdminBookingEvent,
  sendAdminBookingNotification,
} from "@/lib/admin/bookings";
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
  Edit3,
  Video,
  Save,
  RotateCcw,
  Send,
  BellRing,
} from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import { useToast } from "@/components/ui/toast";

interface BookingDetailSheetProps {
  booking: BookingWithSlot | null;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const STATUS_LABELS: Record<BookingStatus, { label: string; bgClass: string; textClass: string }> = {
  pending: {
    label: "Bekliyor",
    bgClass: "bg-amber-100 border-amber-300",
    textClass: "text-amber-800",
  },
  confirmed: {
    label: "Onaylandı",
    bgClass: "bg-emerald-100 border-emerald-300",
    textClass: "text-emerald-800",
  },
  completed: {
    label: "Tamamlandı",
    bgClass: "bg-blue-100 border-blue-300",
    textClass: "text-blue-800",
  },
  cancelled: {
    label: "İptal Edildi",
    bgClass: "bg-red-100 border-red-300",
    textClass: "text-red-800",
  },
  no_show: {
    label: "Katılmadı",
    bgClass: "bg-gray-100 border-gray-300",
    textClass: "text-gray-800",
  },
};

const EVENT_TYPE_OPTIONS: Array<{ value: ScheduleEventType; labelTr: string; labelEn: string; freeNotice: boolean }> = [
  { value: "lesson", labelTr: "Canlı Ders", labelEn: "Live Lesson", freeNotice: false },
  { value: "pre_consultation", labelTr: "Ön Görüşme", labelEn: "Pre-Consultation", freeNotice: true },
  { value: "additional_consultation", labelTr: "Ek Görüşme", labelEn: "Follow-up Meeting", freeNotice: true },
  { value: "consultation", labelTr: "Danışmanlık", labelEn: "Consultation", freeNotice: true },
  { value: "other", labelTr: "Diğer", labelEn: "Other", freeNotice: true },
];

export function BookingDetailSheet({
  booking,
  onClose,
  onStatusUpdated,
}: BookingDetailSheetProps) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState(booking?.notes || "");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Form State
  const initialDate = booking?.availability_slots?.starts_at
    ? new Date(booking.availability_slots.starts_at).toISOString().slice(0, 10)
    : "";
  const initialStartTime = booking?.availability_slots?.starts_at
    ? new Date(booking.availability_slots.starts_at).toTimeString().slice(0, 5)
    : "10:00";
  const initialEndTime = booking?.availability_slots?.ends_at
    ? new Date(booking.availability_slots.ends_at).toTimeString().slice(0, 5)
    : "11:00";

  const [editEventType, setEditEventType] = useState<ScheduleEventType>(
    (booking?.event_type as ScheduleEventType) || "lesson"
  );
  const [editSubject, setEditSubject] = useState(booking?.appointment_subject || "");
  const [editExam, setEditExam] = useState(booking?.custom_exam || booking?.exam_code || "");
  const [editDate, setEditDate] = useState(initialDate);
  const [editStartTime, setEditStartTime] = useState(initialStartTime);
  const [editEndTime, setEditEndTime] = useState(initialEndTime);
  const [editMeetingUrl, setEditMeetingUrl] = useState(booking?.live_meeting_url || "");
  const [editNotes, setEditNotes] = useState(booking?.notes || "");
  const [editStatus, setEditStatus] = useState<BookingStatus>(
    (booking?.status as BookingStatus) || "confirmed"
  );
  const [sendNotification, setSendNotification] = useState(false);
  const [sendCancelNotification, setSendCancelNotification] = useState(false);
  const [sendingManualEmail, setSendingManualEmail] = useState<string | null>(null);

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

    const { success, error, emailSent } = await updateAdminBookingStatus(
      booking.id,
      targetStatus,
      adminNotes,
      targetStatus === "cancelled" ? sendCancelNotification : false
    );

    setUpdating(false);
    setConfirmingCancel(false);

    if (error) {
      setErrorMsg(error);
    } else if (success) {
      toast.success(
        emailSent
          ? "Durum güncellendi ve hesap sahibine e-posta bildirimi gönderildi."
          : "Durum başarıyla güncellendi."
      );
      onStatusUpdated();
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setErrorMsg(null);

    let startsAtIso: string | null = null;
    let endsAtIso: string | null = null;

    if (editDate && editStartTime && editEndTime) {
      startsAtIso = new Date(`${editDate}T${editStartTime}:00`).toISOString();
      endsAtIso = new Date(`${editDate}T${editEndTime}:00`).toISOString();

      if (new Date(endsAtIso) <= new Date(startsAtIso)) {
        setUpdating(false);
        setErrorMsg("Bitiş saati başlangıç saatinden sonra olmalıdır.");
        return;
      }
    }

    const { success, error } = await updateAdminBookingEvent({
      bookingId: booking.id,
      eventType: editEventType,
      subject: editSubject.trim() || null,
      exam: editExam.trim() || null,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      liveMeetingUrl: editMeetingUrl.trim() || null,
      notes: editNotes.trim() || null,
      status: editStatus,
      sendNotification,
    });

    setUpdating(false);

    if (error) {
      setErrorMsg(error);
    } else if (success) {
      toast.success("Randevu detayları başarıyla kaydedildi.");
      setIsEditing(false);
      onStatusUpdated();
    }
  };

  const handleSendManualEmail = async (action: "confirm" | "remind") => {
    setSendingManualEmail(action);
    setErrorMsg(null);
    const res = await sendAdminBookingNotification(booking.id, action);
    setSendingManualEmail(null);
    if (!res.success) {
      setErrorMsg(res.error || "İşlem kaydedildi ancak e-posta gönderilemedi.");
    } else {
      toast.success(
        action === "remind"
          ? "Hatırlatma e-postası başarıyla gönderildi."
          : "Bilgilendirme e-postası başarıyla gönderildi."
      );
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
              {isEditing ? "Randevuyu Düzenle" : "Randevu Detayı"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Edit3 className="size-3.5" />
                <span>Düzenle</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                <RotateCcw className="size-3.5" />
                <span>Vazgeç</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sage-soft hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {/* EDIT FORM MODE */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-5">
              {/* Event Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  Etkinlik Türü
                </label>
                <select
                  value={editEventType}
                  onChange={(e) => setEditEventType(e.target.value as ScheduleEventType)}
                  className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                >
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.labelTr} {opt.freeNotice ? "(Paketten düşmez)" : "(1 Ders hakkı)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject / Lesson Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  Ders / Konu Başlığı
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Örn: SAT Math - Advanced Quadratics"
                  className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                />
              </div>

              {/* Exam / Qualification */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  Sınav / Alan (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={editExam}
                  onChange={(e) => setEditExam(e.target.value)}
                  placeholder="Örn: SAT, IB, AP, TMUA"
                  className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                />
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">Tarih</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">Başlangıç</label>
                  <input
                    type="time"
                    required
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">Bitiş</label>
                  <input
                    type="time"
                    required
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                </div>
              </div>

              {/* Meeting Link */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Video className="size-3.5 text-primary" />
                  <span>Ders / Görüşme Bağlantısı (Google Meet / Zoom)</span>
                </label>
                <input
                  type="url"
                  value={editMeetingUrl}
                  onChange={(e) => setEditMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/xyz-abc-def"
                  className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                />
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">Durum</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as BookingStatus)}
                  className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                >
                  <option value="confirmed">Onaylandı (Confirmed)</option>
                  <option value="pending">Bekliyor</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal Edildi</option>
                  <option value="no_show">Gelmedi</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">Yönetici / Seans Notu</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ders veya görüşme ile ilgili notlar..."
                  className="w-full rounded-lg border border-input p-2.5 text-xs text-foreground"
                />
              </div>

              {/* Notification Checkbox (Default: OFF) */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>Hesap sahibine e-posta ile bildir</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <button
                  type="submit"
                  disabled={updating}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#10271B] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40"
                >
                  {updating ? <Wave className="h-3.5 w-7 text-amber-400" aria-label="Kaydediliyor" /> : <Save className="size-3.5" />}
                  <span>Değişiklikleri Kaydet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-border bg-white px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          ) : (
            /* READ ONLY VIEW MODE */
            <>
              {/* Status Banner */}
              <div className="flex items-center justify-between rounded-xl border p-4 shadow-xs">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Mevcut Durum
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${currentStatusInfo.bgClass} ${currentStatusInfo.textClass}`}
                    >
                      {currentStatusInfo.label}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      &middot; {EVENT_TYPE_OPTIONS.find((o) => o.value === booking.event_type)?.labelTr || "Ders"}
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
                  <span>Randevu Zamanı</span>
                </h3>

                {slotStart && slotEnd ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tarih</span>
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
                      <span className="text-muted-foreground block text-[11px]">Saat</span>
                      <span className="font-semibold text-foreground">
                        {slotStart.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} –{" "}
                        {slotEnd.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Ayrılmış zaman dilimi bulunamadı.
                  </div>
                )}

                {booking.live_meeting_url && (
                  <div className="pt-2 border-t border-border/70 flex items-center gap-2 text-xs">
                    <Video className="size-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">Bağlantı:</span>
                    <a
                      href={booking.live_meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline truncate max-w-xs"
                    >
                      {booking.live_meeting_url}
                    </a>
                  </div>
                )}
              </div>

              {/* Client Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <User className="size-4 text-[#10271B]" />
                  <span>Hesap Sahibi ve İletişim Bilgileri</span>
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

                  {booking.phone && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
                      <Phone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] text-muted-foreground">Telefon</div>
                        <div className="font-semibold text-foreground">
                          {booking.phone}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
                    <BookOpen className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] text-muted-foreground">Sınav / Ders</div>
                      <div className="font-semibold text-foreground">
                        {booking.appointment_subject || booking.exam_code || booking.custom_exam || "Genel Danışmanlık"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submission Context */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <span>Başvuru Detayları</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border bg-white p-3">
                    <div className="text-[11px] text-muted-foreground">Oluşturulma Tarihi</div>
                    <div className="font-medium text-foreground">
                      {new Date(booking.created_at).toLocaleString("tr-TR")}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-white p-3">
                    <div className="text-[11px] text-muted-foreground">E-posta Dili</div>
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
                  <span>Yönetici Notları</span>
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Randevu ile ilgili not ekleyin..."
                  className="w-full rounded-lg border border-input p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden"
                />
              </div>

              {/* Manual Email Actions (Decoupled, On-Demand) */}
              <div className="rounded-xl border border-border bg-[#F9FAF8] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-primary" />
                    <span>E-posta Bildirimleri (İsteğe Bağlı)</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Manuel Gönderim</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Randevu işlemleri otomatik e-posta göndermez. Hesap sahibine bilgilendirme göndermek istediğinizde aşağıdaki seçenekleri kullanabilirsiniz.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={Boolean(sendingManualEmail) || updating}
                    onClick={() => handleSendManualEmail("confirm")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Send className="size-3 text-primary" />
                    <span>{booking.status === "confirmed" ? "Tekrar Gönder" : "E-posta Gönder"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(sendingManualEmail) || updating}
                    onClick={() => handleSendManualEmail("remind")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                  >
                    <BellRing className="size-3 text-amber-600" />
                    <span>Hatırlatma E-postası Gönder</span>
                  </button>
                </div>
                {sendingManualEmail && (
                  <div className="text-[11px] text-primary flex items-center gap-1.5 pt-1">
                    <Wave className="size-3 text-primary" />
                    <span>E-posta gönderiliyor…</span>
                  </div>
                )}
              </div>

              {/* Status Change Controls */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="text-xs font-bold text-foreground">
                  Hızlı Durum Güncelle
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
                    <div className="pt-1">
                      <label className="flex items-center gap-2 text-xs text-amber-950 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendCancelNotification}
                          onChange={(e) => setSendCancelNotification(e.target.checked)}
                          className="size-4 rounded border-amber-400 text-red-600 focus:ring-red-600 cursor-pointer"
                        />
                        <span>E-posta ile iptali bildir</span>
                      </label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => handleStatusChange("cancelled")}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        {updating ? "İptal Ediliyor…" : "Evet, İptal Et"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingCancel(false)}
                        className="rounded-md border border-input bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
