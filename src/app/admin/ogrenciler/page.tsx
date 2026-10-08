"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ARCHIVE_REASONS, archiveAdminMember, listAdminStudents, restoreAdminMember, type ArchiveReason, type StudentProfile } from "@/lib/admin/students";
import { invalidateStudentData, queryKeys, useQuery } from "@/lib/data/query-store";
import { NewStudentDialog } from "@/components/admin/NewStudentDialog";
import { toast } from "@/components/ui/toast";
import { compareTr, foldTurkish } from "@/lib/format/turkish";
import { formatTrPhoneDisplay } from "@/lib/format/phone";
import pages from "@/components/admin/admin-pages.module.css";

// Referans "Öğrenciler" listesi (#view-list): Aktif / Arşiv, özet kutuları,
// hızlı filtreler, sütun sıralaması, sayfalama ve Excel'e aktarma. Liste
// yalnızca öğrenci hesaplarını gösterir; öğrenci hiçbir zaman silinmez.

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const SAYFA = 25;
const EMPTY: StudentProfile[] = [];

type Mod = "aktif" | "arsiv";
type SortKey = "ad" | "sinif" | "program" | "sinav" | "kalan" | "son";
type Durum = "" | "az" | "yok" | "yeni" | "uzun" | "eksik";

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const gunFark = (value: string, today: Date) => Math.round((startOfDay(today) - startOfDay(new Date(value))) / 864e5);
const gunAd = (value: string) => { const d = new Date(value); return `${pad(d.getDate())} ${AYLAR[d.getMonth()]} ${GUNLER[d.getDay()]}`; };
const sinifEtiket = (value: string | null) => (!value ? "" : /^\d+$/.test(value.trim()) ? `${value.trim()}. sınıf` : value);

function kalanOf(o: StudentProfile) {
  const p = o.activePackage;
  return p ? { paket: p.name, toplam: p.lessonCount, kalan: Math.max(0, p.lessonCount - p.lessonsUsed) } : null;
}

function eksikler(o: StudentProfile) {
  const list: string[] = [];
  if (!o.school) list.push("okul");
  if (!o.gradeLevel) list.push("sınıf");
  if (!o.educationProgram) list.push("program");
  if (o.relationshipRole !== "self" && !o.guardianName) list.push("veli adı");
  if (!(o.guardianPhone || o.guardianEmail || o.phone || o.email)) list.push("iletişim");
  return list;
}

function sinavlar(o: StudentProfile) {
  return [...new Set(o.examsTaken.map((exam) => exam.trim()).filter(Boolean))].sort(compareTr);
}

// Sınıflar 1→12, sonra University, en sonda Mezun; boş alanlar her zaman sonda.
function sortVal(o: StudentProfile, key: SortKey): string | number | null {
  if (key === "sinif") {
    const s = o.gradeLevel?.trim();
    if (!s) return null;
    if (/^\d/.test(s)) return parseInt(s, 10);
    if (/^university/i.test(s)) return 100 + (parseInt(s.replace(/\D/g, ""), 10) || 0);
    if (/mezun/i.test(s)) return 1000;
    return 500;
  }
  if (key === "program") return o.educationProgram || null;
  if (key === "sinav") return sinavlar(o)[0] ?? null;
  return null;
}

const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>;
const ICO_TRASH = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;
const ICO_RESTORE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>;
const CHECK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
const STOP = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>;

export default function AdminStudentsPage() {
  return (
    <Suspense fallback={null}>
      <AdminStudentsContent />
    </Suspense>
  );
}

function AdminStudentsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialDurum = params.get("durum");
  const [mod, setMod] = useState<Mod>("aktif");
  const [q, setQ] = useState(() => params.get("search") || "");
  const [quick, setQuick] = useState<"" | "az" | "yok">(() => (initialDurum === "az" || initialDurum === "yok" ? initialDurum : ""));
  const [durum, setDurum] = useState<Durum>(() => (["az", "yok", "yeni", "uzun", "eksik"].includes(initialDurum ?? "") ? initialDurum as Durum : ""));
  const [sinav, setSinav] = useState("");
  const [paket, setPaket] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ad");
  const [sortDir, setSortDir] = useState(1);
  const [sayfa, setSayfa] = useState(1);
  const [arcTarget, setArcTarget] = useState<StudentProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [yeniOpen, setYeniOpen] = useState(() => params.get("yeni") === "1");
  const cardRef = useRef<HTMLElement>(null);

  const active = useQuery(`${queryKeys.adminStudents}:active`, () => listAdminStudents({ archived: false }), { staleTime: 30_000 });
  const archived = useQuery(`${queryKeys.adminStudents}:archive`, () => listAdminStudents({ archived: true }), { staleTime: 30_000 });
  const aktifler = useMemo(() => (active.data?.data ?? EMPTY).filter((o) => o.context === "student_account"), [active.data]);
  const arsivdekiler = useMemo(() => (archived.data?.data ?? EMPTY).filter((o) => o.context === "student_account"), [archived.data]);
  const havuz = mod === "arsiv" ? arsivdekiler : aktifler;
  const current = mod === "arsiv" ? archived : active;
  const loadError = current.data?.error || "";

  const fd: Durum = quick || durum;

  const options = useMemo(() => {
    const all = [...aktifler, ...arsivdekiler];
    return {
      sinavlar: [...new Set(all.flatMap(sinavlar))].sort(compareTr),
      paketler: [...new Set(all.map((o) => o.activePackage?.name).filter((v): v is string => Boolean(v)))].sort(compareTr),
      programlar: [...new Set(all.map((o) => o.educationProgram?.trim()).filter((v): v is string => Boolean(v)))].sort(compareTr),
    };
  }, [aktifler, arsivdekiler]);

  const view = useMemo(() => {
    const today = new Date();
    const hafta = aktifler.filter((o) => o.lastLessonDate && gunFark(o.lastLessonDate, today) <= 7).length;
    const ozet = {
      toplam: aktifler.length,
      hafta,
      kalan: aktifler.reduce((t, o) => t + (kalanOf(o)?.kalan ?? 0), 0),
      az: aktifler.filter((o) => { const k = kalanOf(o); return k && k.kalan > 0 && k.kalan <= 3; }).length,
      yok: aktifler.filter((o) => { const k = kalanOf(o); return !k || k.kalan <= 0; }).length,
    };
    const hak = arsivdekiler.filter((o) => (kalanOf(o)?.kalan ?? 0) > 0);
    const son = arsivdekiler.slice().sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""))[0];
    const arsiv = {
      toplam: arsivdekiler.length,
      kalan: hak.reduce((t, o) => t + (kalanOf(o)?.kalan ?? 0), 0),
      kalanS: hak.length ? `${hak.length} öğrencinin paketinde` : "arşivde kalan ders yok",
      yok: arsivdekiler.filter((o) => !o.activePackage).length,
      son: son ? son.fullName : "—",
      sonS: son?.archivedAt ? (() => { const d = new Date(son.archivedAt); return `${pad(d.getDate())} ${AYLAR[d.getMonth()]} ${d.getFullYear()} ${GUNLER[d.getDay()]}`; })() : "arşiv boş",
    };

    const query = foldTurkish(q.trim());
    const list = havuz.filter((o) => {
      const k = kalanOf(o);
      if (query && !foldTurkish([o.fullName, o.school ?? "", ...sinavlar(o), o.educationProgram ?? "", o.guardianName ?? ""].join(" ")).includes(query)) return false;
      if (fd === "az" && !(k && k.kalan > 0 && k.kalan <= 3)) return false;
      if (fd === "yok" && k && k.kalan > 0) return false;
      if (fd === "yeni" && o.lastLessonDate) return false;
      if (fd === "uzun" && !(k && o.lastLessonDate && gunFark(o.lastLessonDate, today) >= 7)) return false;
      if (fd === "eksik" && !eksikler(o).length) return false;
      if (sinav && !sinavlar(o).includes(sinav)) return false;
      if (paket === "__yok" && o.activePackage) return false;
      if (paket && paket !== "__yok" && o.activePackage?.name !== paket) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortKey === "sinif" || sortKey === "program" || sortKey === "sinav") {
        const va = sortVal(a, sortKey);
        const vb = sortVal(b, sortKey);
        if (va === null || vb === null) return va === vb ? compareTr(a.fullName, b.fullName) : va === null ? 1 : -1;
        const c = typeof va === "number" && typeof vb === "number" ? va - vb : compareTr(String(va), String(vb));
        return (c || compareTr(a.fullName, b.fullName) * sortDir) * sortDir;
      }
      if (sortKey === "kalan") return ((kalanOf(a)?.kalan ?? -1) - (kalanOf(b)?.kalan ?? -1)) * sortDir;
      if (sortKey === "son") {
        const ka = (mod === "arsiv" ? a.archivedAt : a.lastLessonDate) || "";
        const kb = (mod === "arsiv" ? b.archivedAt : b.lastLessonDate) || "";
        return (ka < kb ? -1 : ka > kb ? 1 : 0) * sortDir;
      }
      return (compareTr(a.fullName, b.fullName) || a.id.localeCompare(b.id)) * sortDir;
    });
    return { ozet, arsiv, list, today };
  }, [aktifler, arsivdekiler, havuz, q, fd, sinav, paket, sortKey, sortDir, mod]);

  const { list, ozet, arsiv, today } = view;
  const sn = Math.max(1, Math.ceil(list.length / SAYFA));
  const page = Math.min(sayfa, sn);
  const shown = list.slice((page - 1) * SAYFA, page * SAYFA);
  const loading = current.loading && !current.data;

  useEffect(() => {
    if (sayfa > 1) cardRef.current?.scrollIntoView({ block: "start" });
  }, [sayfa]);

  const resetPage = () => setSayfa(1);
  const pickQuick = (key: "az" | "yok") => {
    setQuick(key);
    setDurum(key);
    resetPage();
  };
  const clearQuick = () => {
    setQuick("");
    setDurum("");
    resetPage();
  };
  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(key === "son" ? -1 : 1); }
  };
  const ariaSort = (key: SortKey) => (sortKey === key ? (sortDir === 1 ? "ascending" : "descending") : undefined);

  function switchMod(next: Mod) {
    setMod(next);
    setQuick("");
    setDurum("");
    resetPage();
  }

  function refreshAll() {
    invalidateStudentData();
    void active.refetch();
    void archived.refetch();
  }

  async function restore(o: StudentProfile, message = `${o.fullName} aktif öğrencilere geri alındı`) {
    if (!o.userId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const result = await restoreAdminMember(o.userId);
    busyRef.current = false;
    setBusy(false);
    if (!result.success) { toast.error(result.error || "Öğrenci arşivden çıkarılamadı."); return; }
    refreshAll();
    toast.success(message);
  }

  // Referans arsivle(): arşive taşıma sonrası 6 sn "Geri al" eylemi. Geri alma
  // aynı kanonik admin_restore_member akışını kullanır ve tek kez çalışır.
  async function archive(o: StudentProfile, reason: ArchiveReason | null, note: string) {
    if (!o.userId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const result = await archiveAdminMember(o.userId, { reason, note });
    busyRef.current = false;
    setBusy(false);
    if (!result.success) { toast.error(result.error || "Öğrenci arşive taşınamadı."); return; }
    setArcTarget(null);
    refreshAll();
    toast.action(`${o.fullName} arşive taşındı`, { label: "Geri al", onAction: () => void restore(o, `${o.fullName} geri alındı`) });
  }

  function studentCreated(student: { id: string; name: string }) {
    refreshAll();
    toast.action(`${student.name} eklendi`, { label: "Detayı aç", onAction: () => router.push(`/admin/ogrenciler/detay?student=${encodeURIComponent(student.id)}`) });
  }

  function exportCsv() {
    const head = ["Ad Soyad", "Okul", "Sınıf", "Program", "Sınavlar", "Veli", "E-posta", "Telefon", "Paket", "Toplam ders", "Kalan ders", "Son ders", "Durum"];
    const cell = (value: string | number | null | undefined) => { const v = value == null ? "" : String(value); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const lines = list.map((o) => {
      const k = kalanOf(o);
      const veli = o.relationshipRole !== "self" && o.guardianName ? o.guardianName : "";
      const eposta = veli ? o.guardianEmail || o.email : o.email;
      const tel = veli ? o.guardianPhone || o.phone : o.phone;
      const son = o.lastLessonDate ? (() => { const d = new Date(o.lastLessonDate); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; })() : "";
      return [o.fullName, o.school, sinifEtiket(o.gradeLevel), o.educationProgram, sinavlar(o).join(", "), veli, eposta, tel ? formatTrPhoneDisplay(tel) : "", k ? k.paket : "Paket yok", k ? k.toplam : "", k ? k.kalan : "", son, o.archived ? "Arşivde" : "Aktif"].map(cell).join(";");
    });
    const csv = `﻿${head.join(";")}\r\n${lines.join("\r\n")}`;
    const now = new Date();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `ogrenciler-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success(`${list.length} öğrenci Excel dosyasına aktarıldı`);
  }

  return (
    <div id="view-list" className={pages.root}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div>
            <h1>Öğrenciler</h1>
            <p>Paketleri, kalan dersleri ve son aktiviteyi tek ekrandan takip edin.</p>
          </div>
          <div className="fx-headr">
            <div className="seg" role="group" aria-label="Öğrenci durumu">
              <button type="button" aria-pressed={mod === "aktif"} data-seg="aktif" onClick={() => switchMod("aktif")}>Aktif<small data-count-aktif="">{aktifler.length}</small></button>
              <button type="button" aria-pressed={mod === "arsiv"} data-seg="arsiv" onClick={() => switchMod("arsiv")}>Arşiv<small data-count-arsiv="">{arsivdekiler.length}</small></button>
            </div>
            <button className="fx-btn primary" type="button" data-yo-open="" onClick={() => setYeniOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Yeni Öğrenci
            </button>
          </div>
        </div>

        <div className="stats" data-for="aktif" hidden={mod !== "aktif"}>
          <button type="button" className="stat btn good" aria-pressed={quick === "" && durum === ""} onClick={clearQuick}><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></span><span className="l">Aktif öğrenci</span><b data-s="toplam">{ozet.toplam}</b><span className="s" data-s="hafta">{ozet.hafta} öğrenci son 7 günde derste · tümünü göster</span></button>
          <div className="stat info"><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z" /><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z" /></svg></span><span className="l">Toplam kalan ders</span><b data-s="kalan">{ozet.kalan}</b><span className="s">aktif paketlerde</span></div>
          <button type="button" className="stat btn warn" data-quick="az" aria-pressed={quick === "az"} onClick={() => pickQuick("az")}><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><span className="l">Az ders kalan</span><b data-s="az">{ozet.az}</b><span className="s">3 ders veya daha az · filtrele</span></button>
          <button type="button" className="stat btn bad" data-quick="yok" aria-pressed={quick === "yok"} onClick={() => pickQuick("yok")}><span className="st-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg></span><span className="l">Paketi olmayan</span><b data-s="yok">{ozet.yok}</b><span className="s">yeni paket tanımlanmalı · filtrele</span></button>
        </div>
        <div className="stats" data-for="arsiv" hidden={mod !== "arsiv"}>
          <div className="stat"><span className="l">Arşivdeki öğrenci</span><b data-a="toplam">{arsiv.toplam}</b><span className="s">tüm kayıtları korunuyor</span></div>
          <div className="stat"><span className="l">Kullanılmamış ders hakkı</span><b data-a="kalan">{arsiv.kalan}</b><span className="s" data-a="kalan-s">{arsiv.kalanS}</span></div>
          <div className="stat"><span className="l">Paketi olmayan</span><b data-a="yok">{arsiv.yok}</b><span className="s">hiç paket tanımlanmamış</span></div>
          <div className="stat"><span className="l">Son arşivlenen</span><b className="sm" data-a="son">{arsiv.son}</b><span className="s" data-a="son-s">{arsiv.sonS}</span></div>
        </div>

        <section className="card" ref={cardRef}>
          <div className="tools">
            <label className="search"><span className="sr">Öğrenci ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" id="l-q" placeholder="Öğrenci, veli veya okul ara…" value={q} onChange={(event) => { setQ(event.target.value); resetPage(); }} />
            </label>
            <label><span className="sr">Durum</span><select className="sel" id="l-durum" value={fd} onChange={(event) => { setQuick(""); setDurum(event.target.value as Durum); resetPage(); }}>
              <option value="">Tüm durumlar</option><option value="az">Az ders kalan</option><option value="yok">Paket yok</option><option value="yeni">Henüz ders yok</option><option value="uzun">7+ gündür ders yok</option><option value="eksik">Bilgisi eksik</option>
            </select></label>
            <label><span className="sr">Sınav</span><select className="sel" id="l-sinav" value={sinav} onChange={(event) => { setSinav(event.target.value); resetPage(); }}><option value="">Tüm sınavlar</option>{options.sinavlar.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span className="sr">Paket</span><select className="sel" id="l-paket" value={paket} onChange={(event) => { setPaket(event.target.value); resetPage(); }}><option value="">Tüm paketler</option>{options.paketler.map((item) => <option key={item}>{item}</option>)}<option value="__yok">Paket yok</option></select></label>
            <button type="button" className="fx-btn l-export" data-l-export="" title="Excel’e aktar (filtrelenmiş liste)" aria-label="Excel’e aktar" onClick={exportCsv} disabled={!list.length}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></svg><span>Excel’e aktar</span>
            </button>
          </div>

          <div className="grid thead" role="row">
            <button type="button" data-sort="ad" aria-sort={ariaSort("ad")} onClick={() => sortBy("ad")}>Öğrenci</button>
            <button type="button" data-sort="sinif" aria-sort={ariaSort("sinif")} onClick={() => sortBy("sinif")}>Sınıf</button>
            <button type="button" data-sort="program" aria-sort={ariaSort("program")} onClick={() => sortBy("program")}>Program</button>
            <button type="button" data-sort="sinav" aria-sort={ariaSort("sinav")} onClick={() => sortBy("sinav")}>Sınavlar</button>
            <button type="button" data-sort="kalan" aria-sort={ariaSort("kalan")} onClick={() => sortBy("kalan")}>Kalan ders</button>
            <button type="button" data-sort="son" data-son-lab="" aria-sort={ariaSort("son")} onClick={() => sortBy("son")}>{mod === "arsiv" ? "Arşive taşındı" : "Son ders"}</button>
            <span />
          </div>
          <ul className="rows" id="l-rows">
            {shown.map((o) => <StudentRow key={o.id} o={o} today={today} eksikMode={fd === "eksik"} busy={busy} onArchive={() => setArcTarget(o)} onRestore={() => void restore(o)} />)}
          </ul>
          {loading ? (
            <div className="empty" id="l-empty"><b>Öğrenciler yükleniyor…</b></div>
          ) : (
            <div className="empty" id="l-empty" hidden={list.length > 0}>
              {loadError ? <><b>Öğrenciler yüklenemedi</b>{loadError}</> : mod === "arsiv" && !havuz.length ? <><b>Arşiv boş</b>Arşive taşınan öğrenciler burada listelenir.</> : <><b>Sonuç bulunamadı</b>Aramayı veya filtreleri değiştirmeyi deneyin.</>}
            </div>
          )}
          <div className="foot">
            <span id="l-shown">{sn > 1 ? `${(page - 1) * SAYFA + 1}–${Math.min(page * SAYFA, list.length)} · ` : ""}{list.length} / {havuz.length}{mod === "arsiv" ? " arşivdeki öğrenci gösteriliyor" : " öğrenci gösteriliyor"}</span>
            <span className="l-pager" id="l-pager" hidden={sn < 2}>
              {sn > 1 ? (
                <>
                  <button type="button" disabled={page === 1} aria-label="Önceki sayfa" onClick={() => setSayfa(page - 1)}>‹</button>
                  {Array.from({ length: sn }, (_, i) => i + 1).map((n) => <button key={n} type="button" aria-current={n === page ? "page" : undefined} onClick={() => setSayfa(n)}>{n}</button>)}
                  <button type="button" disabled={page === sn} aria-label="Sonraki sayfa" onClick={() => setSayfa(page + 1)}>›</button>
                </>
              ) : null}
            </span>
            <span>Satıra tıklayarak öğrenci detayını açın</span>
          </div>
        </section>
      </div></div>

      {arcTarget ? <ArchiveDialog student={arcTarget} busy={busy} onClose={() => setArcTarget(null)} onConfirm={(reason, note) => void archive(arcTarget, reason, note)} /> : null}

      {yeniOpen ? <NewStudentDialog programs={options.programlar} onClose={() => setYeniOpen(false)} onCreated={studentCreated} /> : null}
    </div>
  );
}

function StudentRow({ o, today, eksikMode, busy, onArchive, onRestore }: {
  o: StudentProfile;
  today: Date;
  eksikMode: boolean;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const k = kalanOf(o);
  const state = !k ? "yok" : k.kalan <= 1 ? "crit" : k.kalan <= 3 ? "low" : "ok";
  const sinif = sinifEtiket(o.gradeLevel);
  const meta = [sinif, o.educationProgram].filter(Boolean).join(" · ");
  const exams = sinavlar(o);
  const href = `/admin/ogrenciler/detay?student=${encodeURIComponent(o.userId || o.id)}`;

  let last: ReactNode;
  if (o.archived && o.archivedAt) {
    const g = gunFark(o.archivedAt, today);
    last = <div className="last"><b>{gunAd(o.archivedAt)}</b><span>{g <= 0 ? "bugün arşivlendi" : g === 1 ? "dün arşivlendi" : `${g} gün önce arşivlendi`}</span>{o.archiveReason ? <em className="arc-why" title={o.archiveNote || ""}>{o.archiveReason}</em> : null}</div>;
  } else if (!o.lastLessonDate) {
    last = <div className="last"><b className="muted">—</b><span>Henüz ders yok</span></div>;
  } else {
    const g = gunFark(o.lastLessonDate, today);
    last = <div className={`last${g >= 7 ? " stale" : ""}`}><b>{gunAd(o.lastLessonDate)}</b><span>{g <= 0 ? "bugün" : g === 1 ? "dün" : `${g} gün önce`}</span></div>;
  }

  return (
    <li>
      <Link className={`grid row${o.archived ? " archived" : ""}`} href={href}>
        <div className="who"><b>{o.fullName}</b><span>{o.school || "Okul eklenmedi"}</span>{eksikMode ? <em className="eksik">Eksik: {eksikler(o).join(", ")}</em> : null}</div>
        <div className="cell c-sinif">{sinif || <span className="muted">—</span>}</div>
        <div className="cell c-prog">{o.educationProgram ? <span className="chip" title={o.educationProgram}>{o.educationProgram}</span> : <span className="muted">—</span>}</div>
        <div className="meta">{meta}</div>
        <div className="exams">{exams.map((exam) => <span key={exam} className="exam">{exam}</span>)}</div>
        {k ? (
          <div className={`kalan ${state}`}><div className="top"><span className="pk">{k.paket}</span><span className="n"><b>{k.kalan}</b> / {k.toplam}</span></div><div className="bar"><i style={{ width: `${k.toplam ? Math.round((k.kalan / k.toplam) * 100) : 0}%` }} /></div></div>
        ) : (
          <span className="nopkg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>Paket yok</span>
        )}
        {last}
        <span className="chev" aria-hidden="true">{CHEV}</span>
      </Link>
      {o.userId ? (
        <div className="row-act">
          {o.archived ? (
            <button type="button" className="arch restore" data-restore={o.id} title="Arşivden çıkar" aria-label={`${o.fullName} arşivden çıkar`} disabled={busy} onClick={onRestore}>{ICO_RESTORE}</button>
          ) : (
            <button type="button" className="arch" data-arch={o.id} title="Arşive taşı" aria-label={`${o.fullName} arşive taşı`} disabled={busy} onClick={onArchive}>{ICO_TRASH}</button>
          )}
        </div>
      ) : null}
    </li>
  );
}

// Referans #arc-dialog: öğrenci silinmez, yalnızca arşive taşınır.
function ArchiveDialog({ student, busy, onClose, onConfirm }: { student: StudentProfile; busy: boolean; onClose: () => void; onConfirm: (reason: ArchiveReason | null, note: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [neden, setNeden] = useState<ArchiveReason | null>(null);
  const [not, setNot] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const close = () => ref.current?.close();
  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog ref={ref} className="arc" id="arc-dialog" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <div className="m-modal" role="alertdialog" aria-modal="true" aria-labelledby="arc-title">
          <div className="m-head">
            <div className="m-hicon" style={{ background: "#FBECEA" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9A3324" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><h2 id="arc-title" className="m-htitle">Arşive taşı</h2><span className="m-hsub" data-arc-name="">{student.fullName}</span></div>
            <button type="button" className="m-close" aria-label="Kapat" data-arc-close="" onClick={close}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          <div className="m-body">
            <p><b data-arc-name="">{student.fullName}</b> aktif listeden kaldırılıp arşive taşınacak. Öğrenci silinmez.</p>
            <div className="arc-field">
              <span className="m-lab" id="arc-neden-l">Arşiv nedeni <span className="arc-opt">(isteğe bağlı)</span></span>
              <div className="arc-reasons" role="radiogroup" aria-labelledby="arc-neden-l">
                {ARCHIVE_REASONS.map((reason) => (
                  <button key={reason} type="button" role="radio" aria-checked={neden === reason} data-neden={reason} onClick={() => setNeden((current) => (current === reason ? null : reason))}>{reason}</button>
                ))}
              </div>
              <input id="arc-not" className="m-input" placeholder="Kısa açıklama (isteğe bağlı)" maxLength={120} aria-label="Arşiv açıklaması" value={not} onChange={(event) => setNot(event.target.value)} />
            </div>
            <div className="arc-cols">
              <div><span className="arc-h">Korunur</span><ul className="arc-keep">
                <li>{CHECK}Ders, paket, ödeme ve not kayıtlarının tamamı</li>
                <li>{CHECK}Kalan ders hakkı (dondurulur, geri alınınca devam eder)</li>
                <li>{CHECK}Ödeme kayıtları Ödemeler ve Gelir İstatistikleri ekranlarında kalır</li>
              </ul></div>
              <div><span className="arc-h">Durdurulur</span><ul className="arc-keep arc-stop">
                <li>{STOP}Öğrenci ve veli giriş erişimi</li>
                <li>{STOP}Veliye giden e-posta bildirimleri</li>
                <li>{STOP}Ders kaydı, paket ve düzenleme işlemleri</li>
              </ul></div>
            </div>
            <p className="arc-note">Arşiv sekmesinden istediğiniz zaman geri alabilirsiniz; erişim ve bildirimler yeniden açılır.</p>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" data-arc-close="" onClick={close}>Vazgeç</button>
            <button type="button" className="m-delok" data-arc-ok="" disabled={busy} onClick={() => onConfirm(neden, not)}>{busy ? "Taşınıyor…" : "Arşive taşı"}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
