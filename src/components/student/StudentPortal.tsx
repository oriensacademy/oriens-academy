"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronLeft, ClipboardList, Clock, Copy, CreditCard, ExternalLink, LayoutDashboard, Lock, LogOut, MessageCircle, Package, Plus, RefreshCw, Save, Send, UserRound, Video, Award } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getStudentCopy } from "@/content/student-portal";
import { localizedPath } from "@/lib/routes";
import { updateStudentEmail, updateStudentPassword } from "@/lib/student/auth";
import { useAccount } from "@/lib/auth/account-context";
import { loginPathWithReturn } from "@/lib/auth/account-routing";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { getStudentPortalData, updateStudentProfile, type StudentPortalData } from "@/lib/student/data";
import { SUPPORTED_EXAMS, SUPPORTED_DESTINATIONS, saveStudentPreferences } from "@/lib/student/preferences";
import { InteractiveHomework } from "@/components/student/InteractiveHomework";
import { listStudentThreads, createSupportThread, listThreadMessages, sendStudentMessage, markThreadReadByStudent, subscribeToThreadMessages, subscribeToStudentThreads } from "@/lib/support/client";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS_LABELS, type SupportCategory, type SupportMessage, type SupportThread } from "@/lib/support/types";
import { listStudentExamAttempts, claimAnonymousExamResult, type StudentExamAttempt } from "@/lib/student/exam-history";
import { ExamQuestionReview } from "@/components/exam-test/ExamQuestionReview";
import { cn } from "@/lib/utils";

const sectionIds = ["overview", "profile", "appointments", "lessons", "homework", "package", "payments", "exam_history", "support"] as const;
type SectionId = typeof sectionIds[number];
const icons = [LayoutDashboard, UserRound, CalendarDays, BookOpen, ClipboardList, Package, CreditCard, Award, MessageCircle];

export function StudentPortal() {
  const locale = useLocale(); const copy = getStudentCopy(locale); const router = useRouter();
  const { accountType, user, isInitializing, signOut } = useAccount();
  const [section, setSection] = useState<SectionId>("overview"); const [data, setData] = useState<StudentPortalData | null>(null);
  const userId = user?.id || ""; const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const navigatedRef = useRef(false);
  const loadedUserRef = useRef("");
  const load = useCallback(async (id: string) => { setLoading(true); const result = await getStudentPortalData(id); setLoading(false); if (result.error || !result.data?.profile.active) { setError(result.error || "INACTIVE_PROFILE"); return; } setData(result.data); }, []);

  // Claim pending exam result if token exists in sessionStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const claimToken = sessionStorage.getItem("oriens.pendingExamClaimToken");
        if (claimToken) {
          claimAnonymousExamResult(claimToken).then((res) => {
            if (res.success) {
              sessionStorage.removeItem("oriens.pendingExamClaimToken");
              sessionStorage.removeItem("oriens.pendingSignupEmail");
            }
          });
        }
      }
    } catch {
      // safe fallback
    }
  }, []);

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
      <main className="min-w-0">{section === "overview" && <Overview data={data} locale={locale} onNavigate={setSection} />}{section === "profile" && <Profile key={data.profile.updated_at || data.profile.id} data={data} userId={userId} locale={locale} onReload={() => load(userId)} />}{section === "appointments" && <Appointments data={data} locale={locale} />}{section === "lessons" && <Lessons data={data} locale={locale} />}{section === "homework" && <Homework data={data} locale={locale} onReload={() => load(userId)} />}{section === "package" && <PackageView data={data} locale={locale} />}{section === "payments" && <Payments data={data} locale={locale} />}{section === "exam_history" && <ExamHistoryView userId={userId} locale={locale} />}{section === "support" && <SupportSection userId={userId} locale={locale} />}</main>
    </div>
  </div></div><nav aria-label={locale === "tr" ? "Mobil hesap bölümleri" : "Mobile account sections"} className="fixed inset-x-0 bottom-0 z-40 w-full max-w-full overflow-x-auto overscroll-x-contain border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden"><div className="flex w-max min-w-full justify-start gap-1">{sectionIds.map((id, index) => { const Icon = icons[index]; return <button key={id} onClick={() => setSection(id)} className={cn("flex min-h-14 min-w-[4.4rem] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px]", section === id ? "bg-sage-soft font-semibold text-ink" : "text-muted-foreground")}><Icon className="size-4" />{copy.tabs[index]}</button>; })}</div></nav></section>;
}

