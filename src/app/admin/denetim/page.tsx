"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/data/query-store";
import { listAdminLoginEvents, type AdminLoginEvent } from "@/lib/admin/logins";
import { listAdminPanelActions, type PanelAction, type PanelActionKind } from "@/lib/admin/panel-actions";
import { foldTurkish, formatTrShortListDate } from "@/lib/format/turkish";
import pages from "@/components/admin/admin-pages.module.css";

// Referans "Denetim Kayıtları" (#view-denetim): Girişler (auth_login_events) ve
// Panel işlemleri (yönetici audit_logs). Yalnız okuma; IP adresi tutulmaz/gösterilmez.

const EMPTY_LOGINS: AdminLoginEvent[] = [];
const EMPTY_ACTIONS: PanelAction[] = [];
const KIND_COLOR: Record<PanelActionKind, string> = { ders: "g", paket: "b", fiyat: "y", yorum: "p", arsiv: "n", diger: "n" };

function inPeriod(iso: string, period: string, now: Date) {
  if (!period) return true;
  const date = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (period === "bugun") return date >= today;
  if (period === "ay") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const from = new Date(today);
  from.setDate(from.getDate() - (Number(period) - 1));
  return date >= from;
}

function studentHref(studentId: string) {
  return `/admin/ogrenciler/detay?student=${encodeURIComponent(studentId)}`;
}

function OkIcon() {
  return <span className="bn-ic ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>;
}

function FailIcon() {
  return <span className="bn-ic fail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></span>;
}

function DateCell({ iso }: { iso: string }) {
  const when = formatTrShortListDate(iso);
  return <td className="fx-date">{when.primary}<small>{when.secondary}</small></td>;
}

async function loadAudit() {
  const [logins, actions] = await Promise.all([listAdminLoginEvents(), listAdminPanelActions()]);
  return { logins, actions };
}

