"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/data/query-store";
import { listAdminPaymentLedger, type AdminLedgerSource, type AdminPaymentLedgerRow } from "@/lib/admin/payments";
import { listStudentPackageStandings, type StudentPackageStanding } from "@/lib/admin/finance";
import { packageDisplayName } from "@/lib/packages/display";
import { compareTr, formatTrLira } from "@/lib/format/turkish";
import pages from "@/components/admin/admin-pages.module.css";

// Gelir İstatistikleri (referans #view-mali). Rakamlar Ödemeler sayfasıyla aynı
// kayıtlardan hesaplanır: tahsilat = ödendi/iade edilmiş ve ücretsiz olmayan
// işlemler, net = tutar − iade. Ücretsiz tanımlanan paketler tahsilata dahil değildir.

type Period = "ay" | "3ay" | "yil" | "tum";
const PERIOD_LABEL: Record<Period, string> = { ay: "Bu ay", "3ay": "Son 3 ay", yil: "Bu yıl", tum: "Tüm zamanlar" };
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const EMPTY_LEDGER: AdminPaymentLedgerRow[] = [];
const EMPTY_STANDINGS: StudentPackageStanding[] = [];

function periodRange(period: Period, previous: boolean, now: Date): [Date, Date] | null {
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (period === "tum") return null;
  if (period === "ay") {
    return previous
      ? [new Date(start.getFullYear(), start.getMonth() - 1, 1), new Date(start.getFullYear(), start.getMonth() - 1, start.getDate(), 23, 59, 59)]
      : [new Date(start.getFullYear(), start.getMonth(), 1), end];
  }
  if (period === "yil") {
    return previous
      ? [new Date(start.getFullYear() - 1, 0, 1), new Date(start.getFullYear() - 1, start.getMonth(), start.getDate(), 23, 59, 59)]
      : [new Date(start.getFullYear(), 0, 1), end];
  }
  const span = 90 * 86_400_000;
  return previous ? [new Date(end.getTime() - 2 * span), new Date(end.getTime() - span)] : [new Date(end.getTime() - span), end];
}

function within(row: AdminPaymentLedgerRow, range: [Date, Date] | null) {
  if (!range) return true;
  const at = new Date(row.at);
  return at >= range[0] && at <= range[1];
}

const net = (row: AdminPaymentLedgerRow) => row.netAmount - row.refundedAmount;
const sum = (rows: AdminPaymentLedgerRow[], pick: (row: AdminPaymentLedgerRow) => number) => rows.reduce((total, row) => total + pick(row), 0);

function Change({ period, now, before }: { period: Period; now: number; before: number }): ReactNode {
  if (period === "tum") return null;
  if (!before) return now ? " · önceki dönemde kayıt yok" : null;
  const pct = Math.round(((now - before) / before) * 100);
  return <> · <span className={`ma-dg ${pct >= 0 ? "up" : "down"}`}>{pct >= 0 ? "▲" : "▼"} %{Math.abs(pct)}</span></>;
}

