"use client";

import { useState } from "react";
import type { NotificationDeliveryRow } from "@/lib/admin/notifications";
import { humanizeNotificationSubject, humanizeEventType } from "@/lib/admin/notifications";
import {
  X,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Code2,
  Check,
  User,
  Tag,
  Radio,
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
  const [copied, setCopied] = useState(false);

  if (!delivery) return null;

  const isContact = delivery.entity_type === "contact_request";
  const isBooking = delivery.entity_type === "booking";
  const isStudent =
    delivery.entity_type === "student_profile" ||
    delivery.entity_type === "student" ||
    delivery.entity_type === "user";

  const subjectTitle = humanizeNotificationSubject(delivery, "tr");
  const humanizedType = humanizeEventType(delivery.event_type, "tr");

  // Extract recipient name if stored in payload
  const payload = (typeof delivery.payload === "object" && delivery.payload !== null
    ? delivery.payload
    : {}) as Record<string, unknown>;

  const recipientName =
    (typeof payload.fullName === "string" && payload.fullName.trim()) ||
    (typeof payload.studentName === "string" && payload.studentName.trim()) ||
    (typeof payload.name === "string" && payload.name.trim()) ||
    null;

  const targetStudentUrl = isStudent && delivery.entity_id
    ? `/admin/ogrenciler?student=${delivery.entity_id}`
    : `/admin/ogrenciler?search=${encodeURIComponent(delivery.recipient)}`;

  const moduleUrl = isContact
    ? `/admin/iletisim-destek?view=web&id=${delivery.entity_id}`
    : isBooking
    ? "/admin/randevular"
    : null;

  const copyEmail = () => {
    navigator.clipboard.writeText(delivery.recipient);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-ui">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#10271B]/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl z-10 border-l border-[#DDE5DC]">
        {/* Header with Localized Subject as Primary Title */}
        <div className="flex items-start justify-between border-b border-[#DDE5DC] p-5 bg-[#F8FAF7] text-foreground">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#819586] uppercase">
              <Mail className="size-3.5" />
              <span>Bildirim Detayı</span>
            </div>
            <h2 className="mt-1 text-base font-semibold text-[#172033] leading-snug line-clamp-2">
              {subjectTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#EEF2EC] hover:text-[#10271B] transition-colors"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Main Key Information Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status Card */}
            <div className="rounded-xl border border-[#DDE5DC] bg-white p-3.5 shadow-2xs">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                Teslimat Durumu
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                {delivery.status === "sent" || delivery.status === "delivered" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="size-3.5" />
                    <span>Gönderildi</span>
                  </span>
                ) : delivery.status === "failed" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-800">
                    <AlertCircle className="size-3.5" />
                    <span>Başarısız</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    <Clock className="size-3.5" />
                    <span>Bekliyor</span>
                  </span>
                )}
              </div>
            </div>

            {/* Channel Card */}
            <div className="rounded-xl border border-[#DDE5DC] bg-white p-3.5 shadow-2xs">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                Gönderim Kanalı
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-[#172033]">
                <Radio className="size-3.5 text-[#819586]" />
                <span>E-posta</span>
              </div>
            </div>
          </div>

          {/* Recipient Card */}
          <div className="rounded-xl border border-[#DDE5DC] bg-[#F8FAF7] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                Alıcı Bilgileri
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D6DED5] bg-white px-2 py-1 text-[11px] font-semibold text-[#172033] hover:bg-[#EEF2EC] transition-colors"
                >
                  {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  <span>{copied ? "Kopyalandı" : "E-postayı Kopyala"}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {recipientName && (
                <div className="flex items-center gap-1.5 font-semibold text-sm text-[#172033]">
                  <User className="size-4 text-[#819586]" />
                  <span>{recipientName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#475467] break-all">
                <Mail className="size-3.5 text-[#819586] shrink-0" />
                <span>{delivery.recipient}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-[#DDE5DC] flex flex-wrap gap-2">
              <Link
                href={targetStudentUrl}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#10271B] bg-[#10271B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1C3B2B] transition-colors"
              >
                <ExternalLink className="size-3.5" />
                <span>Öğrenciyi Aç</span>
              </Link>

              {moduleUrl && (
                <Link
                  href={moduleUrl}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DED5] bg-white px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#EEF2EC] transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  <span>{isContact ? "Talebi Görüntüle" : "Randevuyu Görüntüle"}</span>
                </Link>
              )}

              <a
                href={`mailto:${delivery.recipient}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DED5] bg-white px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#EEF2EC] transition-colors"
              >
                <Mail className="size-3.5" />
                <span>E-posta Gönder</span>
              </a>
            </div>
          </div>

          {/* Notification Type & Date Card */}
          <div className="rounded-xl border border-[#DDE5DC] bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#667085] font-medium flex items-center gap-1.5">
                <Tag className="size-3.5 text-[#819586]" />
                <span>Bildirim Türü:</span>
              </span>
              <span className="font-semibold text-[#172033]">{humanizedType}</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#F2F5EF]">
              <span className="text-[#667085] font-medium flex items-center gap-1.5">
                <Calendar className="size-3.5 text-[#819586]" />
                <span>Oluşturulma:</span>
              </span>
              <span className="font-medium text-[#172033] tabular-nums">
                {new Date(delivery.created_at).toLocaleString("tr-TR")}
              </span>
            </div>

            {delivery.sent_at && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#F2F5EF]">
                <span className="text-[#667085] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>İletilme Tarihi:</span>
                </span>
                <span className="font-medium text-[#172033] tabular-nums">
                  {new Date(delivery.sent_at).toLocaleString("tr-TR")}
                </span>
              </div>
            )}

            {delivery.last_error_code && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#F2F5EF] text-red-700">
                <span className="font-medium flex items-center gap-1.5">
                  <AlertCircle className="size-3.5" />
                  <span>Hata Kodu:</span>
                </span>
                <span className="font-mono text-[11px] font-bold">{delivery.last_error_code}</span>
              </div>
            )}
          </div>

          {/* Collapsible Technical Details (Collapsed by default) */}
          <details className="group rounded-xl border border-[#DDE5DC] bg-[#F8FAF7] p-3 text-xs transition-all">
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-[#667085] hover:text-[#172033] select-none">
              <span className="flex items-center gap-2">
                <Code2 className="size-4 text-[#819586]" />
                <span>Teknik Detaylar</span>
              </span>
              <span className="text-[11px] font-medium text-[#819586] group-open:hidden">Genişlet &darr;</span>
              <span className="text-[11px] font-medium text-[#819586] hidden group-open:inline">Daralt &uarr;</span>
            </summary>

            <div className="mt-3 space-y-2 pt-2 border-t border-[#DDE5DC] text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Sağlayıcı:</span>
                <span className="font-mono uppercase font-semibold text-[#172033]">{delivery.provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Olay Anahtarı:</span>
                <span className="font-mono text-[#172033]">{delivery.event_type}</span>
              </div>
              {delivery.provider_message_id && (
                <div className="flex items-center justify-between">
                  <span className="text-[#667085]">Mesaj ID:</span>
                  <span className="font-mono text-[#172033] truncate max-w-[220px]">{delivery.provider_message_id}</span>
                </div>
              )}
              {delivery.entity_type && (
                <div className="flex items-center justify-between">
                  <span className="text-[#667085]">Varlık (Entity):</span>
                  <span className="font-mono text-[#172033]">{delivery.entity_type} ({delivery.entity_id})</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Teslimat ID:</span>
                <span className="font-mono text-[#172033]">{delivery.id}</span>
              </div>

              {delivery.payload && Object.keys(delivery.payload).length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#DDE5DC]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#667085] mb-1">Ham Payload</div>
                  <div className="overflow-x-auto rounded-lg border border-[#DDE5DC] bg-slate-900 p-2.5 text-[10px] font-mono text-emerald-400">
                    <pre>{JSON.stringify(delivery.payload, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
