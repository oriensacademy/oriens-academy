"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContactReplyRow, ContactRequestRow, ContactStatus } from "@/lib/admin/contacts";
import { listContactReplies, sendAdminContactReply, updateAdminContactStatus } from "@/lib/admin/contacts";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import { formatPackagePrice, getContactPackageContext } from "@/lib/contact/package-context";
import { AlertCircle, Calendar, CheckCircle2, Inbox, Mail, Phone, Send, Tag, User, X } from "lucide-react";

interface ContactDetailSheetProps {
  contact: ContactRequestRow | null;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; className: string }> = {
  new: { label: "Yeni / New", className: "border-amber-300 bg-amber-50 text-amber-800" },
  in_progress: { label: "İşlemde / In Progress", className: "border-blue-300 bg-blue-50 text-blue-800" },
  resolved: { label: "Çözüldü / Resolved", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  spam: { label: "Spam / Önemsiz", className: "border-input bg-muted text-muted-foreground" },
};

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() || `reply-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function deliveryLabel(status: string): string {
  if (status === "sent") return "Gönderildi / Sent";
  if (status === "failed") return "Başarısız / Failed";
  return "Gönderiliyor / Pending";
}

export function ContactDetailSheet({ contact, onClose, onStatusUpdated }: ContactDetailSheetProps) {
  if (!contact) return null;
  return <ContactDetailContent key={contact.id} contact={contact} onClose={onClose} onStatusUpdated={onStatusUpdated} />;
}

function ContactDetailContent({ contact, onClose, onStatusUpdated }: { contact: ContactRequestRow; onClose: () => void; onStatusUpdated: () => void }) {
  const [replies, setReplies] = useState<ContactReplyRow[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const refreshReplies = useCallback(async (contactId: string) => {
    setLoadingReplies(true);
    const { data, error } = await listContactReplies(contactId);
    setReplies(data);
    setLoadingReplies(false);
    if (error) setErrorMsg("Yanıt geçmişi yüklenemedi.");
  }, []);

  useEffect(() => {
    let active = true;
    listContactReplies(contact.id).then(({ data, error }) => {
      if (!active) return;
      setReplies(data);
      setLoadingReplies(false);
      if (error) setErrorMsg("Yanıt geçmişi yüklenemedi.");
    });
    return () => { active = false; };
  }, [contact.id]);

  const statusInfo = STATUS_CONFIG[contact.status as ContactStatus] || STATUS_CONFIG.new;
  const packageContext = getContactPackageContext(contact.metadata);
  const locale = contact.locale === "en" ? "en-GB" : "tr-TR";

  const handleStatusChange = async (targetStatus: ContactStatus) => {
    setUpdating(true);
    setErrorMsg(null);
    const { success, error } = await updateAdminContactStatus(contact.id, targetStatus);
    setUpdating(false);
    if (error) setErrorMsg(error);
    if (success) onStatusUpdated();
  };

  const handleReplySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const messageText = replyText.trim();
    if (!messageText || sending) return;

    setSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const result = await sendAdminContactReply({ contactRequestId: contact.id, messageText, idempotencyKey });
    setSending(false);

    if (result.error) {
      setErrorMsg(result.error);
      if (result.error.includes("sağlayıcısı")) setIdempotencyKey(newIdempotencyKey());
      await refreshReplies(contact.id);
      return;
    }

    if (result.reply) {
      setReplies((current) => {
        const withoutReply = current.filter((item) => item.id !== result.reply?.id);
        return [...withoutReply, result.reply as ContactReplyRow].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }
    setReplyText("");
    setIdempotencyKey(newIdempotencyKey());
    setSuccessMsg(result.duplicate ? "Bu yanıt daha önce gönderildi; mevcut kayıt gösteriliyor." : "Yanıt e-posta ile gönderildi ve konuşmaya kaydedildi.");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="contact-detail-title">
      <button type="button" className="fixed inset-0 bg-forest/35 backdrop-blur-xs" onClick={onClose} aria-label="Kapat / Close" />

      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-border bg-white shadow-2xl">
        <header className="flex min-h-16 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-[#819586]" />
            <h2 id="contact-detail-title" className="text-sm font-semibold tracking-wide">İletişim Talebi Detayı / Contact Request Details</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sage-soft hover:text-foreground" aria-label="Kapat / Close"><X className="size-5" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {errorMsg && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{errorMsg}</div>}
          {successMsg && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{successMsg}</div>}

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-background-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-white text-primary"><User className="size-4" /></span>
              <div>
                <div className="text-sm font-bold text-foreground">{contact.full_name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Mail className="size-3" />{contact.email}</span>
                  {contact.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{contact.phone}</span>}
                </div>
              </div>
            </div>
            <span className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${statusInfo.className}`}>{statusInfo.label}</span>
          </section>

          {packageContext && (
            <section className="rounded-xl border border-[#DDE4DC] bg-[#F6F8F3] p-4 text-xs">
              <div className="font-bold text-[#10271B]">{packageContext.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground">
                {packageContext.lessons !== null && <span>{packageContext.lessons} ders</span>}
                {formatPackagePrice(packageContext) && <span>{formatPackagePrice(packageContext)}</span>}
              </div>
            </section>
          )}

          <section className="space-y-3" aria-labelledby="conversation-title">
            <div>
              <h3 id="conversation-title" className="text-xs font-bold text-foreground">Konuşma / Conversation</h3>
              {contact.subject && <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Tag className="size-3" />{contact.subject}</div>}
            </div>

            <article className="mr-4 rounded-xl border border-border bg-white p-4 shadow-2xs sm:mr-12">
              <div className="flex flex-col gap-1 border-b border-border pb-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span><strong className="text-foreground">{contact.full_name}</strong> · {contact.email} → info@oriens-academy.com</span>
                <time dateTime={contact.created_at} className="inline-flex items-center gap-1"><Calendar className="size-3" />{new Date(contact.created_at).toLocaleString(locale)}</time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{contact.message}</p>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Alındı / Received</div>
            </article>

            {loadingReplies ? (
              <div className="py-4"><AdminWaveStatus label="Konuşma yükleniyor…" className="text-xs text-muted-foreground" /></div>
            ) : replies.map((reply) => (
              <article key={reply.id} className="ml-4 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-2xs sm:ml-12">
                <div className="flex flex-col gap-1 border-b border-primary/10 pb-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span><strong className="text-foreground">{reply.sender_name}</strong> · {reply.sender_email} → {reply.recipient_email}</span>
                  <time dateTime={reply.sent_at || reply.created_at} className="inline-flex items-center gap-1"><Calendar className="size-3" />{new Date(reply.sent_at || reply.created_at).toLocaleString(locale)}</time>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{reply.message_text}</p>
                <div className={`mt-3 text-[10px] font-semibold uppercase tracking-wide ${reply.delivery_status === "failed" ? "text-red-700" : reply.delivery_status === "sent" ? "text-emerald-700" : "text-amber-700"}`}>{deliveryLabel(reply.delivery_status)}</div>
              </article>
            ))}
          </section>

          <form onSubmit={handleReplySubmit} className="space-y-3 rounded-xl border border-border bg-background-soft/50 p-4">
            <label htmlFor="contact-reply" className="text-xs font-bold text-foreground">Yanıt / Reply</label>
            <textarea id="contact-reply" required maxLength={10000} rows={6} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Yanıtınızı yazın… / Type your reply…" className="w-full resize-y rounded-xl border border-input bg-white p-3 text-xs leading-relaxed text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-primary" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted-foreground">info@oriens-academy.com → {contact.email}</p>
              <button type="submit" disabled={sending || !replyText.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-40">
                {sending ? <Wave className="h-3.5 w-7 text-white" aria-label="Gönderiliyor" /> : <Send className="size-4" />}
                <span>{sending ? "Gönderiliyor… / Sending…" : "Gönder / Send"}</span>
              </button>
            </div>
          </form>

          <section className="space-y-3 border-t border-border pt-4">
            <div className="text-xs font-bold text-foreground">Talep Durumu / Request Status</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatusButton label="Yeni / New" disabled={updating || contact.status === "new"} onClick={() => handleStatusChange("new")} icon={<Inbox className="size-3.5" />} />
              <StatusButton label="İşlemde / In Progress" disabled={updating || contact.status === "in_progress"} onClick={() => handleStatusChange("in_progress")} icon={<Wave className="h-3.5 w-7" aria-label="İşlemde" />} />
              <StatusButton label="Çözüldü / Resolved" disabled={updating || contact.status === "resolved"} onClick={() => handleStatusChange("resolved")} icon={<CheckCircle2 className="size-3.5" />} />
              <StatusButton label="Spam" disabled={updating || contact.status === "spam"} onClick={() => handleStatusChange("spam")} icon={<AlertCircle className="size-3.5" />} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusButton({ label, disabled, onClick, icon }: { label: string; disabled: boolean; onClick: () => void; icon: React.ReactNode }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-2 text-[11px] font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">{icon}<span>{label}</span></button>;
}
