"use client";

import { useState, useEffect } from "react";
import type {
  ContactRequestRow,
  ContactStatus,
  NotificationDeliveryRow,
} from "@/lib/admin/contacts";
import {
  updateAdminContactStatus,
  getContactNotificationDeliveries,
} from "@/lib/admin/contacts";
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Globe,
  FileText,
  Copy,
  Check,
  Send,
  CheckCircle2,
  AlertCircle,
  Inbox,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { Wave } from "@/components/ui/wave";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

interface ContactDetailSheetProps {
  contact: ContactRequestRow | null;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const STATUS_CONFIG: Record<
  ContactStatus,
  { label: string; bgClass: string; textClass: string }
> = {
  new: {
    label: "Yeni / New",
    bgClass: "bg-[#819586]/10 border-amber-300",
    textClass: "text-[#819586] font-bold",
  },
  in_progress: {
    label: "İşlemde / In Progress",
    bgClass: "bg-blue-100 border-blue-300",
    textClass: "text-blue-800 font-semibold",
  },
  resolved: {
    label: "Çözüldü / Resolved",
    bgClass: "bg-emerald-100 border-emerald-300",
    textClass: "text-emerald-800 font-semibold",
  },
  spam: {
    label: "Spam / Önemsiz",
    bgClass: "bg-sage-soft border-input",
    textClass: "text-muted-foreground font-medium",
  },
};

export function ContactDetailSheet({
  contact,
  onClose,
  onStatusUpdated,
}: ContactDetailSheetProps) {
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Deliveries State
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRow[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  useEffect(() => {
    if (!contact) return;

    let mounted = true;
    const timer = setTimeout(() => {
      setLoadingDeliveries(true);

      getContactNotificationDeliveries(contact.id).then(({ data }) => {
        if (mounted) {
          setDeliveries(data);
          setLoadingDeliveries(false);
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [contact]);

  if (!contact) return null;

  const currentStatusInfo = STATUS_CONFIG[contact.status as ContactStatus] || {
    label: contact.status,
    bgClass: "bg-muted border-border",
    textClass: "text-foreground",
  };

  const handleStatusChange = async (targetStatus: ContactStatus) => {
    setUpdating(true);
    setErrorMsg(null);

    const { success, error } = await updateAdminContactStatus(
      contact.id,
      targetStatus
    );

    setUpdating(false);

    if (error) {
      setErrorMsg(error);
    } else if (success) {
      onStatusUpdated();
    }
  };

  const copyToClipboard = (text: string, type: "email" | "phone") => {
    navigator.clipboard.writeText(text);
    if (type === "email") {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

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
            <Mail className="size-5 text-[#819586]" />
            <h2 className="text-sm font-semibold tracking-wide">
              İletişim Talebi Detayı / Contact Request Details
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
                  className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs ${currentStatusInfo.bgClass} ${currentStatusInfo.textClass}`}
                >
                  {currentStatusInfo.label}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              ID: <span className="font-mono text-[10px]">{contact.id.slice(0, 8)}…</span>
            </div>
          </div>

          {/* Sender & Contact Actions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <User className="size-4 text-[#10271B]" />
              <span>Gönderen Bilgileri / Contact Info</span>
            </h3>

            <div className="rounded-xl border border-border bg-background-soft/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground">Ad Soyad</div>
                  <div className="text-sm font-bold text-foreground">
                    {contact.full_name}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>{new Date(contact.created_at).toLocaleString("tr-TR")}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 border-t border-border">
                {/* Email Action */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-white p-2.5">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Mail className="size-4 text-[#10271B] shrink-0" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-xs font-semibold text-[#10271B] hover:underline truncate"
                    >
                      {contact.email}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(contact.email, "email")}
                    className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                    title="E-postayı Kopyala"
                  >
                    {copiedEmail ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  </button>
                </div>

                {/* Phone Action */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-white p-2.5">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Phone className="size-4 text-emerald-600 shrink-0" />
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-xs font-semibold text-foreground hover:underline truncate"
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Telefon Yok</span>
                    )}
                  </div>
                  {contact.phone && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(contact.phone || "", "phone")}
                      className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                      title="Telefonu Kopyala"
                    >
                      {copiedPhone ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Subject & Message Content */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-[#819586]" />
              <span>Mesaj İçeriği / Message Body</span>
            </h3>

            {contact.subject && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background-soft px-3 py-2 text-xs font-semibold text-foreground">
                <Tag className="size-3.5 text-muted-foreground shrink-0" />
                <span>Konu: {contact.subject}</span>
              </div>
            )}

            <div className="whitespace-pre-wrap rounded-xl border border-border bg-white p-4 text-xs leading-relaxed text-foreground shadow-2xs font-sans">
              {contact.message}
            </div>
          </div>

          {/* Submission Context & Metadata */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-white p-3">
              <Globe className="size-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[11px] text-muted-foreground">Dil / Locale</div>
                <div className="font-semibold uppercase text-foreground">
                  {contact.locale}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-white p-3">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[11px] text-muted-foreground">Gizlilik Onayı</div>
                <div className="font-semibold text-foreground">
                  {contact.privacy_consent ? "Kabul Edildi" : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Related Notification Deliveries */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Send className="size-4 text-[#10271B]" />
              <span>E-Posta Bildirim Teslimatı / Resend Deliveries</span>
            </h3>

            {loadingDeliveries ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <AdminWaveStatus label="Bildirim teslimatları sorgulanıyor…" />
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-xs text-muted-foreground italic p-3 rounded-lg border border-border bg-background-soft">
                Bu talep için henüz kaydolmuş bildirim teslimat kaydı yok.
              </div>
            ) : (
              <div className="space-y-2">
                {deliveries.map((del) => {
                  const isAdminEvent = del.event_type.includes("admin_notification");
                  return (
                    <div
                      key={del.id}
                      className="rounded-lg border border-border bg-background-soft/80 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>
                            {isAdminEvent
                              ? "Yönetici Bildirim E-postası (Admin)"
                              : "Öğrenci Onay E-postası (Student)"}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                            del.status === "sent"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {del.status === "sent" ? "Gönderildi (Sent)" : del.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        Alıcı: <span className="font-medium text-foreground">{del.recipient}</span>
                      </div>

                      {del.provider_message_id && (
                        <div className="text-[10px] font-mono text-muted-foreground truncate">
                          Resend ID: {del.provider_message_id}
                        </div>
                      )}

                      {del.sent_at && (
                        <div className="text-[10px] text-muted-foreground">
                          Tarih: {new Date(del.sent_at).toLocaleString("tr-TR")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Workflow Status Change Controls */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-xs font-bold text-foreground">
              Talep Durumunu Güncelle / Change Status
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                disabled={updating || contact.status === "new"}
                onClick={() => handleStatusChange("new")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
              >
                <Inbox className="size-3.5" />
                <span>Yeni</span>
              </button>

              <button
                type="button"
                disabled={updating || contact.status === "in_progress"}
                onClick={() => handleStatusChange("in_progress")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40"
              >
                <Wave className="h-3.5 w-7" aria-label="İşlemde" />
                <span>İşlemde</span>
              </button>

              <button
                type="button"
                disabled={updating || contact.status === "resolved"}
                onClick={() => handleStatusChange("resolved")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Çözüldü</span>
              </button>

              <button
                type="button"
                disabled={updating || contact.status === "spam"}
                onClick={() => handleStatusChange("spam")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-input bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-sage-soft disabled:opacity-40"
              >
                <AlertCircle className="size-3.5" />
                <span>Spam</span>
              </button>
            </div>

            {updating && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                <AdminWaveStatus label="Durum güncelleniyor…" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
