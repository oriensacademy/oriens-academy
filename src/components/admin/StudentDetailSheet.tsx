"use client";

import { X, Mail, Phone, MessageCircle, CalendarPlus, MessageSquareText, CalendarCheck, Send } from "lucide-react";
import type { StudentProfile } from "@/lib/admin/students";

interface StudentDetailSheetProps {
  student: StudentProfile | null;
  onClose: () => void;
  onCreateBooking: () => void;
}

export function StudentDetailSheet({ student, onClose, onCreateBooking }: StudentDetailSheetProps) {
  if (!student) return null;
  const whatsappPhone = student.phone?.replace(/\D/g, "").replace(/^0/, "90") || "";
  const timeline = [
    ...student.contacts.map((contact) => ({
      id: `contact-${contact.id}`,
      at: contact.created_at,
      title: contact.source === "quick_contact" ? "Hızlı iletişim talebi" : "İletişim formu",
      detail: contact.message,
      icon: MessageSquareText,
    })),
    ...student.bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      at: booking.availability_slots?.starts_at || booking.created_at,
      title: `Randevu · ${booking.status}`,
      detail: booking.exam_code || booking.custom_exam || booking.notes || "Genel danışmanlık",
      icon: CalendarCheck,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-forest/30 backdrop-blur-xs" />
      <aside className="relative z-10 h-full w-full overflow-y-auto border-l border-border bg-white shadow-2xl sm:max-w-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-white/95 p-5 backdrop-blur">
          <div><h2 className="text-lg font-bold text-[#10271B]">{student.fullName}</h2><p className="text-xs text-muted-foreground">Öğrenci / kişi profili</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="space-y-6 p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="E-posta" value={student.email} />
            <Info label="Telefon" value={student.phone || "—"} />
            <Info label="İlgi Alanı" value={student.interests.join(", ") || "—"} />
            <Info label="İlişki" value={contextLabel(student.context)} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Action href={`mailto:${student.email}`} icon={Mail} label="E-posta" />
            <Action href={student.phone ? `tel:${student.phone}` : undefined} icon={Phone} label="Ara" />
            <Action href={whatsappPhone ? `https://wa.me/${whatsappPhone}` : undefined} icon={MessageCircle} label="WhatsApp" external />
            <button type="button" onClick={onCreateBooking} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#10271B] px-3 py-2 text-xs font-semibold text-white"><CalendarPlus className="size-4" />Randevu</button>
          </div>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">E-posta teslimatları</h3>
            {student.deliveries.length ? (
              <div className="space-y-2">{student.deliveries.map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-xs">
                  <div className="flex items-center gap-2"><Send className="size-3.5 text-[#819586]" /><div><div className="font-semibold">{delivery.event_type.includes("admin_notification") ? "Yönetici Bildirim E-postası" : "Öğrenci Onay E-postası"}</div><div className="font-mono text-[10px] text-muted-foreground">{delivery.event_type}</div></div></div>
                  <span className={delivery.status === "sent" ? "font-semibold text-emerald-700" : delivery.status === "failed" ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>{delivery.status === "sent" ? "Gönderildi" : delivery.status === "failed" ? "Başarısız" : "Bekliyor"}</span>
                </div>
              ))}</div>
            ) : <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Bu kişiyle eşleşen teslimat kaydı yok.</p>}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Geçmiş / Zaman Çizelgesi</h3>
            <div className="space-y-3 border-l border-[#DDE4DC] pl-4">
              {timeline.map((event) => { const Icon = event.icon; return (
                <div key={event.id} className="relative rounded-xl border border-border bg-background-soft/40 p-3">
                  <span className="absolute -left-[23px] top-3 flex size-4 items-center justify-center rounded-full bg-white ring-1 ring-[#819586]"><Icon className="size-2.5 text-[#10271B]" /></span>
                  <div className="flex items-start justify-between gap-3"><div className="text-xs font-bold">{event.title}</div><time className="shrink-0 text-[10px] text-muted-foreground">{new Date(event.at).toLocaleString("tr-TR")}</time></div>
                  <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{event.detail}</p>
                </div>
              ); })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function contextLabel(value: StudentProfile["context"]) { return value === "booking" ? "Randevulu" : value === "quick_contact" ? "Hızlı iletişim" : "Yalnızca iletişim"; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-background-soft/50 p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 break-words text-xs font-semibold">{value}</div></div>; }
function Action({ href, icon: Icon, label, external }: { href?: string; icon: typeof Mail; label: string; external?: boolean }) { return href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Icon className="size-4" />{label}</a> : <span className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground opacity-50"><Icon className="size-4" />{label}</span>; }
