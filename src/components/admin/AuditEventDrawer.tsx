"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/data/query-store";
import { fetchAuditDetail, type AuditDetail, type AuditFeedRow } from "@/lib/admin/audit-center";
import {
  CART_ACTIONS,
  AUDIT_CATEGORY_LABELS,
  AUDIT_ROLE_LABELS,
  AUDIT_STATUS_LABELS,
  CHANGE_TABLE_LABELS,
  LESSON_STATUS_LABELS,
  MAIL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  auditHighlights,
  auditSentence,
  auditTitle,
  fieldLabel,
  formatAuditDateTime,
  formatChangeValue,
  formatMoney,
  loginReasonLabel,
  mailErrorText,
  mailKind,
  redactMetadata,
  shortId,
} from "@/lib/admin/audit-catalog";
import { AuditCategoryIcon } from "@/components/admin/AuditCategoryIcon";

// Denetim olayı ayrıntı çekmecesi: sağdan açılır (mobilde tam ekran). Veriler
// admin_audit_detail RPC'sinden gelir; hassas alanlar sunucuda hiç seçilmez,
// metadata burada ikinci kez temizlenir.

function studentHref(studentId: string) {
  return `/admin/ogrenciler/detay?student=${encodeURIComponent(studentId)}`;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ak-copy"
      aria-label={`${label} kopyala`}
      title="Kopyala"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        });
      }}
    >
      {done ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}

function IdValue({ value, label, size = 8 }: { value: string | null | undefined; label: string; size?: number }) {
  if (!value) return <>—</>;
  return <span className="ak-idv"><code title={value}>{shortId(value, size)}</code><CopyButton value={value} label={label} /></span>;
}

type Row = [string, ReactNode | null | undefined | false];

function Fields({ rows }: { rows: Row[] }) {
  const visible = rows.filter(([, value]) => value !== null && value !== undefined && value !== false && value !== "");
  if (!visible.length) return null;
  return (
    <dl className="ak-dl">
      {visible.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="ak-sec">
      <h3>{title}{note ? <small>{note}</small> : null}</h3>
      {children}
    </section>
  );
}

function when(iso: string | null | undefined, seconds = true) {
  return formatAuditDateTime(iso, seconds);
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`ak-b ak-st-${status}`}>{AUDIT_STATUS_LABELS[status as keyof typeof AUDIT_STATUS_LABELS] ?? status}</span>;
}

function PersonBlock({ person, fallbackStudents }: { person: AuditDetail["subject"]; fallbackStudents?: Array<{ id: string; name: string | null }> }) {
  if (!person) return null;
  const students = person.students?.length ? person.students : fallbackStudents ?? [];
  const role = person.role ? AUDIT_ROLE_LABELS[person.role] ?? person.role : null;
  return (
    <Fields
      rows={[
        ["Ad soyad", person.name || <span className="ak-mute">Ad kaydı yok</span>],
        ["E-posta", person.email ? <span className="ak-idv"><span className="ak-wrap">{person.email}</span><CopyButton value={person.email} label="E-posta" /></span> : null],
        ["Rol", role],
        ["Öğrenci", students.length ? (
          <span className="ak-list-inline">
            {students.map((student) => <Link key={student.id} className="fx-ogr" href={studentHref(student.id)}>{student.name || shortId(student.id)}</Link>)}
          </span>
        ) : null],
        ["E-posta doğrulama", person.email_verified_at ? `Doğrulandı · ${when(person.email_verified_at, false)}` : person.role === "veli" ? "Doğrulanmamış" : null],
        ["Hesap durumu", person.archived_at ? `Arşivde · ${when(person.archived_at, false)}` : person.active === false ? "Pasif" : person.active ? "Aktif" : null],
        ["Kayıt tarihi", when(person.created_at, false)],
        ["Kullanıcı ID", person.user_id ? <IdValue value={person.user_id} label="Kullanıcı ID" /> : null],
      ]}
    />
  );
}

