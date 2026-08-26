"use client";

import type { NotificationDeliveryRow } from "@/lib/admin/notifications";
import { humanizeNotificationSubject } from "@/lib/admin/notifications";
import {
  X,
  Send,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ExternalLink,
  Tag,
  Copy,
  Code2,
} from "lucide-react";
import Link from "next/link";

interface NotificationDetailSheetProps {
  delivery: NotificationDeliveryRow | null;
  onClose: () => void;
}

export function NotificationDetailSheet({
  delivery,
  onClose,
}: NotificationDetailSheetProps) {
  if (!delivery) return null;

  const isContact = delivery.entity_type === "contact_request";
  const isBooking = delivery.entity_type === "booking";
  const isStudent = delivery.entity_type === "student_profile" || delivery.entity_type === "student" || delivery.entity_type === "user";
  const isAdminEvent = delivery.event_type.includes("admin_notification");
  const subjectTitle = humanizeNotificationSubject(delivery, "tr");

  const targetLink = isContact
    ? "/admin/iletisim"
    : isBooking
    ? "/admin/randevular"
    : isStudent
    ? `/admin/ogrenciler?student=${delivery.entity_id}`
    : null;

  const studentSearchUrl = `/admin/ogrenciler?search=${encodeURIComponent(delivery.recipient)}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl z-10 border-l border-border">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-card text-foreground">
          <div className="flex items-center gap-2">
            <Send className="size-5 text-[#819586]" />
            <h2 className="text-sm font-semibold tracking-wide">
              Bildirim Teslimat Detayı / Delivery Details
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
          {/* Status & Subject Banner */}
          <div className="rounded-xl border p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Teslimat Durumu / Status
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                Kanal: <span className="font-semibold uppercase text-foreground">{delivery.channel || "email"}</span> &middot; <span className="font-semibold uppercase">{delivery.provider}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${
                  delivery.status === "sent"
                    ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                    : delivery.status === "failed"
                    ? "bg-red-100 border-red-300 text-red-800"
                    : "bg-amber-100 border-amber-300 text-amber-800"
                }`}
              >
                {delivery.status === "sent" ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Gönderildi (Sent)</span>
                  </>
                ) : delivery.status === "failed" ? (
                  <>
                    <AlertCircle className="size-3.5" />
                    <span>Başarısız (Failed)</span>
                  </>
                ) : (
                  <>
                    <Clock className="size-3.5" />
                    <span>Bekliyor (Pending)</span>
                  </>
                )}
              </span>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="text-[11px] text-muted-foreground">Konu (Subject)</div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                {subjectTitle}
              </div>
            </div>
          </div>

          {/* Delivery Metadata */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Mail className="size-4 text-[#10271B]" />
              <span>Alıcı & Etkinlik Bilgileri</span>
            </h3>

            <div className="rounded-xl border border-border bg-background-soft/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground">Hedef Alıcı (Recipient)</div>
                  <div className="text-sm font-bold text-foreground font-mono">
                    {delivery.recipient}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">Kategori</div>
                  <div className="text-xs font-semibold text-foreground">
                    {isAdminEvent ? "Yönetici Bildirimi" : "Öğrenci / Kullanıcı Bildirimi"}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`mailto:${delivery.recipient}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    <Mail className="size-3.5" />
                    <span>E-posta Gönder</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(delivery.recipient)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    <Copy className="size-3.5" />
                    <span>E-postayı Kopyala</span>
                  </button>
                  <Link
                    href={studentSearchUrl}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 text-primary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary/20"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Öğrenciyi Aç</span>
                  </Link>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Tag className="size-3 text-muted-foreground" />
                    <span>Event Type:</span>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#10271B]">
                    {delivery.event_type}
                  </span>
                </div>

                {delivery.provider_message_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Mesaj ID:</span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                      {delivery.provider_message_id}
                    </span>
                  </div>
                )}

                {delivery.last_error_code && (
                  <div className="flex items-center justify-between text-xs text-red-600 font-semibold">
                    <span>Hata Kodu:</span>
                    <span className="font-mono text-[11px]">{delivery.last_error_code}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timestamps & Entity Context */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Calendar className="size-4 text-[#819586]" />
              <span>Zaman Damgası & İlişkili Kayıt</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground">Oluşturulma Tarihi</div>
                <div className="font-semibold text-foreground mt-0.5">
                  {new Date(delivery.created_at).toLocaleString("tr-TR")}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground">Gönderim Tarihi</div>
                <div className="font-semibold text-foreground mt-0.5">
                  {delivery.sent_at ? new Date(delivery.sent_at).toLocaleString("tr-TR") : "—"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-4 shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground">İlişkili Varlık (Entity)</div>
                <div className="text-xs font-bold text-foreground capitalize">
                  {delivery.entity_type} {delivery.entity_id ? `(ID: ${delivery.entity_id.slice(0, 8)}…)` : ""}
                </div>
              </div>

              {targetLink && (
                <Link
                  href={targetLink}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background-soft px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  <span>Modüle Git</span>
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* Collapsible Technical Details / Raw JSON Payload */}
          <details className="group rounded-xl border border-border bg-background-soft/30 p-3">
            <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <Code2 className="size-4 text-muted-foreground" />
                <span>Teknik Detay & Ham Payload (JSON)</span>
              </span>
              <span className="text-[11px] font-normal group-open:hidden">Genişlet &darr;</span>
              <span className="text-[11px] font-normal hidden group-open:inline">Daralt &uarr;</span>
            </summary>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-slate-900 p-3 text-[11px] font-mono text-emerald-400">
              <pre>{JSON.stringify(delivery.payload || {}, null, 2)}</pre>
            </div>
          </details>

          {/* Secure Retry Policy Notice */}
          <div className="rounded-xl border border-border bg-background-soft p-4 text-xs text-muted-foreground space-y-1">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
              <span>Güvenli E-Posta Gönderim Politikası</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              E-posta ve kimlik doğrulama anahtarları tarayıcı tarafına asla sunulmaz. Tüm bildirim işlemleri güvenlik protokolü gereği yalnızca sunucu tarafı Supabase Edge Function workflows üzerinden yetkili olarak yönetilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
