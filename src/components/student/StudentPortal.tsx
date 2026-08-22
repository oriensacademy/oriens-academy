"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, Check, ClipboardList, Copy, CreditCard, LayoutDashboard, LogOut, Package, RefreshCw, Save, UserRound } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getStudentCopy } from "@/content/student-portal";
import { localizedPath } from "@/lib/routes";
import { updateStudentEmail, updateStudentPassword } from "@/lib/student/auth";
import { useAccount } from "@/lib/auth/account-context";
import { loginPathWithReturn } from "@/lib/auth/account-routing";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { getStudentPortalData, submitStudentHomework, updateStudentProfile, type StudentHomeworkRow, type StudentPortalData } from "@/lib/student/data";
import { cn } from "@/lib/utils";

const sectionIds = ["overview", "profile", "appointments", "lessons", "homework", "package", "payments"] as const;
type SectionId = typeof sectionIds[number];
const icons = [LayoutDashboard, UserRound, CalendarDays, BookOpen, ClipboardList, Package, CreditCard];

export function StudentPortal() {
  const locale = useLocale(); const copy = getStudentCopy(locale); const router = useRouter();
  const { accountType, user, isInitializing, signOut } = useAccount();
  const [section, setSection] = useState<SectionId>("overview"); const [data, setData] = useState<StudentPortalData | null>(null);
  const userId = user?.id || ""; const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const navigatedRef = useRef(false);
  const loadedUserRef = useRef("");
  const load = useCallback(async (id: string) => { setLoading(true); const result = await getStudentPortalData(id); setLoading(false); if (result.error || !result.data?.profile.active) { setError(result.error || "INACTIVE_PROFILE"); return; } setData(result.data); }, []);

  useEffect(() => {
    if (isInitializing || navigatedRef.current) return;
    if (accountType === "unauthenticated" || accountType === "unknown") {
      navigatedRef.current = true; router.replace(loginPathWithReturn(locale, localizedPath("studentAccount", locale))); return;
    }
    if (accountType === "admin") { navigatedRef.current = true; router.replace("/admin"); return; }
    if (accountType === "student" && user && loadedUserRef.current !== user.id) { loadedUserRef.current = user.id; void load(user.id); }
  }, [accountType, isInitializing, locale, load, router, user]);

  async function logout() { navigatedRef.current = true; await signOut(); router.replace(localizedPath("home", locale)); }
  if (isInitializing || accountType !== "student") return <AccountWaveLoader />;
  if (loading || !data) return <section className="min-h-screen bg-background pt-32"><div className="public-container"><div className="mx-auto max-w-6xl animate-pulse rounded-2xl border border-border bg-surface p-10 text-sm text-muted-foreground">{error || (locale === "tr" ? "Öğrenci hesabı yükleniyor…" : "Loading student account…")}</div></div></section>;

  return <section className="min-h-screen bg-background pt-24 pb-28 md:pt-28 lg:pb-16"><div className="public-container"><div className="mx-auto max-w-7xl">
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{locale === "tr" ? "Öğrenci Hesabı" : "Student Account"}</p><h1 className="mt-2 font-heading text-4xl text-ink">{locale === "tr" ? "Hoş geldiniz" : "Welcome"}, {data.profile.full_name.split(" ")[0]}</h1></div><div className="flex gap-2"><button onClick={() => load(userId)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold text-ink hover:bg-surface-muted"><RefreshCw className="size-4" />{locale === "tr" ? "Yenile" : "Refresh"}</button><button onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold text-ink hover:bg-surface-muted"><LogOut className="size-4" />{locale === "tr" ? "Çıkış" : "Log out"}</button></div></header>
    <div className="mt-7 grid gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]"><nav aria-label={locale === "tr" ? "Hesap bölümleri" : "Account sections"} className="hidden h-fit rounded-2xl border border-border bg-surface p-2 lg:block">{sectionIds.map((id, index) => { const Icon = icons[index]; return <button key={id} onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors", section === id ? "bg-ink font-semibold text-white" : "text-muted-foreground hover:bg-surface-muted hover:text-ink")}><Icon className="size-4" />{copy.tabs[index]}</button>; })}</nav>
      <main className="min-w-0">{section === "overview" && <Overview data={data} locale={locale} onNavigate={setSection} />}{section === "profile" && <Profile data={data} userId={userId} locale={locale} onReload={() => load(userId)} />}{section === "appointments" && <Appointments data={data} locale={locale} />}{section === "lessons" && <Lessons data={data} locale={locale} />}{section === "homework" && <Homework data={data} locale={locale} onReload={() => load(userId)} />}{section === "package" && <PackageView data={data} locale={locale} />}{section === "payments" && <Payments data={data} locale={locale} />}</main>
    </div>
  </div></div><nav aria-label={locale === "tr" ? "Mobil hesap bölümleri" : "Mobile account sections"} className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden"><div className="mx-auto flex min-w-max justify-center gap-1">{sectionIds.map((id, index) => { const Icon = icons[index]; return <button key={id} onClick={() => setSection(id)} className={cn("flex min-h-14 min-w-[4.4rem] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px]", section === id ? "bg-sage-soft font-semibold text-ink" : "text-muted-foreground")}><Icon className="size-4" />{copy.tabs[index]}</button>; })}</div></nav></section>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7"><h2 className="font-heading text-2xl text-ink">{title}</h2><div className="mt-5">{children}</div></section>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">{children}</p>; }
function fmt(value: string | null, locale: "tr" | "en", withTime = false) { if (!value) return "—"; return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", ...(withTime ? { timeStyle: "short" as const } : {}) }).format(new Date(value)); }
function status(value: string, locale: "tr" | "en") { const tr: Record<string,string> = { pending:"Bekliyor",confirmed:"Onaylandı",cancelled:"İptal",completed:"Tamamlandı",no_show:"Katılmadı",scheduled:"Planlandı",assigned:"Atandı",submitted:"Gönderildi",reviewed:"İncelendi",late:"Gecikti",paid:"Ödendi",failed:"Başarısız",processing:"İşleniyor",requires_action:"Doğrulama Gerekli",refunded:"İade" }; const en: Record<string,string> = { pending:"Pending",confirmed:"Confirmed",cancelled:"Cancelled",completed:"Completed",no_show:"No show",scheduled:"Scheduled",assigned:"Assigned",submitted:"Submitted",reviewed:"Reviewed",late:"Late",paid:"Paid",failed:"Failed",processing:"Processing",requires_action:"Verification required",refunded:"Refunded" }; return (locale === "tr" ? tr : en)[value] || value; }

function Overview({ data, locale, onNavigate }: { data: StudentPortalData; locale: "tr"|"en"; onNavigate: (id: SectionId) => void }) { const purchase = data.purchases.find((p) => p.status === "active") || data.purchases[0]; const next = data.bookings.filter((b) => b.availability_slots && new Date(b.availability_slots.starts_at) > new Date() && !["cancelled","completed"].includes(b.status)).sort((a,b) => (a.availability_slots?.starts_at || "").localeCompare(b.availability_slots?.starts_at || ""))[0]; const activeHomework = data.homework.filter((h) => ["assigned","late","submitted"].includes(h.status)); const payment = data.payments[0]; return <div className="grid gap-5 sm:grid-cols-2"><button onClick={() => onNavigate("package")} className="rounded-2xl border border-border bg-forest p-6 text-left text-white sm:col-span-2"><p className="text-xs uppercase tracking-wider text-white/65">{locale === "tr" ? "Mevcut Paket" : "Current Package"}</p><h2 className="mt-2 font-heading text-3xl">{purchase ? (locale === "tr" ? purchase.pricing_packages?.name_tr : purchase.pricing_packages?.name_en) || purchase.package_id : "—"}</h2>{purchase && <><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-warm-accent" style={{ width: `${Math.min(100, purchase.lesson_count ? purchase.lessons_used / purchase.lesson_count * 100 : 0)}%` }} /></div><p className="mt-2 text-sm text-white/75">{locale === "tr" ? "Tamamlanan Ders" : "Completed Lessons"}: {purchase.lessons_used} / {purchase.lesson_count} · {locale === "tr" ? "Kalan" : "Remaining"}: {Math.max(0, purchase.lesson_count - purchase.lessons_used)}</p></>}</button><Summary title={locale === "tr" ? "Sonraki Randevu" : "Next Appointment"} value={next ? fmt(next.availability_slots!.starts_at, locale, true) : "—"} onClick={() => onNavigate("appointments")} /><Summary title={locale === "tr" ? "Aktif Ödev" : "Active Homework"} value={String(activeHomework.length)} onClick={() => onNavigate("homework")} /><Summary title={locale === "tr" ? "Son Ödeme" : "Recent Payment"} value={payment ? status(payment.status, locale) : "—"} onClick={() => onNavigate("payments")} /><Summary title={locale === "tr" ? "Toplam Ders Kaydı" : "Lesson Records"} value={String(data.lessons.length)} onClick={() => onNavigate("lessons")} /></div>; }
function Summary({ title, value, onClick }: { title:string; value:string; onClick:()=>void }) { return <button onClick={onClick} className="rounded-2xl border border-border bg-surface p-5 text-left hover:border-border-strong"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p><p className="mt-3 font-heading text-2xl text-ink">{value}</p></button>; }

import { SUPPORTED_EXAMS, SUPPORTED_DESTINATIONS, saveStudentPreferences } from "@/lib/student/preferences";

function Profile({ data, userId, locale, onReload }: { data: StudentPortalData; userId: string; locale: "tr" | "en"; onReload: () => void }) {
  const isTr = locale === "tr";
  const [form, setForm] = useState({
    full_name: data.profile.full_name,
    phone: data.profile.phone || "",
    school: data.profile.school || "",
    target_university: data.profile.target_university || "",
    preferred_language: data.profile.preferred_language,
  });

  const profileRecord = data.profile as unknown as Record<string, unknown>;
  const rawExams = profileRecord.target_exams;
  const rawCountries = profileRecord.target_countries;
  const [selectedExams, setSelectedExams] = useState<string[]>(
    Array.isArray(rawExams) && rawExams.length > 0
      ? rawExams
      : data.profile.target_exam ? [data.profile.target_exam] : []
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    Array.isArray(rawCountries) && rawCountries.length > 0
      ? rawCountries
      : data.profile.target_country ? [data.profile.target_country] : []
  );

  const [email, setEmail] = useState(data.profile.email);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleExam = (id: string) => {
    setSelectedExams((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleCountry = (id: string) => {
    setSelectedCountries((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  async function save() {
    setSaving(true);
    const { error: profileError } = await updateStudentProfile(userId, {
      ...form,
      target_exam: selectedExams[0] || null,
      target_country: selectedCountries[0] || null,
    });
    await saveStudentPreferences(userId, selectedExams, selectedCountries, true);
    setSaving(false);
    setMessage(
      profileError
        ? isTr ? "Profil kaydedilemedi." : "Profile could not be saved."
        : isTr ? "Profil başarıyla güncellendi." : "Profile updated successfully."
    );
    if (!profileError) onReload();
  }

  return (
    <div className="space-y-5">
      <Panel title={isTr ? "Profil Bilgilerim" : "My Profile"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-ink">
            {isTr ? "Ad Soyad" : "Full Name"}
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-input px-3 text-sm"
            />
          </label>

          <label className="text-xs font-semibold text-ink">
            {isTr ? "Telefon" : "Phone"}
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-input px-3 text-sm"
            />
          </label>

          <label className="text-xs font-semibold text-ink">
            {isTr ? "Okul" : "School"}
            <input
              value={form.school}
              onChange={(e) => setForm({ ...form, school: e.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-input px-3 text-sm"
            />
          </label>

          <label className="text-xs font-semibold text-ink">
            {isTr ? "Hedef Üniversite" : "Target University"}
            <input
              value={form.target_university}
              onChange={(e) => setForm({ ...form, target_university: e.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-input px-3 text-sm"
            />
          </label>

          <label className="text-xs font-semibold text-ink sm:col-span-2">
            {isTr ? "Tercih Edilen Dil" : "Preferred Language"}
            <select
              value={form.preferred_language}
              onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        {/* Target Exams Multi-Select Chips */}
        <div className="mt-6 rounded-xl border border-border p-4">
          <label className="flex items-center gap-2 text-xs font-bold text-ink uppercase tracking-wide">
            <span>{isTr ? "Hedef Sınavlar" : "Target Exams"}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              ({selectedExams.length} {isTr ? "seçildi" : "selected"})
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUPPORTED_EXAMS.map((exam) => {
              const isSelected = selectedExams.includes(exam.id);
              return (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => toggleExam(exam.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                  }`}
                >
                  {isSelected && <Check className="size-3" />}
                  <span>{isTr ? exam.name_tr : exam.name_en}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Destinations Multi-Select Chips */}
        <div className="mt-4 rounded-xl border border-border p-4">
          <label className="flex items-center gap-2 text-xs font-bold text-ink uppercase tracking-wide">
            <span>{isTr ? "Hedef Ülkeler" : "Target Countries"}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              ({selectedCountries.length} {isTr ? "seçildi" : "selected"})
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUPPORTED_DESTINATIONS.map((dest) => {
              const isSelected = selectedCountries.includes(dest.id);
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => toggleCountry(dest.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isSelected
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                  }`}
                >
                  {isSelected && <Check className="size-3" />}
                  <span>{isTr ? dest.name_tr : dest.name_en}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-forest disabled:opacity-45"
        >
          <Save className="size-4" />
          {saving ? (isTr ? "Kaydediliyor..." : "Saving...") : (isTr ? "Profili Kaydet" : "Save Profile")}
        </button>
      </Panel>

      <Panel title={isTr ? "Hesap Güvenliği" : "Account Security"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold">
            {isTr ? "Yeni e-posta" : "New email"}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-input px-3 text-sm"
            />
          </label>
          <button
            onClick={async () => {
              const { error } = await updateStudentEmail(email);
              setMessage(
                error
                  ? isTr ? "E-posta güncellenemedi." : "Email could not be updated."
                  : isTr ? "Doğrulama bağlantısı yeni e-posta adresine gönderildi." : "A verification link was sent to the new email."
              );
            }}
            className="self-end min-h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-surface-muted"
          >
            {isTr ? "E-postayı Güncelle" : "Update Email"}
          </button>

          <label className="text-xs font-semibold">
            {isTr ? "Yeni şifre" : "New password"}
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-input px-3 text-sm"
            />
          </label>
          <button
            disabled={password.length < 8}
            onClick={async () => {
              const { error } = await updateStudentPassword(password);
              setMessage(
                error
                  ? isTr ? "Şifre güncellenemedi." : "Password could not be updated."
                  : isTr ? "Şifre güncellendi." : "Password updated."
              );
              setPassword("");
            }}
            className="self-end min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-40 hover:bg-surface-muted"
          >
            {isTr ? "Şifreyi Güncelle" : "Update Password"}
          </button>
        </div>
        {message && <p role="status" className="mt-4 text-xs text-primary">{message}</p>}
      </Panel>
    </div>
  );
}

function Appointments({data,locale}:{data:StudentPortalData;locale:"tr"|"en"}) { return <Panel title={locale==="tr"?"Randevularım":"Appointments"}><div className="mb-5"><Link href={localizedPath("booking",locale)} className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white">{locale==="tr"?"Yeni Randevu Talep Et":"Request Appointment"}</Link></div>{data.bookings.length?<div className="grid gap-3 sm:grid-cols-2">{data.bookings.map(b=><article key={b.id} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-3"><p className="font-semibold text-ink">{b.exam_code||b.custom_exam||(locale==="tr"?"Genel görüşme":"General consultation")}</p><span className="text-xs text-muted-foreground">{status(b.status,locale)}</span></div><time className="mt-3 block text-sm text-muted-foreground">{fmt(b.availability_slots?.starts_at||b.created_at,locale,true)}</time></article>)}</div>:<Empty>{locale==="tr"?"Hesabınıza bağlı randevu bulunmuyor.":"No appointments are linked to your account."}</Empty>}</Panel>; }
function Lessons({data,locale}:{data:StudentPortalData;locale:"tr"|"en"}) { return <Panel title={locale==="tr"?"Derslerim":"Lessons"}>{data.lessons.length?<div className="grid gap-3 sm:grid-cols-2">{data.lessons.map(l=><article key={l.id} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-3"><h3 className="font-semibold text-ink">{l.title}</h3><span className="text-xs text-muted-foreground">{status(l.status,locale)}</span></div><p className="mt-2 text-sm text-muted-foreground">{l.subject}{l.exam_code?` · ${l.exam_code.toUpperCase()}`:""}</p><p className="mt-2 text-xs text-muted-foreground">{fmt(l.lesson_date,locale,true)} · {l.duration_minutes} {locale==="tr"?"dk":"min"}</p>{l.teacher_note&&<p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-ink/75">{l.teacher_note}</p>}</article>)}</div>:<Empty>{locale==="tr"?"Henüz ders kaydı bulunmuyor.":"No lesson records yet."}</Empty>}</Panel>; }
function Homework({data,locale,onReload}:{data:StudentPortalData;locale:"tr"|"en";onReload:()=>void}) { return <Panel title={locale==="tr"?"Ödevlerim":"Homework"}>{data.homework.length?<div className="space-y-4">{data.homework.map(h=><HomeworkCard key={h.id} item={h} locale={locale} onReload={onReload} />)}</div>:<Empty>{locale==="tr"?"Aktif veya geçmiş ödev bulunmuyor.":"No current or previous homework."}</Empty>}</Panel>; }
function HomeworkCard({item,locale,onReload}:{item:StudentHomeworkRow;locale:"tr"|"en";onReload:()=>void}) { const [text,setText]=useState(item.submission_text||"");const [saving,setSaving]=useState(false);const [message,setMessage]=useState("");async function submit(){if(!text.trim())return;setSaving(true);const {error}=await submitStudentHomework(item.id,text.trim());setSaving(false);setMessage(error?(locale==="tr"?"Gönderilemedi.":"Could not submit."):(locale==="tr"?"Ödev gönderildi.":"Homework submitted."));if(!error)onReload();} return <article className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-ink">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{locale==="tr"?"Teslim":"Due"}: {fmt(item.due_date,locale,true)}</p></div><span className="rounded-full border border-border px-2 py-1 text-xs">{status(item.status,locale)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/75">{item.description}</p>{item.teacher_feedback&&<div className="mt-3 rounded-lg bg-surface-muted p-3 text-xs leading-5"><strong>{locale==="tr"?"Öğretmen geri bildirimi":"Teacher feedback"}:</strong> {item.teacher_feedback}</div>}<label className="mt-4 block text-xs font-semibold">{locale==="tr"?"Yanıtınız":"Your response"}<textarea value={text} onChange={(e)=>setText(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-input p-3 text-sm" /></label><button disabled={saving||!text.trim()} onClick={submit} className="mt-3 min-h-10 rounded-lg bg-ink px-4 text-xs font-semibold text-white disabled:opacity-40">{locale==="tr"?"Yanıtı Gönder":"Submit Response"}</button>{message&&<p role="status" className="mt-2 text-xs text-primary">{message}</p>}</article>; }
function PackageView({data,locale}:{data:StudentPortalData;locale:"tr"|"en"}) {
  const p = data.purchases.find((x) => x.status === "active") || data.purchases[0];
  if (!p) {
    return (
      <Panel title={locale === "tr" ? "Paketim" : "My Package"}>
        <Empty>{locale === "tr" ? "Hesabınıza tanımlı aktif bir eğitim paketi bulunmuyor." : "No active package is assigned to your account."}</Empty>
        <div className="mt-5">
          <Link
            href={localizedPath("pricing", locale)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-forest"
          >
            {locale === "tr" ? "Eğitim Paketi Satın Al" : "Purchase Education Package"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Panel>
    );
  }

  const remaining = Math.max(0, p.lesson_count - p.lessons_used);
  const complete = p.status === "completed" || remaining === 0;
  const isExpiringSoon = !complete && remaining <= 3;
  const fee = p.price_amount === null ? "—" : new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: p.currency }).format(p.price_amount);

  return (
    <Panel title={locale === "tr" ? "Paketim" : "My Package"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-heading text-3xl text-ink">
          {(locale === "tr" ? p.pricing_packages?.name_tr : p.pricing_packages?.name_en) || p.package_id}
        </h3>
        {complete && (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            {locale === "tr" ? "Paket Tamamlandı" : "Package Complete"}
          </span>
        )}
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, p.lesson_count ? (p.lessons_used / p.lesson_count) * 100 : 0)}%` }}
        />
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label={locale === "tr" ? "Paket / Kurs Türü" : "Package / Course Type"} value={(locale === "tr" ? p.pricing_packages?.name_tr : p.pricing_packages?.name_en) || p.package_id} />
        <Metric label={locale === "tr" ? "Toplam Ders" : "Total Lessons"} value={p.lesson_count} />
        <Metric label={locale === "tr" ? "Tamamlanan" : "Completed"} value={p.lessons_used} />
        <Metric label={locale === "tr" ? "Kalan" : "Remaining"} value={remaining} />
        <Metric label={locale === "tr" ? "Dönem" : "Course Period"} value={`${fmt(p.start_date, locale)} — ${fmt(p.end_date, locale)}`} />
        <Metric label={locale === "tr" ? "Ücret" : "Fee"} value={fee} />
      </dl>

      {(complete || isExpiringSoon) && (
        <div className="mt-6">
          <Link
            href={localizedPath("pricing", locale)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-forest"
          >
            {complete
              ? locale === "tr"
                ? "Paketi Yenile / Yeni Paket Satın Al"
                : "Renew / Purchase New Package"
              : locale === "tr"
                ? "Paketi Yenile"
                : "Renew Package"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </Panel>
  );
}

function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl border border-border bg-surface-muted p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold text-ink">{value}</dd></div>;}

function Payments({data,locale}:{data:StudentPortalData;locale:"tr"|"en"}) {
  const [copied,setCopied]=useState(false);
  return (
    <div className="space-y-5">
      <Panel title={locale === "tr" ? "Ödemelerim" : "My Payments"}>
        {data.payments.length ? (
          <div className="grid gap-3">
            {data.payments.map((p) => {
              const meta = (p.metadata ?? {}) as Record<string, unknown>;
              const discount = Number(meta.discount_amount ?? 0);
              const couponCode = meta.coupon_code ? String(meta.coupon_code) : null;
              return (
                <article key={p.id} className="grid gap-2 rounded-2xl border border-border p-4 sm:grid-cols-[1fr_auto_auto]">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">{p.package_id}</p>
                      {couponCode && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                          {couponCode} (-{new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: p.currency }).format(discount)})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{fmt(p.created_at, locale)} · Ref: <span className="font-mono">{p.public_reference}</span></p>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    {new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: p.currency }).format(p.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.payment_method === "bank_transfer"
                      ? locale === "tr" ? "Havale / EFT" : "Bank Transfer"
                      : locale === "tr" ? "Kart" : "Card"}{" "}
                    · <span className="font-semibold text-ink">{status(p.status, locale)}</span>
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <div>
            <Empty>{locale === "tr" ? "Henüz bir ödeme kaydınız bulunmuyor." : "No payment history found."}</Empty>
            <div className="mt-4">
              <Link
                href={localizedPath("pricing", locale)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest"
              >
                {locale === "tr" ? "Eğitim Paketlerini İncele" : "View Education Packages"}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
      </Panel>

      {data.bankDetails && (
        <Panel title={locale === "tr" ? "Banka Havalesi / EFT Bilgileri" : "Bank Transfer Details"}>
          <dl className="grid gap-3 text-sm">
            <Metric label={locale === "tr" ? "Hesap Sahibi" : "Account Holder"} value={data.bankDetails.accountHolder} />
            <Metric label={locale === "tr" ? "Banka" : "Bank"} value={data.bankDetails.bankName} />
            <Metric label="IBAN" value={data.bankDetails.iban} />
          </dl>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(data.bankDetails!.iban);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-surface-muted"
          >
            <Copy className="size-4" />
            {locale === "tr" ? "IBAN'ı Kopyala" : "Copy IBAN"}
          </button>
          {copied && (
            <span role="status" className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="size-4" />
              {locale === "tr" ? "IBAN kopyalandı." : "IBAN copied."}
            </span>
          )}
        </Panel>
      )}
    </div>
  );
}
