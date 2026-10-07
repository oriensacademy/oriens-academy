"use client";

import { useMemo, useState } from "react";
import { invalidate, queryKeys, useQuery } from "@/lib/data/query-store";
import { listAdminContactInbox, type ContactInboxReply, type ContactRequestRow } from "@/lib/admin/contacts";
import { CONTACT_FORM_LABEL, CONTACT_STATUS, ContactDialog } from "@/components/admin/ContactDialog";
import { RefDatePicker } from "@/components/admin/RefDatePicker";
import { foldTurkish, formatTrShortListDate } from "@/lib/format/turkish";
import pages from "@/components/admin/admin-pages.module.css";

// Referans "İletişim Talepleri" (#view-iletisim): Aktif / Arşiv görünümü, arama
// ve yerel tarih aralığı; satıra tıklayınca talep penceresi açılır.

const EMPTY_CONTACTS: ContactRequestRow[] = [];
const EMPTY_REPLIES: ContactInboxReply[] = [];
const INBOX_KEY = `${queryKeys.adminContacts}:inbox`;

const parseDay = (key: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
};

export default function AdminContactsPage({ initialContactId = null }: { initialContactId?: string | null; embedded?: boolean }) {
  const { data, loading } = useQuery(INBOX_KEY, listAdminContactInbox, { staleTime: 30_000 });
  const contacts = data?.data ?? EMPTY_CONTACTS;
  const replies = data?.replies ?? EMPTY_REPLIES;
  const loadError = data?.error || "";

  const [seg, setSeg] = useState<"aktif" | "arsiv">("aktif");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialContactId);

  const repliesByContact = useMemo(() => {
    const map = new Map<string, ContactInboxReply[]>();
    for (const reply of replies) {
      const list = map.get(reply.contact_request_id) ?? [];
      list.push(reply);
      map.set(reply.contact_request_id, list);
    }
    return map;
  }, [replies]);

  const rows = useMemo(() => contacts.map((contact) => {
    const thread = repliesByContact.get(contact.id) ?? EMPTY_REPLIES;
    const last = thread[thread.length - 1];
    return {
      contact,
      count: 1 + thread.length,
      lastAt: last ? last.sent_at || last.created_at : contact.created_at,
      lastText: last ? last.message_text : contact.message,
      lastOut: Boolean(last && last.direction !== "inbound"),
      haystack: foldTurkish([contact.full_name, contact.email, contact.phone ?? "", contact.subject ?? "", CONTACT_FORM_LABEL[contact.source] ?? "", contact.message, ...thread.map((r) => r.message_text)].join(" ")),
    };
  }), [contacts, repliesByContact]);

  const counts = useMemo(() => ({
    aktif: contacts.filter((c) => !c.is_archived).length,
    arsiv: contacts.filter((c) => c.is_archived).length,
  }), [contacts]);

  const visible = useMemo(() => {
    const query = foldTurkish(q.trim());
    const start = parseDay(from);
    const end = parseDay(until);
    if (end) end.setDate(end.getDate() + 1);
    return rows
      .filter((row) => (seg === "arsiv") === row.contact.is_archived)
      .filter((row) => {
        const created = new Date(row.contact.created_at);
        if (start && created < start) return false;
        if (end && created >= end) return false;
        return !query || row.haystack.includes(query);
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [rows, seg, q, from, until]);

  const total = seg === "arsiv" ? counts.arsiv : counts.aktif;
  const open = openId ? contacts.find((c) => c.id === openId) ?? null : null;

  return (
    <div id="view-iletisim" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>İletişim Talepleri</h1><p>Web sitesindeki iletişim ve danışmanlık formundan gelen talepler.</p></div>
          <div className="seg" role="group" aria-label="Görünüm">
            <button type="button" aria-pressed={seg === "aktif"} data-il-seg="aktif" onClick={() => setSeg("aktif")}>Aktif<small data-il-c="aktif">{counts.aktif}</small></button>
            <button type="button" aria-pressed={seg === "arsiv"} data-il-seg="arsiv" onClick={() => setSeg("arsiv")}>Arşiv<small data-il-c="arsiv">{counts.arsiv}</small></button>
          </div>
        </div>
        <section className="card">
          <div className="tools">
            <label className="search">
              <span className="sr">Ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" id="il-q" placeholder="İsim, e-posta, konu veya mesaj ara…" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <div className="fx-range">
              <span className="fx-rl">Tarih</span>
              <RefDatePicker id="il-bas" value={from} onChange={setFrom} emptyLabel="Başlangıç" ariaLabel="Başlangıç tarihi" />
              <span className="fx-rsep">–</span>
              <RefDatePicker id="il-bit" value={until} onChange={setUntil} emptyLabel="Bitiş" ariaLabel="Bitiş tarihi" />
              <button type="button" className="fx-link" data-il-clear="" onClick={() => { setFrom(""); setUntil(""); setQ(""); }}>Temizle</button>
            </div>
          </div>

          <table className="fx-table il-table" id="il-table" aria-label="İletişim talepleri" hidden={!visible.length}>
            <colgroup><col style={{ width: "27%" }} /><col /><col style={{ width: "13%" }} /><col style={{ width: "16%" }} /><col style={{ width: 56 }} /></colgroup>
            <thead><tr><th>Gönderen</th><th>Konu ve son mesaj</th><th>Durum</th><th>Son işlem</th><th><span className="sr">Aç</span></th></tr></thead>
            <tbody id="il-rows">
              {visible.map((row) => {
                const { contact } = row;
                const status = CONTACT_STATUS[contact.status] ?? CONTACT_STATUS.new;
                const when = formatTrShortListDate(row.lastAt);
                const name = contact.full_name?.trim();
                return (
                  <tr
                    key={contact.id}
                    className={status.cls}
                    data-il={contact.id}
                    tabIndex={0}
                    onClick={() => setOpenId(contact.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenId(contact.id); } }}
                  >
                    <td><div className="il-gon"><span className="fx-who"><b>{name || <span className="bos">İsim belirtilmedi</span>}</b><small>{contact.email}</small></span></div></td>
                    <td className="il-konu">
                      <div className="il-kh">
                        <b>{contact.subject?.trim() || <span className="bos">Konu belirtilmedi</span>}</b>
                        <span className="il-form">{CONTACT_FORM_LABEL[contact.source] ?? "İletişim formu"}</span>
                        {row.count > 1 ? (
                          <span className="il-say" title={`${row.count} mesaj`}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>{row.count}</span>
                        ) : null}
                      </div>
                      <small>{row.lastText?.trim() ? <>{row.lastOut ? <em>Siz:</em> : null}{row.lastOut ? " " : null}{row.lastText}</> : <span className="bos">Mesaj boş</span>}</small>
                    </td>
                    <td><span className={`il-st ${status.cls}`}>{status.label}</span></td>
                    <td className="fx-date">{when.primary}<small>{when.secondary}</small></td>
                    <td className="il-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && !data ? (
            <div className="fx-empty" id="il-empty"><b>Talepler yükleniyor…</b></div>
          ) : (
            <div className="fx-empty" id="il-empty" hidden={visible.length > 0}>
              <span className="fx-empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg></span>
              <b data-t="">{loadError ? "Talepler yüklenemedi" : total ? "Sonuç bulunamadı" : seg === "arsiv" ? "Arşiv boş" : "Henüz iletişim talebi yok"}</b>
              <span data-s="">{loadError || (total ? "Aramayı veya tarih aralığını değiştirin." : seg === "arsiv" ? "Arşive taşınan talepler burada listelenir." : "Web sitesinden gelen talepler burada listelenir.")}</span>
            </div>
          )}

          <div className="foot"><span id="il-shown">{visible.length} / {total} talep gösteriliyor</span><span>Satıra tıklayarak talebi açın ve yanıtlayın</span></div>
        </section>
      </div></div>

      {open ? (
        <ContactDialog
          key={open.id}
          contact={open}
          replies={repliesByContact.get(open.id) ?? EMPTY_REPLIES}
          onClose={() => setOpenId(null)}
          onChanged={() => invalidate(queryKeys.adminContacts, queryKeys.adminDashboard)}
        />
      ) : null}
    </div>
  );
}
