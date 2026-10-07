"use client";

import { useEffect, useRef, useState } from "react";
import type { ContactInboxReply, ContactRequestRow } from "@/lib/admin/contacts";
import { archiveAdminContactRequest, restoreAdminContactRequest, sendAdminContactReply, updateAdminContactStatus } from "@/lib/admin/contacts";
import { formatPackagePrice, getContactPackageContext } from "@/lib/contact/package-context";
import { formatTrListDate } from "@/lib/format/turkish";
import { formatTrPhoneDisplay, trPhoneWaDigits } from "@/lib/format/phone";
import { toast } from "@/components/ui/toast";
import pages from "./admin-pages.module.css";

// Referans iletişim talebi penceresi (#il-dialog): gönderen bilgisi, konuşma,
// hazır yanıtlar ve arşive taşıma. Yanıt mevcut send-contact-reply akışıyla
// (idempotency anahtarı ile) gönderilir; gönderen adresi değişmez.

export const CONTACT_STATUS: Record<string, { cls: string; label: string }> = {
  new: { cls: "yeni", label: "Yeni" },
  in_progress: { cls: "islemde", label: "İşlemde" },
  resolved: { cls: "cozuldu", label: "Çözüldü" },
  spam: { cls: "spam", label: "Spam" },
};

export const CONTACT_FORM_LABEL: Record<string, string> = {
  contact_form: "İletişim formu",
  quick_contact: "Hızlı iletişim",
  consultation: "Danışmanlık formu",
};