export default function AdminFinancialFlowPage() {
  const [period, setPeriod] = useState<Period>("tum");
  const { data, loading } = useQuery(
    "admin:financial:overview",
    async () => {
      const [ledger, standings] = await Promise.all([
        listAdminPaymentLedger((source) => packageDisplayName(source)),
        listStudentPackageStandings(),
      ]);
      return { ledger, standings };
    },
    { staleTime: 30_000 }
  );
  const rows = data?.ledger.data ?? EMPTY_LEDGER;
  const standings = data?.standings.data ?? EMPTY_STANDINGS;
  const error = data ? data.ledger.error || data.standings.error || "" : "";

  const view = useMemo(() => {
    const today = new Date();
    const collected = rows.filter((row) => (row.status === "odendi" || row.status === "iade") && row.source !== "ucretsiz");
    const range = periodRange(period, false, today);
    const previousRange = periodRange(period, true, today);
    const current = collected.filter((row) => within(row, range));
    const previous = previousRange ? collected.filter((row) => within(row, previousRange)) : [];
    const total = sum(current, net);
    const totalBefore = previousRange ? sum(previous, net) : 0;
    const all = rows.filter((row) => within(row, range));
    const pending = all.filter((row) => row.status === "bekliyor");
    const refunds = all.filter((row) => row.refundedAmount > 0);
    const coupons = all.filter((row) => row.couponCode);

    // Paket bazında gelir
    const byPackage = new Map<string, { label: string; count: number; total: number }>();
    current.forEach((row) => {
      const entry = byPackage.get(row.packageId) ?? { label: row.packageLabel, count: 0, total: 0 };
      entry.count += 1;
      entry.total += net(row);
      byPackage.set(row.packageId, entry);
    });
    const mix = Array.from(byPackage.values()).sort((a, b) => b.total - a.total);
    const mixMax = mix.length ? mix[0].total || 1 : 1;

    // Aylık tahsilat (son 6 ay, dönemden bağımsız)
    const months = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
      return { y: d.getFullYear(), m: d.getMonth(), total: 0, count: 0 };
    });
    collected.forEach((row) => {
      const d = new Date(row.at);
      const month = months.find((item) => item.y === d.getFullYear() && item.m === d.getMonth());
      if (month) { month.total += net(row); month.count += 1; }
    });
    const monthMax = Math.max(...months.map((item) => item.total)) || 1;

    // Ödeme şekli
    const ways: Record<Exclude<AdminLedgerSource, "ucretsiz">, { total: number; count: number }> = { paytr: { total: 0, count: 0 }, banka: { total: 0, count: 0 } };
    current.forEach((row) => {
      if (row.source === "ucretsiz") return;
      ways[row.source].total += net(row);
      ways[row.source].count += 1;
    });
    const freeCount = rows.filter((row) => row.source === "ucretsiz").length;

    // Verilmemiş dersler (aktif paketlerde kalan hak × ders başı fiyat)
    const owing = standings.filter((s) => s.packageLabel && s.remaining > 0);
    const owingGroups = new Map<string, { label: string; students: number; lessons: number; total: number }>();
    let owingLessons = 0;
    let owingTotal = 0;
    owing.forEach((s) => {
      const label = s.packageLabel as string;
      const group = owingGroups.get(label) ?? { label, students: 0, lessons: 0, total: 0 };
      group.students += 1;
      group.lessons += s.remaining;
      group.total += s.remaining * s.lessonPrice;
      owingGroups.set(label, group);
      owingLessons += s.remaining;
      owingTotal += s.remaining * s.lessonPrice;
    });

    // Yenileme bekleyenler (paketi yok ya da 3 veya daha az ders kaldı)
    const renew = standings
      .filter((s) => !s.packageLabel || s.remaining <= 3)
      .sort((a, b) => (a.packageLabel ? a.remaining : -1) - (b.packageLabel ? b.remaining : -1) || compareTr(a.studentName, b.studentName));
    const renewPotential = renew.reduce((total, s) => total + (s.packageLabel ? s.renewalPrice : 0), 0);

    return {
      total, totalBefore, current, previous, pending, refunds, coupons, mix, mixMax, months, monthMax, ways, freeCount,
      owing, owingGroups: Array.from(owingGroups.values()).sort((a, b) => b.total - a.total), owingLessons, owingTotal,
      renew, renewPotential,
    };
  }, [rows, standings, period]);

  const label = PERIOD_LABEL[period];

  return (
    <div id="view-mali" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>Gelir İstatistikleri</h1><p>Tahsilatların özeti: dönem karşılaştırması, verilmemiş dersler, yenileme ve gelir dağılımı.</p></div>
          <div className="seg" role="group" aria-label="Dönem">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
              <button key={key} type="button" aria-pressed={period === key} data-per={key} onClick={() => setPeriod(key)}>{PERIOD_LABEL[key]}</button>
            ))}
          </div>
        </div>
        {error ? <p role="alert" className="ma-note" style={{ color: "#9A3324" }}>{error}</p> : null}
        <div className="stats fx-stats5 ma-kpis" aria-busy={loading && !data}>
          <div className="stat k-g"><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg></span><span className="l">Net tahsilat</span><b data-m="toplam">{formatTrLira(view.total)}</b><span className="s" data-m="toplam-s">{label}<Change period={period} now={view.total} before={view.totalBefore} /></span></div>
          <div className="stat k-b"><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></svg></span><span className="l">Satış</span><b data-m="ay">{view.current.length} paket</b><span className="s" data-m="ay-s">ortalama {view.current.length ? formatTrLira(Math.round(view.total / view.current.length)) : "—"}<Change period={period} now={view.current.length} before={view.previous.length} /></span></div>
          <div className="stat k-y"><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><span className="l">Bekleyen ödeme</span><b data-m="bekleyen">{formatTrLira(sum(view.pending, (row) => row.netAmount))}</b><span className="s" data-m="bekleyen-s">{view.pending.length} işlem bekliyor</span></div>
          <div className="stat k-p"><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1.5" /></svg></span><span className="l">Kupon indirimi</span><b data-m="kupon">{formatTrLira(sum(view.coupons, (row) => row.baseAmount - row.netAmount))}</b><span className="s" data-m="kupon-s">{view.coupons.length} kupon kullanımı</span></div>
          <div className="stat k-r"><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg></span><span className="l">İade edilen</span><b data-m="iade">{formatTrLira(sum(view.refunds, (row) => row.refundedAmount))}</b><span className="s" data-m="iade-s">{view.refunds.length} iade kaydı</span></div>
        </div>
        <div className="ma-grid">
          <section className="card ma-card">
            <div className="fx-mix-h"><h2><span className="ma-hi g" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 15v2M11 11v6M15 13v4M19 7v10" /></svg></span>Aylık tahsilat</h2><span>Son 6 ay</span></div>
            <div className="ma-chart" id="ma-ay" role="img" aria-label="Son 6 ayın aylık tahsilat grafiği">
              {view.months.map((month, index) => {
                const height = month.total ? Math.max(3, (month.total / view.monthMax) * 100) : 0;
                return (
                  <div key={`${month.y}-${month.m}`} className={`ma-col${index === view.months.length - 1 ? " cur" : ""}`} title={`${MONTHS[month.m]} ${month.y}: ${formatTrLira(month.total)} · ${month.count} işlem`}>
                    <span className="v">{month.total ? formatTrLira(Math.round(month.total)) : "—"}</span>
                    <span className="b"><i style={{ height: `${height}%` }} /></span>
                    <span className="m">{MONTHS[month.m].slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card ma-card">
            <div className="fx-mix-h"><h2><span className="ma-hi b" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg></span>Ödeme şekli</h2><span data-per-lab>{label}</span></div>
            <div className="ma-ways" id="ma-yol">
              {(["paytr", "banka"] as const).map((key) => {
                const way = view.ways[key];
                const pct = view.total ? Math.round((way.total / view.total) * 100) : 0;
                return (
                  <div key={key} className="ma-way">
                    <div className="ma-way-h"><b>{key === "paytr" ? "Kredi Kartı" : "Banka Transferi"}</b><span>{formatTrLira(way.total)}</span></div>
                    <div className="ma-way-t"><i className={key} style={{ width: `${pct}%` }} /></div>
                    <small>{way.count} işlem · %{pct}</small>
                  </div>
                );
              })}
              <div className="ma-way-f">Ücretsiz tanımlanan: <b>{view.freeCount}</b> paket <span className="fx-muted">(tahsilata dahil değil)</span></div>
            </div>
          </section>
        </div>
        <div className="ma-grid ma-grid2">
          <section className="card ma-card">
            <div className="fx-mix-h"><h2><span className="ma-hi y" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z" /><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z" /></svg></span>Verilmemiş dersler</h2><span>Şu an</span></div>
            <div id="ma-borc">
              <div className="ma-big"><b>{view.owingLessons} ders</b><span>≈ {formatTrLira(Math.round(view.owingTotal))}</span></div>
              <p className="ma-note">{view.owing.length} öğrencinin satın alıp henüz kullanmadığı ders hakkı. Tutar, her paketin ders başı fiyatına göre hesaplanır; bu kısım tahsil edildi ama henüz hizmeti verilmedi.</p>
              <ul className="ma-list ma-borc">
                {view.owingGroups.map((group) => (
                  <li key={group.label}><span>{group.label}</span><span className="d">{group.students} öğrenci</span><span className="d">{group.lessons} ders</span><b>{formatTrLira(Math.round(group.total))}</b></li>
                ))}
              </ul>
            </div>
          </section>
          <section className="card ma-card">
            <div className="fx-mix-h"><h2><span className="ma-hi g" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg></span>Yenileme bekleyenler</h2><span>3 ders veya daha az</span></div>
            <div id="ma-yen">
              <div className="ma-big"><b>{view.renew.length} öğrenci</b><span>olası gelir ≈ {formatTrLira(view.renewPotential)}</span></div>
              <p className="ma-note">Aynı paketi yenilerlerse beklenen tutar. Paketi olmayan öğrenciler tutara dahil değil.</p>
              <ul className="ma-list ma-yen">
                {view.renew.map((s) => (
                  <li key={s.studentId}>
                    <Link className="fx-ogr" href={`/admin/ogrenciler/detay?student=${encodeURIComponent(s.studentId)}`}>{s.studentName}</Link>
                    <span className="d">{s.packageLabel ?? <span className="fx-muted">—</span>}</span>
                    {s.packageLabel
                      ? <span className={`ma-kal ${s.remaining <= 1 ? "crit" : "low"}`}>{s.remaining} ders kaldı</span>
                      : <span className="ma-kal crit">Paket yok</span>}
                    <b>{s.packageLabel && s.renewalPrice ? formatTrLira(s.renewalPrice) : <span className="fx-muted">—</span>}</b>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
        <section className="card fx-mix">
          <div className="fx-mix-h"><h2><span className="ma-hi p" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></svg></span>Paket bazında gelir</h2><span data-m="mix-s">{label}</span></div>
          <div className="fx-mix-bars" id="ma-mix">
            <div className="fx-bar fx-bar-h"><span>Paket</span><span>Satış</span><span /><span>Net tahsilat</span><span>Oran</span></div>
            {view.mix.map((item) => (
              <div key={item.label} className="fx-bar">
                <span>{item.label}</span>
                <span className="n">{item.count} satış</span>
                <span className="t"><i style={{ width: `${Math.max(1, (item.total / view.mixMax) * 100)}%` }} /></span>
                <b>{formatTrLira(item.total)}</b>
                <small>%{view.total ? Math.round((item.total / view.total) * 100) : 0}</small>
              </div>
            ))}
          </div>
        </section>
        <Link className="card fx-linkcard ma-link" href="/admin/odemeler">
          <span className="fx-set-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h3" /></svg></span>
          <span><b>Tüm işlemleri gör</b><small>Tek tek ödemeler, ayrıntılar ve iade işlemleri Ödemeler sayfasında</small></span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </Link>
      </div></div>
    </div>
  );
}