function Panel({ title, children }: { title: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7"><div className="font-heading text-2xl text-ink">{title}</div><div className="mt-5">{children}</div></section>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">{children}</p>; }
function fmt(value: string | null, locale: "tr" | "en", withTime = false) { if (!value) return "—"; return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", ...(withTime ? { timeStyle: "short" as const } : {}) }).format(new Date(value)); }
function status(value: string, locale: "tr" | "en") {
  const tr: Record<string, string> = {
    pending: "Bekliyor",
    confirmed: "Onaylandı",
    cancelled: "İptal",
    completed: "Tamamlandı",
    no_show: "Katılmadı",
    scheduled: "Planlandı",
    assigned: "Atandı",
    submitted: "Gönderildi",
    reviewed: "İncelendi",
    late: "Gecikti",
    paid: "Ödendi",
    failed: "Başarısız",
    processing: "İşleniyor",
    requires_action: "Doğrulama Gerekli",
    refunded: "İade Edildi",
    waived: "Ücret Muafiyeti / Ücretsiz",
    bank_transfer_pending: "Havale Onayı Bekliyor",
  };
  const en: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    completed: "Completed",
    no_show: "No show",
    scheduled: "Scheduled",
    assigned: "Assigned",
    submitted: "Submitted",
    reviewed: "Reviewed",
    late: "Late",
    paid: "Paid",
    failed: "Failed",
    processing: "Processing",
    requires_action: "Verification required",
    refunded: "Refunded",
    waived: "Fee Waived / Free",
    bank_transfer_pending: "Bank Transfer Pending",
  };
  return (locale === "tr" ? tr : en)[value] || value;
}

function Overview({ data, locale, onNavigate }: { data: StudentPortalData; locale: "tr"|"en"; onNavigate: (id: SectionId) => void }) {
  const purchase = data.purchases.find((p) => p.status === "active") || data.purchases[0];
  
  const nextBooking = useMemo(() => {
    return data.bookings
      .filter((b) => b.availability_slots && new Date(b.availability_slots.starts_at) > new Date() && !["cancelled","completed"].includes(b.status))
      .sort((a,b) => (a.availability_slots?.starts_at || "").localeCompare(b.availability_slots?.starts_at || ""))[0];
  }, [data.bookings]);

  const nextLesson = useMemo(() => {
    return data.lessons
      .filter((l) => l.status === "scheduled")
      .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date))[0];
  }, [data.lessons]);

  const activeHomework = data.homework.filter((h) => ["assigned", "in_progress", "overdue", "submitted"].includes(h.status));
  const payment = data.payments[0];

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Current Package Banner */}
      <button onClick={() => onNavigate("package")} className="rounded-2xl border border-border bg-forest p-6 text-left text-white sm:col-span-2 cursor-pointer hover:border-border-strong">
        <p className="text-xs uppercase tracking-wider text-white/65">{locale === "tr" ? "Mevcut Paket" : "Current Package"}</p>
        <h2 className="mt-2 font-heading text-3xl">
          {purchase
            ? purchase.custom_package_name || (locale === "tr" ? purchase.pricing_packages?.name_tr : purchase.pricing_packages?.name_en) || purchase.package_id
            : "—"}
        </h2>
        {purchase && (
          <>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-warm-accent" style={{ width: `${Math.min(100, purchase.lesson_count ? purchase.lessons_used / purchase.lesson_count * 100 : 0)}%` }} />
            </div>
            <p className="mt-2 text-sm text-white/75">
              {locale === "tr" ? "Tamamlanan Ders" : "Completed Lessons"}: {purchase.lessons_used} / {purchase.lesson_count} · {locale === "tr" ? "Kalan" : "Remaining"}: {Math.max(0, purchase.lesson_count - purchase.lessons_used)}
            </p>
          </>
        )}
      </button>

      {/* Upcoming Live Lesson Banner if available */}
      {nextLesson && (
        <div className="rounded-2xl border border-primary/30 bg-surface p-5 sm:col-span-2 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
              <Video className="size-3.5 text-primary" />
              {locale === "tr" ? "Yaklaşan Canlı Ders" : "Upcoming Live Lesson"}
            </span>
            <h3 className="mt-2 font-heading text-xl text-ink">{nextLesson.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {nextLesson.subject} · {fmt(nextLesson.lesson_date, locale, true)} ({nextLesson.duration_minutes} {locale === "tr" ? "dk" : "min"})
            </p>
          </div>
          {nextLesson.live_meeting_url ? (
            <a
              href={nextLesson.live_meeting_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-xs font-bold text-white hover:bg-forest transition-colors shadow-xs"
            >
              <Video className="size-4 text-warm-accent" />
              {locale === "tr" ? "Derse Katıl" : "Join Lesson"}
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      )}

      {/* Upcoming Booking / Consultation if any */}
      {nextBooking && !nextLesson && (
        <div className="rounded-2xl border border-primary/30 bg-surface p-5 sm:col-span-2 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-0.5 text-[11px] font-bold text-ink">
              <CalendarDays className="size-3.5 text-primary" />
              {locale === "tr" ? "Yaklaşan Randevu" : "Upcoming Appointment"}
            </span>
            <h3 className="mt-2 font-heading text-xl text-ink">{nextBooking.appointment_subject || nextBooking.exam_code || nextBooking.custom_exam || "Randevu"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {fmt(nextBooking.availability_slots?.starts_at || nextBooking.created_at, locale, true)}
            </p>
          </div>
          {nextBooking.live_meeting_url && (
            <a
              href={nextBooking.live_meeting_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-xs font-bold text-white hover:bg-forest transition-colors shadow-xs"
            >
              <Video className="size-4 text-warm-accent" />
              {locale === "tr" ? "Görüşmeye Katıl" : "Join Meeting"}
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{locale === "tr" ? "Son Ödeme" : "Latest Payment"}</h3>
        <p className="mt-2 text-2xl font-bold text-ink">
          {payment ? new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: payment.currency }).format(payment.amount) : "—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {payment ? `${fmt(payment.created_at, locale)} · ${status(payment.status, locale)}` : (locale === "tr" ? "Kayıt yok" : "No record")}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{locale === "tr" ? "Aktif Ödevler" : "Active Homework"}</h3>
        <p className="mt-2 text-2xl font-bold text-ink">{activeHomework.length}</p>
        <p className="mt-1 text-xs text-muted-foreground">{locale === "tr" ? "Teslim bekleyen veya incelenen" : "Pending or submitted"}</p>
      </div>
    </div>
  );
}

function Profile({ data, userId, locale, onReload }: { data: StudentPortalData; userId: string; locale: "tr" | "en"; onReload: () => void }) {
  const [form, setForm] = useState({
    school: data.profile.school || "",
    targetUniversity: data.profile.target_university || "",
  });
  const [selectedExams, setSelectedExams] = useState<string[]>(() => {
    const raw = (data.profile as unknown as Record<string, unknown>).target_exams;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return data.profile.target_exam ? [data.profile.target_exam] : [];
  });
  const [selectedCountries, setSelectedCountries] = useState<string[]>(() => {
    const raw = (data.profile as unknown as Record<string, unknown>).target_countries;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return data.profile.target_country ? [data.profile.target_country] : [];
  });

  const [busy, setBusy] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: data.profile.email });
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");

    try {
      const { error: profileError } = await updateStudentProfile(userId, {
        school: form.school.trim() || null,
        target_university: form.targetUniversity.trim() || null,
        target_exams: selectedExams,
        target_countries: selectedCountries,
        target_exam: selectedExams[0] || null,
        target_country: selectedCountries[0] || null,
      });

      if (profileError) {
        setBusy(false);
        setErr(profileError.message);
        return;
      }

      await saveStudentPreferences(userId, selectedExams, selectedCountries, true);
      setBusy(false);
      setMsg(locale === "tr" ? "Akademik profiliniz başarıyla güncellendi." : "Academic profile updated successfully.");
      onReload();
    } catch (error) {
      setBusy(false);
      setErr(error instanceof Error ? error.message : (locale === "tr" ? "Bir hata oluştu." : "An error occurred."));
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setMsg("");
    setErr("");
    const r = await updateStudentEmail(emailForm.email.trim());
    setEmailBusy(false);
    if (r.error) setErr(r.error.message);
    else setMsg(locale === "tr" ? "Doğrulama bağlantısı e-posta adresinize gönderildi." : "Confirmation email sent.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setMsg("");
    setErr("");
    const r = await updateStudentPassword(passwordForm.password);
    setPasswordBusy(false);
    if (r.error) setErr(r.error.message);
    else {
      setPasswordForm({ password: "" });
      setMsg(locale === "tr" ? "Şifre güncellendi." : "Password updated.");
    }
  }

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">{msg}</p>}
      {err && <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-semibold text-red-800">{err}</p>}

      {/* 1. KİŞİSEL BİLGİLER (READ ONLY) */}
      <Panel title={locale === "tr" ? "Kişisel Bilgiler" : "Personal Information"}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "tr" ? "Ad Soyad" : "Full Name"}
              </span>
              <p className="mt-1 text-sm font-semibold text-ink">{data.profile.full_name}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "tr" ? "E-posta Adresi" : "Email Address"}
              </span>
              <p className="mt-1 text-sm font-semibold text-ink truncate">{data.profile.email}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "tr" ? "Telefon Numarası" : "Phone Number"}
              </span>
              <p className="mt-1 text-sm font-semibold text-ink">
                {data.profile.phone || (locale === "tr" ? "Belirtilmemiş" : "Not specified")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0 text-muted-foreground" />
            <span>
              {locale === "tr"
                ? "Kişisel kimlik bilgileri hesap güvenliği nedeniyle yalnızca yönetici tarafından güncellenebilir."
                : "Personal identity information can only be updated by an administrator for security purposes."}
            </span>
          </div>
        </div>
      </Panel>

      {/* 2. AKADEMİK HEDEFLER & PROFİL (STUDENT EDITABLE) */}
      <Panel title={locale === "tr" ? "Akademik Hedefler & Tercihler" : "Academic Goals & Preferences"}>
        <form onSubmit={saveProfile} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              {locale === "tr" ? "Mevcut Okul / Lise" : "Current School / Institution"}
              <input
                type="text"
                placeholder={locale === "tr" ? "Örn: Robert Kolej, Galatasaray Lisesi..." : "e.g. High School..."}
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
                className="mt-1 min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {locale === "tr" ? "Hedef Üniversite / Bölüm" : "Target University / Major"}
              <input
                type="text"
                placeholder={locale === "tr" ? "Örn: Oxford University, MIT, Bocconi..." : "e.g. Oxford University, MIT..."}
                value={form.targetUniversity}
                onChange={(e) => setForm({ ...form, targetUniversity: e.target.value })}
                className="mt-1 min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
          </div>

          {/* MULTI-SELECT CHIPS FOR EXAMS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink">
                {locale === "tr" ? "Hedef Sınavlar ve Yeterlilikler" : "Target Exams & Qualifications"}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {selectedExams.length} {locale === "tr" ? "seçildi" : "selected"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_EXAMS.map((exam) => {
                const isSelected = selectedExams.includes(exam.id);
                return (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => toggleExam(exam.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary text-white shadow-xs"
                        : "border-border bg-surface text-ink hover:border-primary/50 hover:bg-surface-muted"
                    )}
                  >
                    {isSelected && <Check className="size-3.5 shrink-0" />}
                    <span>{locale === "tr" ? exam.name_tr : exam.name_en}</span>
                    {exam.badge && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                          isSelected ? "bg-white/20 text-white" : "bg-surface-muted text-muted-foreground"
                        )}
                      >
                        {exam.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MULTI-SELECT CHIPS FOR DESTINATIONS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink">
                {locale === "tr" ? "Hedef Ülkeler / Bölgeler" : "Target Countries & Destinations"}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {selectedCountries.length} {locale === "tr" ? "seçildi" : "selected"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_DESTINATIONS.map((dest) => {
                const isSelected = selectedCountries.includes(dest.id);
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => toggleCountry(dest.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary text-white shadow-xs"
                        : "border-border bg-surface text-ink hover:border-primary/50 hover:bg-surface-muted"
                    )}
                  >
                    {isSelected && <Check className="size-3.5 shrink-0" />}
                    <span>{locale === "tr" ? dest.name_tr : dest.name_en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-6 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="size-4" />
              {busy ? (locale === "tr" ? "Kaydediliyor…" : "Saving…") : (locale === "tr" ? "Profili Güncelle" : "Update Profile")}
            </button>
          </div>
        </form>
      </Panel>

      {/* 3. HESAP GÜVENLİĞİ (SAME PAGE) */}
      <Panel title={locale === "tr" ? "Hesap Güvenliği" : "Account Security"}>
        <div className="grid min-w-0 gap-5 md:grid-cols-2 md:items-stretch">
          <form onSubmit={saveEmail} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface/50 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-ink">{locale === "tr" ? "E-posta Değiştir" : "Change Email"}</h3>
            <p className="text-xs leading-5 text-muted-foreground md:min-h-10">
              {locale === "tr"
                ? "E-posta adresinizi değiştirdiğinizde yeni adrese onay bağlantısı gönderilecektir."
                : "A verification link will be sent to the new email address."}
            </p>
            <input
              required
              type="email"
              value={emailForm.email}
              onChange={(e) => setEmailForm({ email: e.target.value })}
              className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              disabled={emailBusy}
              className="mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50 cursor-pointer sm:w-auto sm:self-start"
            >
              {emailBusy ? (locale === "tr" ? "Gönderiliyor…" : "Sending…") : (locale === "tr" ? "E-posta Güncelle" : "Update Email")}
            </button>
          </form>

          <form onSubmit={savePassword} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface/50 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-ink">{locale === "tr" ? "Şifre Belirle" : "Update Password"}</h3>
            <p className="text-xs leading-5 text-muted-foreground md:min-h-10">
              {locale === "tr"
                ? "Hesabınız için güçlü ve benzersiz bir şifre belirleyin."
                : "Choose a strong and unique password for your account."}
            </p>
            <input
              required
              minLength={8}
              type="password"
              placeholder={locale === "tr" ? "En az 8 karakter" : "Minimum 8 characters"}
              value={passwordForm.password}
              onChange={(e) => setPasswordForm({ password: e.target.value })}
              className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              disabled={passwordBusy}
              className="mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50 cursor-pointer sm:w-auto sm:self-start"
            >
              {passwordBusy ? (locale === "tr" ? "Güncelleniyor…" : "Updating…") : (locale === "tr" ? "Şifreyi Değiştir" : "Update Password")}
            </button>
          </form>
        </div>
      </Panel>
    </div>
  );
}

function Appointments({ data, locale }: { data: StudentPortalData; locale: "tr" | "en" }) {
  const upcoming = data.bookings.filter((b) => !["completed", "cancelled"].includes(b.status));
  const past = data.bookings.filter((b) => ["completed", "cancelled"].includes(b.status));

  return (
    <div className="space-y-6">
      <Panel title={locale === "tr" ? "Yaklaşan Randevular" : "Upcoming Appointments"}>
        {upcoming.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((b) => (
              <article key={b.id} className="rounded-xl border border-border p-4 bg-surface flex flex-col justify-between">
                <div>
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold text-ink">{b.appointment_subject || b.exam_code || b.custom_exam || "Randevu"}</h3>
                    <span className="text-xs text-muted-foreground">{status(b.status, locale)}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {fmt(b.availability_slots?.starts_at || b.created_at, locale, true)}
                  </p>
                </div>
                {b.live_meeting_url && (
                  <div className="mt-4 pt-3 border-t border-primary/10">
                    <a
                      href={b.live_meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-forest transition-colors shadow-xs"
                    >
                      <Video className="size-4 text-warm-accent" />
                      {locale === "tr" ? "Görüşmeye Katıl" : "Join Meeting"}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty>{locale === "tr" ? "Yaklaşan randevunuz bulunmuyor." : "No upcoming appointments."}</Empty>
        )}
      </Panel>

      <Panel title={locale === "tr" ? "Geçmiş Randevular" : "Past Appointments"}>
        {past.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {past.map((b) => (
              <article key={b.id} className="rounded-xl border border-border p-4 bg-surface">
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold text-ink">{b.appointment_subject || b.exam_code || b.custom_exam || "Randevu"}</h3>
                  <span className="text-xs text-muted-foreground">{status(b.status, locale)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fmt(b.availability_slots?.starts_at || b.created_at, locale, true)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <Empty>{locale === "tr" ? "Geçmiş randevu kaydı bulunmuyor." : "No past appointments."}</Empty>
        )}
      </Panel>
    </div>
  );
}

function Lessons({ data, locale }: { data: StudentPortalData; locale: "tr" | "en" }) {
  const upcoming = data.lessons.filter((l) => l.status === "scheduled");
  const history = data.lessons.filter((l) => l.status !== "scheduled");

  return (
    <div className="space-y-6">
      {/* 1. Upcoming Live Lessons */}
      <Panel title={locale === "tr" ? "Yaklaşan Canlı Dersler" : "Upcoming Live Lessons"}>
        {upcoming.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((l) => (
              <article key={l.id} className="rounded-2xl border border-primary/30 p-5 bg-surface shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-semibold text-ink text-base">{l.title}</h3>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                      {status(l.status, locale)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-primary font-medium">
                    {l.subject}
                    {l.exam_code ? ` · ${l.exam_code.toUpperCase()}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmt(l.lesson_date, locale, true)} · {l.duration_minutes} {locale === "tr" ? "dk" : "min"}
                  </p>
                  {l.teacher_note && (
                    <p className="mt-3 rounded bg-surface-muted p-2.5 text-xs text-ink/80 border border-border">
                      <strong>{locale === "tr" ? "Eğitmen Notu" : "Teacher Note"}:</strong> {l.teacher_note}
                    </p>
                  )}
                </div>

                {l.live_meeting_url && (
                  <div className="mt-4 pt-3 border-t border-primary/10">
                    <a
                      href={l.live_meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-forest transition-colors shadow-xs"
                    >
                      <Video className="size-4 text-warm-accent" />
                      {locale === "tr" ? "Canlı Derse Katıl" : "Join Live Lesson"}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            {locale === "tr"
              ? "Şu anda planlanmış aktif bir canlı dersiniz bulunmuyor."
              : "No upcoming live lessons scheduled at this moment."}
          </Empty>
        )}
      </Panel>

      {/* 2. Completed Lesson History */}
      <Panel title={locale === "tr" ? "Tamamlanan Ders Geçmişi" : "Lesson History"}>
        {history.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {history.map((l) => (
              <article key={l.id} className="rounded-xl border border-border p-4 bg-surface">
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold text-ink">{l.title}</h3>
                  <span className="text-xs text-muted-foreground">{status(l.status, locale)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {l.subject}
                  {l.exam_code ? ` · ${l.exam_code.toUpperCase()}` : ""}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fmt(l.lesson_date, locale, true)} · {l.duration_minutes} {locale === "tr" ? "dk" : "min"}
                </p>
                {l.teacher_note && (
                  <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-ink/75">{l.teacher_note}</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty>{locale === "tr" ? "Henüz tamamlanmış ders kaydı yok." : "No completed lesson records yet."}</Empty>
        )}
      </Panel>
    </div>
  );
}
function Homework({
  data,
  locale,
  onReload,
}: {
  data: StudentPortalData;
  locale: "tr" | "en";
  onReload: () => void;
}) {
  return <InteractiveHomework items={data.homework} lessons={data.lessons} userId={data.profile.id} locale={locale} onReload={onReload} />;
}

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

  const pkgAdjustments = (data.adjustments || []).filter((a) => a.package_purchase_id === p.id);
  const extraLessonsSum = pkgAdjustments
    .filter((a) => a.adjustment_type === "extra_lessons")
    .reduce((sum, a) => sum + (a.lesson_delta || 0), 0);
  const baseLessonCount = Math.max(0, p.lesson_count - extraLessonsSum);
  const remaining = Math.max(0, p.lesson_count - p.lessons_used);
  const complete = p.status === "completed" || remaining === 0;
  const isExpiringSoon = !complete && remaining <= 3;
  const fee = p.price_amount === null ? "—" : new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: p.currency }).format(p.price_amount);

  return (
    <Panel title={locale === "tr" ? "Paketim" : "My Package"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-3xl text-ink">
            {p.custom_package_name || (locale === "tr" ? p.pricing_packages?.name_tr : p.pricing_packages?.name_en) || p.package_id}
          </h3>
          {extraLessonsSum > 0 && (
            <p className="mt-1 text-xs text-primary font-semibold">
              {locale === "tr"
                ? `Temel ${baseLessonCount} Ders + Ekstra ${extraLessonsSum} Ders = Toplam ${p.lesson_count} Ders`
                : `Base ${baseLessonCount} Lessons + Extra ${extraLessonsSum} Lessons = Total ${p.lesson_count} Lessons`}
            </p>
          )}
        </div>
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
        <Metric label={locale === "tr" ? "Paket / Kurs Türü" : "Package / Course Type"} value={p.custom_package_name || (locale === "tr" ? p.pricing_packages?.name_tr : p.pricing_packages?.name_en) || p.package_id} />
        <Metric
          label={locale === "tr" ? "Toplam Ders" : "Total Lessons"}
          value={
            extraLessonsSum > 0
              ? `${p.lesson_count} (${locale === "tr" ? `Temel ${baseLessonCount} + Ek ${extraLessonsSum}` : `Base ${baseLessonCount} + Extra ${extraLessonsSum}`})`
              : p.lesson_count
          }
        />
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

function SupportSection({ userId, locale }: { userId: string; locale: "tr" | "en" }) {
  const isTr = locale === "tr";
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Form states
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState<SupportCategory>("general");
  const [newInitialMsg, setNewInitialMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Composer
  const [composerText, setComposerText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;

  // Load threads
  const loadThreads = useCallback(async () => {
    if (!userId) return;
    const res = await listStudentThreads(userId);
    if (res.data) setThreads(res.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    listStudentThreads(userId).then((res) => {
      if (!ignore) {
        if (res.data) setThreads(res.data);
        setLoading(false);
      }
    });
    const unsub = subscribeToStudentThreads(userId, () => {
      listStudentThreads(userId).then((res) => {
        if (!ignore && res.data) setThreads(res.data);
      });
    });
    return () => {
      ignore = true;
      unsub();
    };
  }, [userId]);

  // Load messages when activeThreadId changes
  useEffect(() => {
    if (!activeThreadId) return;
    let ignore = false;
    markThreadReadByStudent(activeThreadId);

    listThreadMessages(activeThreadId).then((res) => {
      if (!ignore) {
        if (res.data) setMessages(res.data);
        setLoadingMessages(false);
      }
    });

    const unsub = subscribeToThreadMessages(activeThreadId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      markThreadReadByStudent(activeThreadId);
    });

    return () => {
      ignore = true;
      unsub();
    };
  }, [activeThreadId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (activeThreadId && messages.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeThreadId]);

  // Handle new thread creation
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newInitialMsg.trim()) {
      setFormError(isTr ? "Lütfen konu ve mesaj alanlarını doldurun." : "Please fill in subject and message.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    const res = await createSupportThread({
      student_user_id: userId,
      subject: newSubject.trim(),
      category: newCategory,
      initial_message: newInitialMsg.trim(),
      locale: locale as "tr" | "en",
    });
    setIsSubmitting(false);

    if (res.error || !res.data) {
      setFormError(res.error || (isTr ? "Talep oluşturulamadı." : "Could not create request."));
      return;
    }

    setNewSubject("");
    setNewInitialMsg("");
    setIsCreating(false);
    await loadThreads();
    setActiveThreadId(res.data.thread.id);
  };

  // Handle sending reply
  const handleSendMessage = async () => {
    if (!activeThreadId || !composerText.trim() || isSending) return;
    const text = composerText.trim();
    setComposerText("");
    setIsSending(true);

    const res = await sendStudentMessage(activeThreadId, userId, text);
    setIsSending(false);

    if (res.data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data!.id)) return prev;
        return [...prev, res.data!];
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. If viewing a specific thread conversation */}
      {activeThread ? (
        <Panel
          title={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveThreadId(null)}
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-surface-muted text-ink hover:bg-surface transition-colors"
                  aria-label={isTr ? "Geri" : "Back"}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-sage-soft px-2 py-0.5 text-[11px] font-bold text-ink">
                      {SUPPORT_CATEGORIES.find((c) => c.id === activeThread.category)?.[isTr ? "labelTr" : "labelEn"] || activeThread.category}
                    </span>
                    <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {SUPPORT_STATUS_LABELS[activeThread.status]?.[locale] || activeThread.status}
                    </span>
                  </div>
                  <h3 className="mt-1 font-heading text-xl text-ink">{activeThread.subject}</h3>
                </div>
              </div>
            </div>
          }
        >
          {/* Chat message stream */}
          <div className="flex flex-col space-y-4 max-h-[480px] min-h-[260px] overflow-y-auto pr-1 py-2">
            {loadingMessages ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {isTr ? "Mesajlar yükleniyor…" : "Loading conversation…"}
              </div>
            ) : messages.length ? (
              messages.map((m) => {
                const isStudent = m.sender_type === "student";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col max-w-[85%] sm:max-w-[75%]",
                      isStudent ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <span className="mb-1 text-[11px] font-medium text-muted-foreground">
                      {isStudent ? (isTr ? "Siz" : "You") : "Oriens Destek"} · {fmt(m.created_at, locale, true)}
                    </span>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-xs",
                        isStudent
                          ? "bg-primary text-primary-foreground rounded-tr-xs"
                          : "bg-surface-muted border border-border text-ink rounded-tl-xs"
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {isTr ? "Henüz mesaj bulunmuyor." : "No messages yet."}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="mt-4 border-t border-border pt-4">
            {activeThread.status === "closed" ? (
              <div className="rounded-xl border border-border bg-surface-muted p-4 text-center text-xs text-muted-foreground">
                {isTr ? "Bu destek talebi kapatılmıştır." : "This support request is closed."}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  placeholder={isTr ? "Mesajınızı yazın… (Göndermek için Enter, yeni satır için Shift+Enter)" : "Write your message… (Enter to send, Shift+Enter for newline)"}
                  className="w-full rounded-xl border border-input bg-surface p-3 text-sm leading-relaxed text-ink placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">
                    {isTr ? "Enter: Gönder · Shift+Enter: Alt satır" : "Enter: Send · Shift+Enter: Newline"}
                  </span>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isSending || !composerText.trim()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-ink px-5 text-xs font-semibold text-white hover:bg-forest disabled:opacity-40 transition-colors shadow-xs"
                  >
                    <Send className="size-3.5" />
                    {isSending ? (isTr ? "Gönderiliyor…" : "Sending…") : (isTr ? "Gönder" : "Send")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      ) : (
        /* 2. Thread List / New Request Panel */
        <Panel
          title={
            <div className="flex items-center justify-between gap-4">
              <span>{isTr ? "Destek Taleplerim" : "My Support Requests"}</span>
              <button
                type="button"
                onClick={() => setIsCreating(!isCreating)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors shadow-xs"
              >
                <Plus className="size-3.5" />
                {isTr ? "Yeni Destek Talebi" : "New Support Request"}
              </button>
            </div>
          }
        >
          {/* New Request Modal/Card if open */}
          {isCreating && (
            <form onSubmit={handleCreateThread} className="mb-6 rounded-2xl border border-primary/30 bg-surface-muted p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-heading text-lg text-ink">
                  {isTr ? "Yeni Destek Talebi Oluştur" : "Create Support Request"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-muted-foreground hover:text-ink"
                >
                  {isTr ? "Vazgeç" : "Cancel"}
                </button>
              </div>

              {formError && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-ink">
                  {isTr ? "Kategori" : "Category"}
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as SupportCategory)}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {SUPPORT_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {isTr ? cat.labelTr : cat.labelEn}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-ink">
                  {isTr ? "Konu" : "Subject"}
                  <input
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder={isTr ? "Destek konusu" : "Inquiry subject"}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-ink">
                {isTr ? "Mesajınız" : "Message"}
                <textarea
                  required
                  rows={4}
                  value={newInitialMsg}
                  onChange={(e) => setNewInitialMsg(e.target.value)}
                  placeholder={isTr ? "Talebinizi ve sormak istediklerinizi detaylıca belirtin…" : "Describe your inquiry in detail…"}
                  className="mt-1.5 w-full rounded-xl border border-input bg-surface p-3 text-sm text-ink focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="min-h-11 rounded-xl border border-border px-4 text-xs font-semibold text-ink hover:bg-surface transition-colors"
                >
                  {isTr ? "İptal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 rounded-xl bg-ink px-6 text-xs font-semibold text-white hover:bg-forest disabled:opacity-40 transition-colors shadow-xs"
                >
                  {isSubmitting ? (isTr ? "Oluşturuluyor…" : "Creating…") : (isTr ? "Talebi Gönder" : "Submit Request")}
                </button>
              </div>
            </form>
          )}

          {/* Ticket list */}
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              {isTr ? "Destek talepleri yükleniyor…" : "Loading support requests…"}
            </div>
          ) : threads.length ? (
            <div className="grid gap-3">
              {threads.map((t) => {
                const categoryObj = SUPPORT_CATEGORIES.find((c) => c.id === t.category);
                const statusObj = SUPPORT_STATUS_LABELS[t.status];
                return (
                  <article
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={cn(
                      "cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-xs",
                      t.unread_for_student
                        ? "border-primary/40 bg-surface-muted"
                        : "border-border bg-surface"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-sage-soft px-2 py-0.5 text-[11px] font-bold text-ink">
                            {categoryObj?.[isTr ? "labelTr" : "labelEn"] || t.category}
                          </span>
                          <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {statusObj?.[locale] || t.status}
                          </span>
                          {t.unread_for_student && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <MessageCircle className="size-3" />
                              {isTr ? "Yeni Yanıt" : "New Reply"}
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 font-heading text-lg text-ink font-semibold">{t.subject}</h4>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          <span>{fmt(t.last_message_at, locale, true)}</span>
                        </div>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          {isTr ? "Görüntüle" : "View"}
                          <ArrowRight className="size-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty>
              {isTr
                ? "Henüz açık veya tamamlanmış bir destek talebiniz bulunmuyor."
                : "You don't have any support requests yet."}
            </Empty>
          )}
        </Panel>
      )}
    </div>
  );
}

function ExamHistoryView({ userId, locale }: { userId: string; locale: "tr" | "en" }) {
  const isTr = locale === "tr";
  const [attempts, setAttempts] = useState<StudentExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAttempt, setSelectedAttempt] = useState<StudentExamAttempt | null>(null);

  useEffect(() => {
    let active = true;
    listStudentExamAttempts(userId).then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        setAttempts(res.data || []);
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // Aggregate metrics
  const totalExams = attempts.length;
  const avgAccuracy = totalExams > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.accuracy || 0), 0) / totalExams)
    : 0;
  const highestAccuracy = totalExams > 0
    ? Math.max(...attempts.map((a) => a.accuracy || 0))
    : 0;
  const latestExam = attempts[0] || null;

  if (loading) {
    return (
      <Panel title={isTr ? "Sınav Geçmişi" : "Exam History"}>
        <div className="space-y-4 animate-pulse">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-surface-muted" />
            ))}
          </div>
          <div className="h-48 rounded-2xl bg-surface-muted" />
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title={isTr ? "Sınav Geçmişi" : "Exam History"}>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error}
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel title={isTr ? "Sınav Geçmişi" : "Exam History"}>
        {totalExams === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="size-16 rounded-full bg-[#EBF0E6] text-primary flex items-center justify-center mx-auto">
              <Award className="size-8" />
            </div>
            <div>
              <h3 className="font-heading text-xl text-ink">
                {isTr ? "Henüz tamamladığınız bir sınav bulunmuyor." : "No completed exams yet."}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                {isTr
                  ? "Kendini Dene modülümüzü kullanarak seviyenizi ölçebilir ve detaylı konu analizinizi hemen görüntüleyebilirsiniz."
                  : "Use our Test Yourself diagnostic to measure your readiness and receive instant topic-level analysis."}
              </p>
            </div>
            <Link
              href={isTr ? "/tr/kendini-dene" : "/en/test-yourself"}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white hover:bg-forest transition-colors"
            >
              <Award className="size-4" />
              {isTr ? "Kendini Dene" : "Test Yourself"}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top 4 Summary Metrics */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={isTr ? "Toplam Çözülen Sınav" : "Total Completed Exams"}
                value={totalExams}
              />
              <Metric
                label={isTr ? "Ortalama Başarı" : "Average Accuracy"}
                value={`%${avgAccuracy}`}
              />
              <Metric
                label={isTr ? "En Yüksek Başarı" : "Highest Accuracy"}
                value={`%${highestAccuracy}`}
              />
              <Metric
                label={isTr ? "Son Sınav" : "Latest Exam"}
                value={latestExam ? `${latestExam.exam_code} (${fmt(latestExam.completed_at, locale)})` : "—"}
              />
            </div>

            {/* Attempt List */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-ink">
                {isTr ? "Tamamlanan Değerlendirmeler" : "Completed Assessments"}
              </h3>

              <div className="divide-y divide-border rounded-2xl border border-border bg-surface overflow-hidden">
                {attempts.map((att) => {
                  const acc = att.accuracy || 0;
                  const isStrong = acc >= 75;
                  const isModerate = acc >= 40 && acc < 75;
                  const tierBadge = isStrong
                    ? (isTr ? "Güçlü" : "Strong")
                    : isModerate
                      ? (isTr ? "Geliştirilebilir" : "Developing")
                      : (isTr ? "Öncelikli Alan" : "Priority Focus");

                  const badgeColor = isStrong
                    ? "bg-emerald-100 text-emerald-800"
                    : isModerate
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800";

                  return (
                    <article
                      key={att.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-[#FAFBF9] transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="size-11 rounded-xl bg-sage-soft text-primary flex items-center justify-center shrink-0 font-extrabold text-xs uppercase tracking-wider">
                          {att.exam_code}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-heading text-base font-bold text-ink">
                              {att.exam_code} {isTr ? "Deneme Sınavı" : "Diagnostic Exam"}
                            </h4>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${badgeColor}`}>
                              {tierBadge}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {fmt(att.completed_at, locale, true)} · {att.correct_count} / {att.total_questions} {isTr ? "Doğru" : "Correct"} (%{acc})
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedAttempt(att)}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer self-end sm:self-auto"
                      >
                        {isTr ? "Detayları Gör" : "View Details"}
                        <ArrowRight className="size-3.5 text-primary" />
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Selected Attempt Detail Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#DDE4DC] bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF0E6] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <Award className="size-3.5" />
                  {selectedAttempt.exam_code} {isTr ? "Sınav Raporu" : "Exam Report"}
                </span>
                <h3 className="mt-2 font-heading text-2xl text-ink">
                  {selectedAttempt.exam_code} · {fmt(selectedAttempt.completed_at, locale, true)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score & Accuracy Overview Cards */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  {isTr ? "Doğru" : "Correct"}
                </span>
                <p className="mt-0.5 text-xl font-extrabold text-emerald-950 sm:text-2xl">
                  {selectedAttempt.correct_count} / {selectedAttempt.total_questions}
                </p>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                  {isTr ? "Yanlış" : "Incorrect"}
                </span>
                <p className="mt-0.5 text-xl font-extrabold text-rose-950 sm:text-2xl">
                  {selectedAttempt.incorrect_count} / {selectedAttempt.total_questions}
                </p>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-[#F4F6F0] p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  {isTr ? "Başarı Oranı" : "Accuracy"}
                </span>
                <p className="mt-0.5 text-xl font-extrabold text-ink sm:text-2xl">
                  %{selectedAttempt.accuracy}
                </p>
              </div>
            </div>

            {/* Topic Breakdown */}
            {selectedAttempt.topic_analysis && selectedAttempt.topic_analysis.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-bold text-ink">
                  {isTr ? "Konu Bazlı Başarı Analizi" : "Topic Mastery Breakdown"}
                </h4>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {selectedAttempt.topic_analysis.map((t) => {
                    const acc = t.accuracy || 0;
                    const isStr = acc >= 75;
                    const isMod = acc >= 50 && acc < 75;
                    return (
                      <div key={t.id || t.label} className="rounded-xl border border-border bg-surface p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink">{t.label}</span>
                          <span className={`font-bold ${isStr ? "text-emerald-700" : isMod ? "text-amber-700" : "text-rose-700"}`}>
                            %{acc} ({t.correct}/{t.total})
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isStr ? "bg-emerald-600" : isMod ? "bg-amber-600" : "bg-rose-600"}`}
                            style={{ width: `${acc}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question Breakdown One-by-One Review */}
            {selectedAttempt.question_snapshots && selectedAttempt.question_snapshots.length > 0 && (
              <div className="mt-6">
                <ExamQuestionReview
                  items={selectedAttempt.question_snapshots.map((q, idx) => ({
                    id: q.id || String(idx),
                    questionNumber: idx + 1,
                    topic: q.topicLabel,
                    prompt: q.prompt,
                    selectedAnswerId: null,
                    correctAnswerId: "",
                    selectedAnswerText: q.selectedAnswer,
                    correctAnswerText: q.correctAnswer,
                    isCorrect: q.wasCorrect,
                    explanation: q.explanation,
                  }))}
                  locale={locale}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
              <Link
                href={isTr ? "/tr/randevu" : "/en/booking"}
                className="flex-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors"
              >
                <CalendarDays className="size-4" />
                {isTr ? "Ücretsiz Ön Görüşme Talep Et" : "Request Free Consultation"}
              </Link>
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="rounded-xl border border-border px-5 py-2.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
              >
                {isTr ? "Kapat" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