function PaymentSection({ detail }: { detail: AuditDetail }) {
  const payment = detail.payment;
  if (!payment) return null;
  const purchases = payment.purchases ?? [];
  const rights = purchases.length
    ? purchases.map((item) => `+${item.lesson_count ?? 0} ders${item.package_name ? ` (${item.package_name})` : ""}`).join(", ")
    : payment.status === "paid" ? "Ders hakkı kaydı bulunamadı" : "Henüz tanımlanmadı";
  const discount = Number(payment.discount_kurus);
  const subtotal = Number(payment.subtotal_kurus);
  const callback = payment.callback;
  const refunded = Number(payment.refunded_amount);
  const failure = [payment.failed_reason_msg, payment.failed_reason_code ? `kod ${payment.failed_reason_code}` : null].filter(Boolean).join(" · ");
  return (
    <Section title="Ödeme" note={payment.test_mode === true || payment.test_mode === "1" || payment.test_mode === 1 ? "Test modu" : undefined}>
      <Fields
        rows={[
          ["Ödeyen", [payment.payer_name, payment.payer_email].filter(Boolean).join(" · ") || null],
          ["Öğrenci", payment.learner_name || detail.event.student_name],
          ["Paket", payment.items && payment.items.length > 1
            ? payment.items.map((item) => item.package_name).filter(Boolean).join(", ")
            : payment.package_name || detail.event.package_name],
          ["Tutar", formatMoney(payment.amount, payment.currency)],
          ["Ödeme no", payment.public_reference ? <span className="ak-idv"><code>{payment.public_reference}</code><CopyButton value={payment.public_reference} label="Ödeme no" /></span> : null],
          ["PayTR işlem no", payment.provider_transaction_id ? <IdValue value={payment.provider_transaction_id} label="PayTR işlem no" size={14} /> : null],
          ["Durum", payment.status ? PAYMENT_STATUS_LABELS[payment.status] ?? payment.status : null],
          ["Sağlayıcı", payment.provider ? (payment.provider === "paytr" ? "PayTR" : payment.provider) : null],
          ["Ödeme yöntemi", payment.payment_method === "card" ? "Kart" : payment.payment_method === "bank_transfer" ? "Banka transferi" : payment.payment_method],
          ["Taksit", payment.installment_count && payment.installment_count > 1 ? `${payment.installment_count} taksit` : null],
          ["Başlatılma", when(payment.created_at)],
          ["PayTR bildirimi", callback
            ? `${when(callback.at)} · ${callback.provider_status === "success" ? "başarılı" : callback.provider_status === "failed" ? "başarısız" : callback.provider_status ?? "alındı"}`
            : payment.provider === "paytr" ? "Bildirim kaydı yok" : null],
          ["Ödeme zamanı", when(payment.paid_at)],
          ["Ders hakkı", rights],
          ["Kupon", payment.coupon_code],
          ["Ara toplam", Number.isFinite(subtotal) && subtotal > 0 ? formatMoney(subtotal / 100, payment.currency) : null],
          ["İndirim", Number.isFinite(discount) && discount > 0 ? formatMoney(discount / 100, payment.currency) : null],
          ["İade", payment.refund_status || refunded > 0
            ? [PAYMENT_STATUS_LABELS[payment.refund_status ?? ""] ?? payment.refund_status, refunded > 0 ? formatMoney(refunded, payment.currency) : null, when(payment.last_refunded_at, false)].filter(Boolean).join(" · ")
            : null],
          ["İade nedeni", payment.last_refund_reason],
          ["Hata", failure ? <span className="ak-err">{failure}</span> : null],
        ]}
      />
      {payment.items && payment.items.length > 1 ? <ItemList items={payment.items} currency={payment.currency} /> : null}
      {payment.mails?.length ? (
        <ul className="ak-mini">
          {payment.mails.map((mail) => (
            <li key={mail.id}>
              <b>{mailKind(mail.template, mail.event_type, "payment_transaction")}</b>
              <span>{mail.recipient ?? "—"}</span>
              <span className={`ak-b ak-st-${mail.status === "sent" ? "success" : mail.status === "failed" ? "error" : "pending"}`}>{MAIL_STATUS_LABELS[mail.status ?? ""] ?? mail.status}</span>
              <small>{when(mail.sent_at ?? mail.created_at, false)}{mail.last_error_code ? ` · ${mailErrorText(mail.last_error_code)}` : ""}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

type CartItem = { package_id?: string | null; package_name?: string | null; lesson_count?: number | null; price?: unknown; discount?: unknown; final?: unknown; currency?: string | null };

function cartItems(value: unknown): CartItem[] {
  return Array.isArray(value) ? value.filter((item): item is CartItem => Boolean(item) && typeof item === "object").slice(0, 20) : [];
}

function money(value: unknown, currency?: string | null) {
  return typeof value === "number" || typeof value === "string" ? formatMoney(value, currency) : null;
}

function ItemList({ items, currency }: { items: CartItem[]; currency?: string | null }) {
  if (!items.length) return null;
  return (
    <ul className="ak-mini ak-items">
      {items.map((item, index) => {
        const discount = Number(item.discount);
        const final = money(item.final, item.currency ?? currency);
        return (
          <li key={`${item.package_id ?? "p"}-${index}`}>
            <b>{item.package_name || item.package_id || "Paket"}</b>
            <span>{typeof item.lesson_count === "number" ? `${item.lesson_count} ders` : "—"}</span>
            <span className="ak-price">
              {Number.isFinite(discount) && discount > 0 && final ? <><s>{money(item.price, item.currency ?? currency)}</s> {final}</> : money(item.price, item.currency ?? currency) ?? final ?? "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const CART_STEP: Record<string, string> = {
  cart_item_added: "Sepete ekleme",
  cart_item_removed: "Sepetten çıkarma",
  cart_cleared: "Sepeti temizleme",
  checkout_opened: "Ödeme sayfası görüntüleme",
  checkout_started: "Ödeme başlatma",
};

function CartSection({ detail }: { detail: AuditDetail }) {
  const event = detail.event;
  if (!CART_ACTIONS.has(event.action)) return null;
  const meta = event.metadata ?? {};
  const highlights = auditHighlights(event.action, event.feed_category, event.feed_status, meta);
  const items = cartItems(meta.items);
  const cartId = (typeof meta.cart_id === "string" ? meta.cart_id : null) ?? detail.cart_id ?? event.correlation_id;
  const currency = typeof meta.currency === "string" ? meta.currency : null;
  return (
    <Section title="Sepet" note={items.length > 1 ? `${items.length} paket` : undefined}>
      <Fields
        rows={[
          ["İşlem", CART_STEP[event.action]],
          ["Öğrenci", event.student_id ? <Link className="fx-ogr" href={studentHref(event.student_id)}>{event.student_name || shortId(event.student_id)}</Link> : event.student_name],
          ...highlights.items.filter(([label]) => label !== "Sepet ID").map(([label, value]): Row => [label, value]),
          ["Tarih / Saat", when(event.created_at)],
          ["Ödeme no", event.public_reference ? <span className="ak-idv"><code>{event.public_reference}</code><CopyButton value={event.public_reference} label="Ödeme no" /></span> : null],
          ["Sepet / Correlation ID", cartId ? <IdValue value={cartId} label="Sepet ID" size={13} /> : null],
        ]}
      />
      {items.length ? <ItemList items={items} currency={currency} /> : null}
    </Section>
  );
}

function LoginSection({ detail }: { detail: AuditDetail }) {
  const event = detail.event;
  const ok = event.action === "auth.login";
  const role = typeof event.metadata?.role === "string" ? event.metadata.role : null;
  return (
    <Section title="Giriş">
      <Fields
        rows={[
          ["Kullanıcı", event.subject_name],
          ["E-posta", event.subject_email],
          ["Sonuç", ok ? "Başarılı" : "Başarısız"],
          ["Tarih", when(event.created_at)],
          ["Cihaz", event.login_device || "Bilinmiyor"],
          ["Oturum türü", role === "yonetici" ? "Yönetim paneli" : role === "veli" ? "Veli paneli" : null],
          ["Başarısızlık nedeni", !ok ? <span className="ak-err">{loginReasonLabel(event.login_reason) ?? "Hatalı e-posta veya şifre"}</span> : null],
          ["IP adresi", <span key="ip" className="ak-mute">Kaydedilmiyor (gizlilik gereği)</span>],
        ]}
      />
    </Section>
  );
}

function MailSection({ detail }: { detail: AuditDetail }) {
  const mail = detail.delivery;
  if (!mail) return null;
  const error = mail.last_error_code || mail.last_error ? [mailErrorText(mail.last_error_code ?? mail.last_error), mail.last_error_code].filter(Boolean).join(" · ") : null;
  return (
    <Section title="Mail">
      <Fields
        rows={[
          ["Tür", mailKind(mail.template, mail.event_type, mail.entity_type)],
          ["Alıcı", mail.recipient ? <span className="ak-idv"><span className="ak-wrap">{mail.recipient}</span><CopyButton value={mail.recipient} label="Alıcı" /></span> : null],
          ["Alıcı kaydı", detail.subject?.user_id ? null : <span className="ak-mute">Kaydı olmayan alıcı</span>],
          ["Konu", mail.subject],
          ["Durum", MAIL_STATUS_LABELS[mail.status ?? ""] ?? mail.status],
          ["Kuyruğa alınma", when(mail.created_at)],
          ["Gönderim", when(mail.sent_at)],
          ["Sağlayıcı", mail.provider === "gmail" ? "Gmail API" : mail.provider],
          ["Sağlayıcı mesaj no", mail.provider_message_id ? <IdValue value={mail.provider_message_id} label="Mesaj no" size={12} /> : null],
          ["Deneme", `${mail.attempt_count ?? 0}/${mail.max_attempts}`],
          ["Sonraki deneme", mail.status !== "sent" ? when(mail.next_attempt_at) : null],
          ["Hata", error ? <span className="ak-err">{error}</span> : null],
          ["Hata ayrıntısı", mail.last_error ? <span className="ak-mute ak-wrap">{mail.last_error}</span> : null],
        ]}
      />
    </Section>
  );
}

function LessonSection({ detail }: { detail: AuditDetail }) {
  const lesson = detail.lesson;
  if (!lesson) return null;
  const total = lesson.package_lesson_count;
  const used = lesson.package_lessons_used;
  const remaining = typeof total === "number" && typeof used === "number" ? Math.max(total - used, 0) : null;
  const rightsChange = lesson.status === "completed" && typeof lesson.previous_remaining === "number"
    ? `${lesson.previous_remaining} → ${Math.max(lesson.previous_remaining - 1, 0)}`
    : null;
  const date = lesson.lesson_date ? new Date(lesson.lesson_date) : null;
  const dateText = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
    : null;
  return (
    <Section title="Ders">
      <Fields
        rows={[
          ["Öğrenci", lesson.student_id ? <Link className="fx-ogr" href={studentHref(lesson.student_id)}>{lesson.student_name || shortId(lesson.student_id)}</Link> : lesson.student_name],
          ["Eğitmen", lesson.instructor],
          ["Ders", [lesson.subject, lesson.exam_code].filter(Boolean).join(" · ") || lesson.title],
          ["Konu", lesson.topic],
          ["Tarih / saat", dateText ? `${dateText}${lesson.timezone_label ? ` (${lesson.timezone_label})` : ""}` : null],
          ["Süre", lesson.duration_minutes ? `${lesson.duration_minutes} dk` : null],
          ["Durum", lesson.status ? LESSON_STATUS_LABELS[lesson.status] ?? lesson.status : null],
          ["Paket", lesson.package_name],
          ["Ders hakkı", rightsChange ? `${rightsChange} (bu ders ile)` : null],
          ["Kalan hak (şimdi)", remaining !== null ? `${remaining} / ${total}` : null],
          ["Rapor", lesson.has_report ? `Yazıldı${lesson.report_version ? ` · sürüm ${lesson.report_version}` : ""}${lesson.report_updated_at ? ` · ${when(lesson.report_updated_at, false)}` : ""}` : "Rapor yok"],
          ["Rapor maili", lesson.report_email_sent_at ? `Gönderildi · ${when(lesson.report_email_sent_at, false)}` : lesson.has_report ? "Gönderilmedi" : null],
          ["Arşiv", lesson.is_archived ? "Arşivde" : null],
          ["Ders ID", <IdValue key="id" value={lesson.id} label="Ders ID" />],
        ]}
      />
    </Section>
  );
}

function PurchaseSection({ detail }: { detail: AuditDetail }) {
  const purchase = detail.purchase;
  if (!purchase || detail.payment) return null;
  const source = purchase.assignment_source;
  return (
    <Section title="Paket">
      <Fields
        rows={[
          ["Paket", purchase.package_name],
          ["Ders hakkı", purchase.lesson_count !== null ? `${purchase.lesson_count} ders` : null],
          ["Kullanılan", purchase.lessons_used !== null ? `${purchase.lessons_used} ders` : null],
          ["Kalan", purchase.remaining !== null ? `${purchase.remaining} ders` : null],
          ["Durum", purchase.status],
          ["Ödeme durumu", purchase.payment_status ? PAYMENT_STATUS_LABELS[purchase.payment_status] ?? purchase.payment_status : null],
          ["Tanımlama", source === "payment" || source === "paytr" ? "Ödeme ile" : source === "manual" || source === "admin" ? "Yönetici tanımladı" : source],
          ["Tutar", formatMoney(purchase.price_amount, purchase.currency)],
          ["Oluşturma", when(purchase.created_at, false)],
          ["Paket ID", <IdValue key="id" value={purchase.id} label="Paket ID" />],
        ]}
      />
    </Section>
  );
}

function ChangesSection({ detail }: { detail: AuditDetail }) {
  const fields = Array.isArray(detail.event.metadata?.changed_fields) ? (detail.event.metadata!.changed_fields as unknown[]) : [];
  if (!detail.changes.length) {
    if (!fields.length) return null;
    return (
      <Section title="Değişiklikler">
        <p className="ak-note">Değişen alanlar: <b>{fields.map((field) => fieldLabel(String(field))).join(", ")}</b>. Bu kayıt eski değerleri içermiyor; önceki/sonraki değerler yeni işlemlerde gösterilir.</p>
      </Section>
    );
  }
  return (
    <Section title="Değişiklikler">
      {detail.changes.map((change, index) => (
        <div key={`${change.table}-${index}`} className="ak-chg">
          <span className="ak-chg-t">{CHANGE_TABLE_LABELS[change.table] ?? change.table}</span>
          <table>
            <thead><tr><th>Alan</th><th>Önce</th><th>Sonra</th></tr></thead>
            <tbody>
              {Object.entries(change.changes).map(([field, value]) => (
                <tr key={field}>
                  <th scope="row">{fieldLabel(field)}</th>
                  <td className="ak-old">{formatChangeValue(field, value?.old, detail.lookups)}</td>
                  <td className="ak-new">{formatChangeValue(field, value?.new, detail.lookups)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Section>
  );
}

function TimelineSection({ detail, onOpen }: { detail: AuditDetail; onOpen: (id: string) => void }) {
  if (detail.timeline.length < 2) return null;
  return (
    <Section title="İlgili İşlem Akışı" note={`${detail.timeline.length} adım`}>
      <ol className="ak-tl">
        {detail.timeline.map((item) => {
          const sentence = auditSentence({ ...item, severity: null });
          return (
            <li key={item.event_id} className={`ak-tl-${item.feed_status}${item.is_current ? " ak-tl-cur" : ""}`}>
              <button type="button" disabled={item.is_current} onClick={() => onOpen(item.event_id)} aria-current={item.is_current ? "true" : undefined}>
                <span className="ak-tl-dot" aria-hidden="true" />
                <span className="ak-tl-main">
                  <b>{auditTitle(item.action)}</b>
                  <span>{sentence}</span>
                </span>
                <time dateTime={item.created_at}>{formatAuditDateTime(item.created_at)?.split(" · ")[1]}<small>{new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short" }).format(new Date(item.created_at))}</small></time>
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function TechnicalSection({ detail }: { detail: AuditDetail }) {
  const event = detail.event;
  const meta = event.metadata ?? {};
  const pick = (...keys: string[]) => {
    for (const key of keys) if (typeof meta[key] === "string" && meta[key]) return String(meta[key]);
    return null;
  };
  const json = JSON.stringify(redactMetadata(meta), null, 2);
  return (
    <details className="fx-more ak-tech">
      <summary>Teknik Detaylar<small>yalnız inceleme için</small></summary>
      <div className="ak-tech-body">
        <Fields
          rows={[
            ["Olay ID", <IdValue key="eid" value={event.event_id} label="Olay ID" size={20} />],
            ["Olay anahtarı", <code key="k">{event.action}</code>],
            ["Kaynak", event.source === "login" ? "auth_login_events" : "audit_logs"],
            ["Kategori (ham)", event.raw_category],
            ["Önem", event.severity],
            ["Correlation ID", event.correlation_id ? <IdValue value={event.correlation_id} label="Correlation ID" size={18} /> : null],
            ["Varlık türü", event.entity_type],
            ["Varlık ID", event.entity_id ? <IdValue value={event.entity_id} label="Varlık ID" size={18} /> : null],
            ["İşlemi yapan ID", event.actor_user_id ? <IdValue value={event.actor_user_id} label="İşlemi yapan ID" /> : null],
            ["Oluşturma (UTC)", <code key="c">{event.created_at}</code>],
            ["Kaynak servis", pick("source", "function", "edge_function", "origin")],
            ["Fonksiyon / RPC", pick("rpc", "function_name", "rpc_name")],
            ["İstek ID", pick("request_id", "requestId")],
            ["Dedupe anahtarı", detail.delivery?.dedupe_key ? <code key="d" className="ak-wrap">{detail.delivery.dedupe_key}</code> : null],
          ]}
        />
        <pre className="ak-json" aria-label="Temizlenmiş metadata">{json === "{}" ? "Metadata yok" : json}</pre>
      </div>
    </details>
  );
}

function ActorSection({ detail }: { detail: AuditDetail }) {
  const actor = detail.actor;
  const event = detail.event;
  if (event.source === "login") return null;
  const self = actor?.user_id && detail.subject?.user_id && actor.user_id === detail.subject.user_id;
  return (
    <Section title="İşlemi Yapan">
      {!actor ? (
        <p className="ak-note">Sistem (otomatik işlem{event.raw_category === "edge" || event.raw_category === "email" ? " · arka plan servisi" : ""})</p>
      ) : self ? (
        <p className="ak-note"><b>{actor.name || actor.email}</b> — işlemi kullanıcının kendisi yaptı.</p>
      ) : (
        <Fields
          rows={[
            ["Ad", actor.name || <span className="ak-mute">Ad kaydı yok</span>],
            ["Rol", actor.role ? AUDIT_ROLE_LABELS[actor.role] ?? actor.role : null],
            ["E-posta", actor.email],
            ["Kullanıcı ID", actor.user_id ? <IdValue value={actor.user_id} label="Kullanıcı ID" /> : null],
          ]}
        />
      )}
    </Section>
  );
}

function DetailBody({ detail, onOpen, onPerson }: { detail: AuditDetail; onOpen: (id: string) => void; onPerson: (value: string, label: string) => void }) {
  const event = detail.event;
  const highlights = auditHighlights(event.action, event.feed_category, event.feed_status, event.metadata);
  const subject = detail.subject;
  const personKey = subject?.user_id ?? subject?.email ?? null;
  return (
    <>
      {highlights.error && event.source !== "login" ? <div className="ak-alert" role="note"><b>Hata:</b> {highlights.error}</div> : null}

      <Section title="İlgili Kullanıcı" note={personKey ? <button type="button" className="ak-link" onClick={() => onPerson(personKey, subject?.name || subject?.email || personKey)}>Bu kişinin tüm kayıtları →</button> : undefined}>
        {subject ? <PersonBlock person={subject} fallbackStudents={event.student_id ? [{ id: event.student_id, name: event.student_name }] : undefined} />
          : event.mail_recipient ? <Fields rows={[["Alıcı", event.mail_recipient], ["Kayıt", <span key="k" className="ak-mute">Kaydı olmayan alıcı</span>]]} />
          : <p className="ak-note">Bu olay bir kullanıcıya bağlı değil.</p>}
      </Section>

      <ActorSection detail={detail} />
      {event.source === "login" ? <LoginSection detail={detail} /> : null}
      <CartSection detail={detail} />
      <PaymentSection detail={detail} />
      <MailSection detail={detail} />
      <LessonSection detail={detail} />
      <PurchaseSection detail={detail} />
      {highlights.items.length && !CART_ACTIONS.has(event.action) ? (
        <Section title="Olay Ayrıntıları"><Fields rows={highlights.items.map(([label, value]) => [label, value])} /></Section>
      ) : null}
      <ChangesSection detail={detail} />
      <TimelineSection detail={detail} onOpen={onOpen} />
      <TechnicalSection detail={detail} />
    </>
  );
}

export function AuditEventDrawer({
  eventId,
  preview,
  onClose,
  onOpenEvent,
  onFilterPerson,
}: {
  eventId: string;
  preview?: AuditFeedRow | null;
  onClose: () => void;
  onOpenEvent: (id: string) => void;
  onFilterPerson: (value: string, label: string) => void;
}) {
  const { data, error, loading } = useQuery(`admin:audit:detail:${eventId}`, () => fetchAuditDetail(eventId), { staleTime: 60_000 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const detail = data?.data ?? null;
  const event = detail?.event ?? preview ?? null;

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => { if (keyEvent.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [eventId]);

  const title = event ? auditTitle(event.action, event.severity) : "Kayıt";
  const loadError = data?.error ?? (error ? "Kayıt yüklenemedi." : null);

  return (
    <>
      <div className="ak-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="ak-drawer" role="dialog" aria-modal="true" aria-labelledby="ak-dr-title">
        <header className="ak-dr-head">
          <div className="ak-dr-bar">
            {event ? <AuditCategoryIcon category={event.feed_category} /> : null}
            <span className="ak-badges">
              {event ? <StatusBadge status={event.feed_status} /> : null}
              {event ? <span className="ak-b ak-cat">{AUDIT_CATEGORY_LABELS[event.feed_category]}</span> : null}
            </span>
            <button ref={closeRef} type="button" className="ak-x" onClick={onClose} aria-label="Kapat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <h2 id="ak-dr-title">{title}</h2>
          {event ? <p className="ak-dr-sent">{auditSentence(event)}</p> : null}
          {event ? (
            <div className="ak-dr-meta">
              <time dateTime={event.created_at}>{formatAuditDateTime(event.created_at)}</time>
              <code>{event.action}</code>
            </div>
          ) : null}
        </header>
        <div className="ak-dr-body" ref={bodyRef}>
          {detail ? (
            <DetailBody detail={detail} onOpen={onOpenEvent} onPerson={onFilterPerson} />
          ) : loading || (!data && !error) ? (
            <div className="ak-dr-load" aria-live="polite"><span className="ak-skel" /><span className="ak-skel" /><span className="ak-skel s" /></div>
          ) : (
            <div className="fx-empty"><b>Kayıt açılamadı</b><span>{loadError ?? "Kayıt bulunamadı."}</span></div>
          )}
        </div>
      </aside>
    </>
  );
}