const TEMPLATES: Record<"fiyat" | "tanisma" | "tesekkur", (ad: string) => string> = {
  fiyat: (a) => `Merhaba${a},\n\nİlginiz için teşekkür ederiz. Ders paketlerimiz ve güncel fiyatlarımız şöyle:\n\n• 1 Ders: [fiyat]\n• 5 Derslik Paket: [fiyat]\n• 10 Derslik Paket: [fiyat]\n\nSize en uygun programı belirlemek için ücretsiz bir tanışma görüşmesi de planlayabiliriz.\n\nSevgiler,\nOriens Academy`,
  tanisma: (a) => `Merhaba${a},\n\nSizinle ücretsiz bir tanışma görüşmesi yapmaktan memnuniyet duyarız. Size uygun iki-üç gün ve saat aralığı paylaşabilir misiniz?\n\nSevgiler,\nOriens Academy`,
  tesekkur: (a) => `Merhaba${a},\n\nMesajınız için teşekkür ederiz. En kısa sürede size dönüş yapacağız.\n\nSevgiler,\nOriens Academy`,
};

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() || `reply-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function deliveryLabel(status: string) {
  if (status === "sent") return "Gönderildi";
  if (status === "failed") return "Gönderilemedi";
  return "Gönderiliyor";
}

export function ContactDialog({ contact, replies, onClose, onChanged }: {
  contact: ContactRequestRow;
  replies: ContactInboxReply[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [sent, setSent] = useState<ContactInboxReply[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const archived = contact.is_archived;
  const status = CONTACT_STATUS[contact.status] ?? CONTACT_STATUS.new;
  const name = contact.full_name?.trim() || "";
  const phone = contact.phone ? formatTrPhoneDisplay(contact.phone) : "";
  const wa = contact.phone ? trPhoneWaDigits(contact.phone) : "";
  const pkg = getContactPackageContext(contact.metadata);
  const thread = [
    { id: `in-${contact.id}`, out: false, at: contact.created_at, text: contact.message, delivery: "" },
    ...[...replies, ...sent.filter((s) => !replies.some((r) => r.id === s.id))]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((reply) => ({ id: reply.id, out: reply.direction !== "inbound", at: reply.sent_at || reply.created_at, text: reply.message_text, delivery: reply.delivery_status })),
  ];

  function applyTemplate(key: keyof typeof TEMPLATES) {
    setText(TEMPLATES[key](name ? ` ${name.split(" ")[0]}` : ""));
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(0, 0);
      el.scrollTop = 0;
    });
  }

  async function send() {
    const messageText = text.trim();
    if (!messageText || sending) return;
    setSending(true);
    const result = await sendAdminContactReply({ contactRequestId: contact.id, messageText, idempotencyKey });
    setSending(false);
    if (result.error) {
      toast.error(result.error);
      if (result.error.includes("sağlayıcısı")) setIdempotencyKey(newIdempotencyKey());
      onChanged();
      return;
    }
    if (result.reply) {
      const reply = result.reply;
      setSent((current) => [...current.filter((item) => item.id !== reply.id), reply]);
    }
    // Referans: ilk yanıtla "Yeni" talep "İşlemde" olur.
    if (contact.status === "new") await updateAdminContactStatus(contact.id, "in_progress");
    setText("");
    setIdempotencyKey(newIdempotencyKey());
    toast.success(result.duplicate ? "Bu yanıt daha önce gönderilmiş" : `Yanıt gönderildi: ${contact.email}`);
    onChanged();
  }

  async function toggleArchive() {
    if (archiving) return;
    setArchiving(true);
    const result = archived ? await restoreAdminContactRequest(contact.id) : await archiveAdminContactRequest(contact.id);
    setArchiving(false);
    if (!result.success) {
      toast.error(result.error || "Talep güncellenemedi.");
      return;
    }
    toast.success(archived ? "Talep arşivden çıkarıldı" : "Talep arşive taşındı");
    onChanged();
    dialogRef.current?.close();
  }

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={dialogRef}
        className="fx-dlg il-dlg"
        id="il-dialog"
        onClose={onClose}
        onCancel={(event) => { if (sending) event.preventDefault(); }}
        onClick={(event) => { if (event.target === event.currentTarget && !sending) dialogRef.current?.close(); }}
      >
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="ild-title">
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="ild-title" className="m-htitle" data-ild-ad="">{name || "İsim belirtilmedi"}</h2>
              <span className="m-hsub" data-ild-sub="">
                <span className="il-k">E-posta:</span> <a href={`mailto:${contact.email}`}>{contact.email}</a>
                {phone ? <><span className="il-sep" /><span className="il-k">Tel:</span> {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="il-wa" title="WhatsApp ile yaz">{phone}</a> : phone}</> : null}
              </span>
            </div>
            <span className={`il-st ${status.cls}`} data-ild-st="">{status.label}</span>
            <button type="button" className="m-close" aria-label="Kapat" data-close="" onClick={() => dialogRef.current?.close()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="m-body il-body">
            <dl className="fx-dl" data-ild-dl="">
              <dt>Form</dt><dd>{CONTACT_FORM_LABEL[contact.source] ?? "İletişim formu"}</dd>
              <dt>Konu</dt><dd>{contact.subject?.trim() ? contact.subject : <span className="fx-muted">Belirtilmedi</span>}</dd>
              {pkg ? <><dt>Paket</dt><dd>{pkg.name}{pkg.lessons !== null || formatPackagePrice(pkg) ? <small className="il-dd2">{[pkg.lessons !== null ? `${pkg.lessons} ders` : "", formatPackagePrice(pkg) ?? ""].filter(Boolean).join(" · ")}</small> : null}</dd></> : null}
            </dl>
            <div className="il-sec">Konuşma</div>
            <div className="il-thread" data-ild-thread="">
              {thread.map((message) => {
                const who = message.out ? "Oriens Academy" : name || contact.email;
                const when = formatTrListDate(message.at);
                return (
                  <div key={message.id} className={`il-msg${message.out ? " out" : ""}`}>
                    <div className="il-msg-h">
                      <span className="il-who"><b>{who}</b><small>{message.out ? "Yanıtınız" : "Gelen mesaj"}</small></span>
                      <span className="il-when"><b>{when.primary}</b><small>{when.secondary}</small></span>
                    </div>
                    <div className={`il-msg-b${message.text?.trim() ? "" : " bos"}`}>{message.text?.trim() ? message.text : "Mesaj içeriği boş gönderilmiş."}</div>
                    {message.out && message.delivery && message.delivery !== "sent" ? <div className="il-msg-s" style={message.delivery === "failed" ? { color: "#9A3324" } : undefined}>{deliveryLabel(message.delivery)}</div> : null}
                  </div>
                );
              })}
            </div>
            <div className="il-reply" data-ild-replybox="" hidden={archived}>
              <div className="il-reply-h">
                <label className="il-sec" htmlFor="ild-text">Yanıt</label>
                <div className="il-tpl" role="group" aria-label="Hazır yanıtlar">
                  <button type="button" onClick={() => applyTemplate("fiyat")}>Fiyat bilgisi</button>
                  <button type="button" onClick={() => applyTemplate("tanisma")}>Tanışma görüşmesi</button>
                  <button type="button" onClick={() => applyTemplate("tesekkur")}>Teşekkür</button>
                </div>
              </div>
              <textarea
                ref={textRef}
                id="ild-text"
                className="m-input"
                rows={4}
                maxLength={10000}
                placeholder="Yanıtınızı yazın… (Ctrl+Enter ile gönder)"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void send(); } }}
              />
              <div className="il-reply-f">
                <span data-ild-route="">info@oriens-academy.com adresinden gönderilir</span>
                <button type="button" className="fx-btn primary" data-ild-send="" disabled={!text.trim() || sending} onClick={() => void send()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
                  {sending ? "Gönderiliyor…" : "Gönder"}
                </button>
              </div>
            </div>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel il-arc" data-ild-arc="" disabled={archiving || sending} onClick={() => void toggleArchive()}>
              {archived ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>Arşivden çıkar</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></svg>Arşive taşı</>
              )}
            </button>
            <button type="button" className="m-cancel" data-close="" onClick={() => dialogRef.current?.close()}>Kapat</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
