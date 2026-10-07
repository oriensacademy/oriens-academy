"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { invalidate, useQuery } from "@/lib/data/query-store";
import { listAdminTestimonials, type TestimonialRow } from "@/lib/admin/content";
import {
  DG_MAX,
  ReviewDialog,
  addReviewToHome,
  archiveReview,
  homeList,
  isOnHome,
  persistHomeOrder,
  removeReviewFromHome,
  splitContext,
} from "@/components/admin/ReviewDialog";
import { FxConfirmDialog } from "@/components/admin/FxConfirmDialog";
import { toast } from "@/components/ui/toast";
import { compareTr, foldTurkish, formatTrListDate } from "@/lib/format/turkish";
import pages from "@/components/admin/admin-pages.module.css";

// Referans "Değerlendirmeler" (#view-deg): ana sayfadaki yorumlar (en fazla 20,
// ↑ ↓ ile sıralanır) ve tüm yorumlar. Yorumlar silinmez, arşive taşınır.

const EMPTY_ROWS: TestimonialRow[] = [];
const DG_KEY = "admin:testimonials:all";
const loadAll = () => listAdminTestimonials();

const I_STAR = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>;

function AdminReviews() {
  const params = useSearchParams();
  const linkedId = params.get("id");
  const { data, loading } = useQuery(DG_KEY, loadAll, { staleTime: 30_000 });
  const rows = useMemo(() => (data?.data ?? EMPTY_ROWS).filter((row) => !row.archived_at), [data]);
  const loadError = data?.error || "";

  const [mod, setMod] = useState<"ana" | "tum">("ana");
  const [q, setQ] = useState("");
  const [dil, setDil] = useState("");
  const [kat, setKat] = useState("");
  const [editing, setEditing] = useState<TestimonialRow | "new" | null>(null);
  const [archiving, setArchiving] = useState<TestimonialRow | null>(null);
  const [busy, setBusy] = useState(false);

  // Genel aramadan gelen ?id= bağlantısı: kayıt yüklenince pencere bir kez açılır.
  const [openedFromLink, setOpenedFromLink] = useState<string | null>(null);
  if (linkedId && openedFromLink !== linkedId) {
    const target = rows.find((row) => row.id === linkedId);
    if (target) {
      setOpenedFromLink(linkedId);
      setEditing(target);
      setMod(isOnHome(target) ? "ana" : "tum");
    }
  }

  const home = useMemo(() => homeList(rows), [rows]);
  const sira = useMemo(() => new Map(home.map((row, index) => [row.id, index + 1])), [home]);
  const kategoriler = useMemo(() => [...new Set(rows.map((row) => splitContext(row.context).kat).filter(Boolean))].sort(compareTr), [rows]);

  const visible = useMemo(() => {
    const query = foldTurkish(q.trim());
    const base = mod === "ana" ? home : [
      ...home,
      ...rows.filter((row) => !sira.has(row.id)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    ];
    return base.filter((row) => {
      const parts = splitContext(row.context);
      if (dil && row.locale !== dil) return false;
      if (kat && parts.kat !== kat) return false;
      return !query || foldTurkish(`${row.name} ${parts.konu} ${parts.kat} ${row.source_topic ?? ""} ${row.quote}`).includes(query);
    });
  }, [rows, home, sira, mod, q, dil, kat]);

  const refresh = () => invalidate("admin:testimonials");

  async function run(task: () => Promise<string | null>, success: string) {
    if (busy) return;
    setBusy(true);
    const error = await task();
    setBusy(false);
    refresh();
    if (error) toast.error(error);
    else if (success) toast.success(success);
  }

  function toggleHome(row: TestimonialRow) {
    if (sira.has(row.id)) {
      void run(() => removeReviewFromHome(row, home), `${row.name} ana sayfadan çıkarıldı`);
      return;
    }
    if (home.length >= DG_MAX) {
      toast.error("Ana sayfada en fazla 20 yorum olabilir; önce birini çıkarın");
      return;
    }
    void run(() => addReviewToHome(row, home), `${row.name} ana sayfaya eklendi`);
  }

  function move(row: TestimonialRow, step: -1 | 1) {
    const index = home.findIndex((item) => item.id === row.id);
    const other = home[index + step];
    if (index < 0 || !other) return;
    const next = home.slice();
    next[index] = other;
    next[index + step] = row;
    void run(() => persistHomeOrder(next), "");
  }

  const anaN = home.length;

  return (
    <div id="view-deg" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>Değerlendirmeler</h1><p>Ana sayfaya eklenen yorumlar web sitesinin ana sayfasında gösterilir.</p></div>
          <div className="fx-headr">
            <div className="seg" role="group" aria-label="Görünüm">
              <button type="button" aria-pressed={mod === "ana"} data-dg-seg="ana" onClick={() => setMod("ana")}>Ana sayfada<small data-dg-c="ana">{anaN}</small></button>
              <button type="button" aria-pressed={mod === "tum"} data-dg-seg="tum" onClick={() => setMod("tum")}>Tümü<small data-dg-c="tum">{rows.length}</small></button>
            </div>
            <button className="fx-btn primary" type="button" data-dg-new="" onClick={() => setEditing("new")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Yeni Yorum
            </button>
          </div>
        </div>

        <section className={`card dg-hero${anaN >= DG_MAX ? " full" : ""}`}>
          <div className="dg-hero-l">
            <span className="dg-hero-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg></span>
            <div><b>Ana sayfada gösterilenler <span data-dg-say="">{anaN} / {DG_MAX}</span></b><small>En fazla 20 yorum ana sayfada gösterilir. Sıra numarası ana sayfadaki sırayı belirler.</small></div>
          </div>
          <div className="dg-meter"><i data-dg-bar="" style={{ width: `${Math.min(anaN / DG_MAX, 1) * 100}%` }} /></div>
        </section>

        <section className="card">
          <div className="tools">
            <label className="search">
              <span className="sr">Ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" id="dg-q" placeholder="İsim, konu veya yorum ara…" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <label><span className="sr">Dil</span><select className="sel" id="dg-dil" value={dil} onChange={(event) => setDil(event.target.value)}><option value="">Tüm diller</option><option value="tr">Türkçe</option><option value="en">İngilizce</option></select></label>
            <label><span className="sr">Kategori</span><select className="sel" id="dg-kat" value={kat} onChange={(event) => setKat(event.target.value)}><option value="">Tüm kategoriler</option>{kategoriler.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>

          <table className="fx-table dg-table" aria-label="Değerlendirmeler" hidden={!visible.length}>
            <colgroup><col style={{ width: 84 }} /><col style={{ width: 210 }} /><col style={{ width: 200 }} /><col /><col style={{ width: 190 }} /><col style={{ width: 96 }} /></colgroup>
            <thead><tr><th>Sıra</th><th>Yazan</th><th>Ders / konu</th><th>Yorum</th><th>Ana sayfa</th><th><span className="sr">İşlemler</span></th></tr></thead>
            <tbody id="dg-rows">
              {visible.map((row) => {
                const no = sira.get(row.id);
                const parts = splitContext(row.context);
                return (
                  <tr key={row.id} className={no ? "dg-on" : ""}>
                    <td>
                      {no ? (
                        <span className="dg-sira">
                          <b>{no}</b>
                          {mod === "ana" ? (
                            <span className="dg-mv">
                              <button type="button" data-dg-mv="-1" disabled={no === 1 || busy} aria-label="Yukarı" onClick={() => move(row, -1)}>↑</button>
                              <button type="button" data-dg-mv="1" disabled={no === anaN || busy} aria-label="Aşağı" onClick={() => move(row, 1)}>↓</button>
                            </span>
                          ) : null}
                        </span>
                      ) : <span className="fx-muted">—</span>}
                    </td>
                    <td className="fx-who"><b>{row.name}</b><small>{formatTrListDate(row.created_at).primary}</small></td>
                    <td className="fx-who"><b className="dg-konu">{parts.konu || "—"}</b><small>{parts.kat || "Kategori yok"} <span className="dg-dil">{row.locale.toUpperCase()}</span></small></td>
                    <td><p className="dg-metin">{row.quote ? `“${row.quote}”` : <span className="fx-muted">[Yorum metni]</span>}</p></td>
                    <td>
                      <button type="button" className={`dg-tg${no ? " on" : ""}`} data-dg-tg={row.id} aria-pressed={Boolean(no)} disabled={busy} onClick={() => toggleHome(row)}>
                        {I_STAR}{no ? "Ana sayfada" : "Ana sayfaya ekle"}
                      </button>
                    </td>
                    <td>
                      <div className="fx-act">
                        <button type="button" className="fx-ib" title="Düzenle" aria-label="Düzenle" data-dg-edit={row.id} onClick={() => setEditing(row)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button>
                        <button type="button" className="fx-ib del" title="Arşive taşı" aria-label="Arşive taşı" data-dg-del={row.id} onClick={() => setArchiving(row)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && !data ? (
            <div className="fx-empty" id="dg-empty"><b>Yorumlar yükleniyor…</b></div>
          ) : (
            <div className="fx-empty" id="dg-empty" hidden={visible.length > 0}>
              <span className="fx-empty-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg></span>
              <b data-t="">{loadError ? "Yorumlar yüklenemedi" : "Sonuç bulunamadı"}</b>
              <span data-s="">{loadError || "Aramayı veya filtreleri değiştirmeyi deneyin."}</span>
            </div>
          )}

          <div className="foot"><span id="dg-shown">{visible.length} yorum gösteriliyor</span><span>Ana sayfadaki sırayı ↑ ↓ ile değiştirin</span></div>
        </section>
      </div></div>

      {editing ? (
        <ReviewDialog
          key={editing === "new" ? "new" : editing.id}
          review={editing === "new" ? null : editing}
          rows={rows}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}

      {archiving ? (
        <FxConfirmDialog
          title="Yorum arşive taşınsın mı?"
          sub={`${archiving.name} · ${splitContext(archiving.context).konu || "—"}`}
          text={"Yorum listeden kaldırılıp arşive taşınır ve sitede gösterilmez; kayıt silinmez. Yalnızca ana sayfadan kaldırmak için \"Ana sayfada\" düğmesine basabilirsiniz."}
          ok="Arşive taşı"
          tone="neutral"
          busy={busy}
          onClose={() => setArchiving(null)}
          onConfirm={() => {
            const row = archiving;
            void run(() => archiveReview(row, home), "Yorum arşive taşındı").then(() => setArchiving(null));
          }}
        />
      ) : null}
    </div>
  );
}

export default function AdminEvaluationsPage() {
  return (
    <Suspense fallback={null}>
      <AdminReviews />
    </Suspense>
  );
}
