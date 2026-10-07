"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAdminOverview, type OverviewFeedItem, type OverviewFeedKind } from "@/lib/admin/overview";
import { queryKeys, useQuery } from "@/lib/data/query-store";
import { compareTr, formatTrLira } from "@/lib/format/turkish";
import pages from "@/components/admin/admin-pages.module.css";

// Genel Bakış (referans #view-panel). Tüm sayılar canlı kayıtlardan hesaplanır;
// tahsilat = ödendi/iade edilmiş ve ücretsiz olmayan işlemlerin net tutarı (iade düşülür).

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
const Chevron = () => <Svg size={16}><path d="m9 18 6-6-6-6" /></Svg>;

const FEED_ICON: Record<OverviewFeedKind, ReactNode> = {
  pay: <Svg size={16}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Svg>,
  il: <Svg size={16}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>,
  ders: <Svg size={16}><path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z" /><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z" /></Svg>,
  pk: <Svg size={16}><path d="m12 2 9 5-9 5-9-5 9-5z" /><path d="m3 12 9 5 9-5" /></Svg>,
  lock: <Svg size={16}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>,
  mail: <Svg size={16}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></Svg>,
};

function dayDiff(iso: string, now: Date) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  d.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - d.getTime()) / 86_400_000);
}

function ago(iso: string, now: Date) {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const days = dayDiff(iso, now);
  if (minutes < 60 * 24 && days === 0) return `${Math.round(minutes / 60)} saat önce`;
  if (days === 1) return "dün";
  if (days < 7) return `${days} gün önce`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function shortDate(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data, loading } = useQuery(`${queryKeys.adminDashboard}:overview`, getAdminOverview, { staleTime: 20_000 });
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);

  const view = useMemo(() => {
    if (!data || !now) return null;
    const students = data.students;
    const week = students.filter((s) => s.lastLessonDate && dayDiff(s.lastLessonDate, now) <= 7).length;
    const remaining = students.reduce((total, s) => total + (s.packageLabel ? s.remaining : 0), 0);
    const remainingValue = students.reduce((total, s) => total + (s.packageLabel ? s.remaining * s.lessonPrice : 0), 0);
    const collected = data.ledger.filter((row) => (row.status === "odendi" || row.status === "iade") && row.source !== "ucretsiz");
    const monthTotal = (y: number, m: number) => collected
      .filter((row) => { const d = new Date(row.at); return d.getFullYear() === y && d.getMonth() === m; })
      .reduce((total, row) => total + row.netAmount - row.refundedAmount, 0);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const counts = {
      az: students.filter((s) => s.packageLabel && s.remaining > 0 && s.remaining <= 3).length,
      yok: students.filter((s) => !s.packageLabel || s.remaining <= 0).length,
      uzun: students.filter((s) => s.packageLabel && s.lastLessonDate && dayDiff(s.lastLessonDate, now) >= 7).length,
      bek: data.ledger.filter((row) => row.status === "bekliyor").length,
      fail: data.failedEmails,
      ilet: data.newContacts,
    };
    const parts: string[] = [];
    if (counts.ilet) parts.push(`${counts.ilet} yeni talep`);
    if (counts.az) parts.push(`${counts.az} yenileme bekleyen öğrenci`);
    if (counts.yok) parts.push(`${counts.yok} paketi olmayan öğrenci`);
    if (counts.bek) parts.push(`${counts.bek} bekleyen ödeme`);
    if (counts.fail) parts.push(`${counts.fail} gönderilemeyen e-posta`);
    const sentence = parts.length
      ? `Bugün ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ve ${parts[parts.length - 1]}` : parts[0]} var.`
      : "Bugün bekleyen bir iş yok, her şey yolunda.";
    const months = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return { y: d.getFullYear(), m: d.getMonth(), total: monthTotal(d.getFullYear(), d.getMonth()) };
    });
    const monthMax = Math.max(...months.map((item) => item.total)) || 1;
    const recent = students
      .filter((s) => s.lastLessonDate)
      .sort((a, b) => ((a.lastLessonDate as string) < (b.lastLessonDate as string) ? 1 : (a.lastLessonDate as string) > (b.lastLessonDate as string) ? -1 : compareTr(a.name, b.name)))
      .slice(0, 7);
    return {
      week, remaining, remainingValue, counts, sentence, months, monthMax, recent,
      thisMonth: monthTotal(now.getFullYear(), now.getMonth()),
      prevMonth: monthTotal(prev.getFullYear(), prev.getMonth()),
      prevLabel: MONTHS[prev.getMonth()],
    };
  }, [data, now]);

  const hour = now?.getHours() ?? 12;
  const greeting = `${hour < 5 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar"}, Oriens Academy`;

  const todo: Array<{ n: number; tone: "warn" | "bad"; title: string; sub: string; href: string; icon: ReactNode }> = view ? [
    { n: view.counts.az, tone: "warn" as const, title: "Az ders kalan", sub: "3 ders veya daha az · yenileme hatırlatın", href: "/admin/ogrenciler?durum=az", icon: <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg> },
    { n: view.counts.yok, tone: "bad" as const, title: "Paketi olmayan", sub: "Yeni paket tanımlanmalı", href: "/admin/ogrenciler?durum=yok", icon: <Svg><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Svg> },
    { n: view.counts.uzun, tone: "warn" as const, title: "7+ gündür ders yapılmayan", sub: "Paketi olduğu hâlde ders yapılmıyor", href: "/admin/ogrenciler?durum=uzun", icon: <Svg><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg> },
    { n: view.counts.ilet, tone: "bad" as const, title: "Yeni iletişim talebi", sub: "Web sitesinden gelen formlar", href: "/admin/iletisim", icon: <Svg><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg> },
    { n: data?.guardiansNotSignedIn ?? 0, tone: "warn" as const, title: "14+ gündür giriş yapmayan veli", sub: "Ders raporlarını görmüyor olabilir", href: "/admin/denetim", icon: <Svg><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></Svg> },
    { n: view.counts.bek, tone: "warn" as const, title: "Bekleyen ödeme", sub: "Tamamlanmamış ödeme işlemleri", href: "/admin/odemeler", icon: <Svg><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Svg> },
    { n: view.counts.fail, tone: "bad" as const, title: "Gönderilemeyen e-posta", sub: "E-posta Geçmişi’nden tekrar gönderin", href: "/admin/bildirimler", icon: <Svg><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></Svg> },
  ].sort((a, b) => Number(b.n > 0) - Number(a.n > 0)) : [];

  return (
    <div id="view-panel" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1 data-db-selam>{greeting}</h1><p data-db-tarih>{view?.sentence ?? (loading ? "Özet hazırlanıyor…" : "")}</p></div>
          <div className="db-head-act">
            <button type="button" className="fx-btn" onClick={() => router.push("/admin/blog/editor")}><Svg size={16}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>Blog Yazısı</button>
            <button type="button" className="fx-btn primary" onClick={() => router.push("/admin/ogrenciler?yeni=1")}><Svg size={16}><path d="M12 5v14M5 12h14" /></Svg>Yeni Öğrenci</button>
          </div>
        </div>
        {data?.errors.length ? <p role="alert" className="ma-note" style={{ color: "#9A3324" }}>{data.errors[0]}</p> : null}
        <div className="db-kpis" id="db-kpis" aria-busy={!view}>
          <Link className="db-kpi g" href="/admin/ogrenciler"><span className="ic"><Svg><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg></span><span className="l">Aktif öğrenci</span><b>{data?.students.length ?? "—"}</b><span className="s">son 7 günde derste: {view?.week ?? "—"}</span></Link>
          <Link className="db-kpi" href="/admin/bildirimler"><span className="ic"><Svg><path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z" /><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z" /></Svg></span><span className="l">Bu haftaki dersler</span><b>{data?.weekLessons ?? "—"}</b><span className="s">ders raporlarına göre</span></Link>
          <Link className="db-kpi y" href="/admin/mali-akis"><span className="ic"><Svg><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></Svg></span><span className="l">Bu ay tahsilat</span><b>{view ? formatTrLira(view.thisMonth) : "—"}</b><span className="s">{view ? `${view.prevLabel} ayı: ${formatTrLira(view.prevMonth)}` : ""}</span></Link>
          <Link className="db-kpi" href="/admin/mali-akis"><span className="ic"><Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg></span><span className="l">Kalan ders hakkı</span><b>{view?.remaining ?? "—"}</b><span className="s">{view ? `≈ ${formatTrLira(Math.round(view.remainingValue))} verilecek ders` : ""}</span></Link>
        </div>
        <div className="db-grid">
          <section className="card db-card">
            <div className="db-ch"><div><h2>Son ders yapılanlar</h2><p>Öğrenci, son ders ve kalan hak</p></div><Link className="db-more" href="/admin/ogrenciler">Öğrenciler<Svg size={14}><path d="m9 18 6-6-6-6" /></Svg></Link></div>
            <ul className="db-son" id="db-son">
              {view?.recent.map((s) => {
                const days = dayDiff(s.lastLessonDate as string, now as Date);
                const tone = !s.packageLabel || s.remaining <= 0 ? "yok" : s.remaining <= 3 ? "az" : "";
                return (
                  <li key={s.id}>
                    <Link href={`/admin/ogrenciler/detay?student=${encodeURIComponent(s.id)}`}>
                      <span className="sn">{s.name}<small>{s.program ?? ""}</small></span>
                      <span className="sd">{days === 0 ? "Bugün" : days === 1 ? "Dün" : shortDate(s.lastLessonDate as string)}</span>
                      <span className={`sk ${tone}`}>{s.packageLabel ? `${s.remaining} ders kaldı` : "Paket yok"}</span>
                    </Link>
                  </li>
                );
              })}
              {view && !view.recent.length ? <li className="db-bos">Henüz ders kaydı yok.</li> : null}
            </ul>
          </section>
          <section className="card db-card">
            <div className="db-ch"><div><h2>Son hareketler</h2><p>Ödemeler, talepler, dersler ve güvenlik</p></div><Link className="db-more" href="/admin/denetim">Tümünü gör<Svg size={14}><path d="m9 18 6-6-6-6" /></Svg></Link></div>
            <ul className="db-feed" id="db-feed">
              {data && now ? data.feed.map((item) => <FeedRow key={item.key} item={item} now={now} />) : null}
              {data && !data.feed.length ? <li className="db-bos">Henüz hareket yok.</li> : null}
            </ul>
          </section>
        </div>
        <div className="db-grid db-grid2">
          <section className="card db-card">
            <div className="db-ch"><div><h2>Dikkat gerektirenler</h2><p>Bugün göz atmanız gereken konular</p></div></div>
            <ul className="db-todo" id="db-todo">
              {todo.map((item) => {
                const on = item.n > 0;
                return (
                  <li key={item.title}>
                    <Link href={item.href} className={on ? item.tone : "ok"}>
                      <span className="ti">{on ? item.icon : <Svg><path d="M20 6 9 17l-5-5" /></Svg>}</span>
                      <span className="tt">{item.title}<span className="ts">{on ? item.sub : "Bekleyen yok"}</span></span>
                      <span className="tn">{item.n}</span>
                      <span className="tc"><Chevron /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="card db-card">
            <div className="db-ch"><div><h2>Gelir trendi</h2><p>Son 6 ay · iadeler düşülmüş net tahsilat</p></div><Link className="db-more" href="/admin/mali-akis">Gelir İstatistikleri<Svg size={14}><path d="m9 18 6-6-6-6" /></Svg></Link></div>
            <div className="ma-chart db-chart" id="db-ay" role="img" aria-label="Son 6 ayın aylık tahsilat grafiği">
              {view?.months.map((month, index) => {
                const height = month.total ? Math.max(3, (month.total / view.monthMax) * 100) : 0;
                return (
                  <div key={`${month.y}-${month.m}`} className={`ma-col${index === 5 ? " cur" : ""}`} title={`${MONTHS[month.m]} ${month.y}: ${formatTrLira(month.total)}`}>
                    <span className="v">{month.total ? formatTrLira(Math.round(month.total)) : "—"}</span>
                    <span className="b"><i style={{ height: `${height}%` }} /></span>
                    <span className="m">{MONTHS[month.m].slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div></div>
    </div>
  );
}

function FeedRow({ item, now }: { item: OverviewFeedItem; now: Date }) {
  const who = item.href
    ? <Link className="fx-ogr" href={item.href}>{item.who}</Link>
    : item.studentId
      ? <Link className="fx-ogr" href={`/admin/ogrenciler/detay?student=${encodeURIComponent(item.studentId)}`}>{item.who}</Link>
      : <>{item.who}</>;
  return (
    <li>
      <span className={`fi fi-c${item.tone}`}>{FEED_ICON[item.kind]}</span>
      <span className="ft">{item.title} — {who}<small>{item.detail}</small></span>
      <span className="fa">{item.amount !== null ? <b>{formatTrLira(item.amount)}</b> : null}{ago(item.at, now)}</span>
    </li>
  );
}