export default function AdminAuditPage() {
  const { data, loading } = useQuery("admin:denetim", loadAudit, { staleTime: 30_000 });
  const logins = data?.logins.data ?? EMPTY_LOGINS;
  const actions = data?.actions.data ?? EMPTY_ACTIONS;
  const guardianCount = data?.logins.guardianCount ?? 0;

  const [seg, setSeg] = useState<"giris" | "islem">("giris");
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState("");
  const [rol, setRol] = useState("");
  const [zaman, setZaman] = useState("");

  const visibleLogins = useMemo(() => {
    const query = foldTurkish(q.trim());
    const now = new Date();
    return logins.filter((row) => {
      if (sonuc && row.result !== sonuc) return false;
      if (rol && row.role !== rol) return false;
      if (!inPeriod(row.at, zaman, now)) return false;
      return !query || foldTurkish([row.name ?? "", row.email, row.device ?? "", row.studentName ?? ""].join(" ")).includes(query);
    });
  }, [logins, q, sonuc, rol, zaman]);

  const visibleActions = useMemo(() => {
    const query = foldTurkish(q.trim());
    const now = new Date();
    return actions.filter((row) => inPeriod(row.at, zaman, now) && (!query || foldTurkish([row.title, row.detail, row.actor].join(" ")).includes(query)));
  }, [actions, q, zaman]);

  const kpi = useMemo(() => {
    const now = new Date();
    const today = new Set<string>();
    const active = new Set<string>();
    let fails = 0;
    for (const row of logins) {
      if (row.result === "ok" && inPeriod(row.at, "bugun", now)) today.add(row.userId ?? row.email);
      if (row.result === "ok" && row.role === "veli" && inPeriod(row.at, "7", now)) active.add(row.userId ?? row.email);
      if (row.result === "fail" && inPeriod(row.at, "7", now)) fails += 1;
    }
    return { today: today.size, active: active.size, fails };
  }, [logins]);

  const isLogin = seg === "giris";
  const list = isLogin ? visibleLogins : visibleActions;
  const total = isLogin ? logins.length : actions.length;
  const loadError = (isLogin ? data?.logins.error : data?.actions.error) || "";

  return (
    <div id="view-denetim" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>Denetim Kayıtları</h1><p>Velilerin siteye girişleri ve panelde yapılan değişiklikler.</p></div>
          <div className="seg" role="group" aria-label="Kayıt türü">
            <button type="button" aria-pressed={isLogin} onClick={() => setSeg("giris")}>Girişler<small>{logins.length}</small></button>
            <button type="button" aria-pressed={!isLogin} onClick={() => setSeg("islem")}>Panel işlemleri<small>{actions.length}</small></button>
          </div>
        </div>

        <div className="stats fx-stats3">
          <div className="stat dn-k g"><span className="l">Bugün giriş yapan</span><b>{kpi.today}</b><span className="s">farklı kişi</span></div>
          <div className="stat dn-k"><span className="l">Son 7 günde aktif veli</span><b>{kpi.active}</b><span className="s">{guardianCount} kayıtlı veliden</span></div>
          <div className={`stat dn-k ${kpi.fails ? "y" : "g"}`}><span className="l">Hatalı giriş denemesi</span><b>{kpi.fails}</b><span className="s">{kpi.fails ? "son 7 gün · kontrol edin" : "son 7 gün · sorun yok"}</span></div>
        </div>

        <section className="card">
          <div className="tools">
            <label className="search">
              <span className="sr">Ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" id="dn-q" placeholder="Kişi, cihaz veya işlem ara…" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <label data-dn-only="giris" hidden={!isLogin}>
              <span className="sr">Sonuç</span>
              <select className="sel" id="dn-sonuc" value={sonuc} onChange={(event) => setSonuc(event.target.value)}>
                <option value="">Tüm girişler</option><option value="ok">Başarılı</option><option value="fail">Hatalı şifre</option>
              </select>
            </label>
            <label data-dn-only="giris" hidden={!isLogin}>
              <span className="sr">Kişi türü</span>
              <select className="sel" id="dn-rol" value={rol} onChange={(event) => setRol(event.target.value)}>
                <option value="">Veli ve yönetici</option><option value="veli">Yalnızca veliler</option><option value="yonetici">Yalnızca yönetici</option>
              </select>
            </label>
            <label>
              <span className="sr">Zaman</span>
              <select className="sel" id="dn-zaman" value={zaman} onChange={(event) => setZaman(event.target.value)}>
                <option value="">Tüm zamanlar</option><option value="bugun">Bugün</option><option value="7">Son 7 gün</option><option value="ay">Bu ay</option><option value="30">Son 30 gün</option>
              </select>
            </label>
          </div>

          <table className="fx-table dn-table" id="dn-giris" aria-label="Giriş kayıtları" hidden={!isLogin || !visibleLogins.length}>
            <colgroup><col style={{ width: "32%" }} /><col style={{ width: "26%" }} /><col /><col style={{ width: "17%" }} /></colgroup>
            <thead><tr><th>Kişi</th><th>Cihaz</th><th>Sonuç</th><th>Tarih</th></tr></thead>
            <tbody>
              {visibleLogins.map((row) => {
                const name = row.name || row.email;
                return (
                  <tr key={row.id} className={row.result === "fail" ? "dn-fail" : undefined}>
                    <td className="bn-kisi">
                      <b title={row.email}>
                        {row.studentId ? <Link className="fx-ogr" href={studentHref(row.studentId)} title={row.studentName ? `Öğrenci: ${row.studentName}` : undefined}>{name}</Link> : name}
                        {row.role === "yonetici" ? <span className="dn-rol">Yönetici</span> : null}
                      </b>
                    </td>
                    <td className="dn-cihaz">{row.device || "Bilinmeyen cihaz"}</td>
                    <td><span className="dn-son">{row.result === "ok" ? <><OkIcon />Başarılı</> : <><FailIcon />Hatalı şifre</>}</span></td>
                    <DateCell iso={row.at} />
                  </tr>
                );
              })}
            </tbody>
          </table>

          <table className="fx-table dn-table" id="dn-islem" aria-label="Panel işlemleri" hidden={isLogin || !visibleActions.length}>
            <colgroup><col style={{ width: "26%" }} /><col /><col style={{ width: "16%" }} /><col style={{ width: "17%" }} /></colgroup>
            <thead><tr><th>İşlem</th><th>Ayrıntı</th><th>Yapan</th><th>Tarih</th></tr></thead>
            <tbody>
              {visibleActions.map((row) => (
                <tr key={row.id}>
                  <td><span className={`bn-tag ${KIND_COLOR[row.kind]}`}>{row.title}</span></td>
                  <td className="bn-konu" title={row.detail}>{row.studentId && row.kind !== "fiyat" ? <Link className="fx-ogr" href={studentHref(row.studentId)}>{row.detail}</Link> : row.detail}</td>
                  <td className="dn-cihaz">{row.actor}</td>
                  <DateCell iso={row.at} />
                </tr>
              ))}
            </tbody>
          </table>

          {loading && !data ? (
            <div className="fx-empty" id="dn-empty"><b>Kayıtlar yükleniyor…</b></div>
          ) : (
            <div className="fx-empty" id="dn-empty" hidden={list.length > 0}>
              <span className="fx-empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg></span>
              <b>{loadError ? "Kayıtlar yüklenemedi" : "Kayıt bulunamadı"}</b>
              <span>{loadError || (total ? "Aramayı veya filtreleri değiştirin." : isLogin ? "Henüz giriş kaydı yok." : "Henüz panel işlemi kaydı yok.")}</span>
            </div>
          )}

          <div className="foot"><span id="dn-shown">{list.length} / {total} kayıt gösteriliyor</span><span>Giriş kayıtları güvenlik amacıyla 1 yıl saklanır</span></div>
        </section>
      </div></div>
    </div>
  );
}
