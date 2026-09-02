"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronLeft, Clock, CreditCard, ExternalLink, LayoutDashboard, LogOut, MessageCircle, Package, Plus, Save, Send, UserRound, Video, Award } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getStudentCopy } from "@/content/student-portal";
import { getPaymentRefundCopy } from "@/content/payment-refund";
import { localizedPath } from "@/lib/routes";
import { updateGuardianProfile, updateStudentEmail, updateStudentPassword } from "@/lib/student/auth";
import { useAccount } from "@/lib/auth/account-context";
import { loginPathWithReturn } from "@/lib/auth/account-routing";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { getStudentPortalData, setupLearnerProfile, updateStudentProfile, type StudentPortalData } from "@/lib/student/data";
import { SUPPORTED_EXAMS, SUPPORTED_DESTINATIONS, saveStudentPreferences } from "@/lib/student/preferences";
import { InteractiveHomework } from "@/components/student/InteractiveHomework";
import { listStudentThreads, createSupportThread, listThreadMessages, sendStudentMessage, markThreadReadByStudent, subscribeToThreadMessages, subscribeToStudentThreads } from "@/lib/support/client";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS_LABELS, type SupportCategory, type SupportMessage, type SupportThread } from "@/lib/support/types";
import { listStudentExamAttempts, claimAnonymousExamResult, type StudentExamAttempt } from "@/lib/student/exam-history";
import { ExamQuestionReview } from "@/components/exam-test/ExamQuestionReview";
import { LogoutConfirmationModal } from "@/components/auth/LogoutConfirmationModal";
import { cn } from "@/lib/utils";
import { VISIBLE_STUDENT_NAVIGATION, type StudentSectionId } from "@/lib/student/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

type SectionId = StudentSectionId;
const icons = [LayoutDashboard, UserRound, BookOpen, Package, CreditCard, MessageCircle];
const visibleNavigation = VISIBLE_STUDENT_NAVIGATION.map((item) => ({ ...item, Icon: icons[item.labelIndex] }));

export function StudentPortal() {
  const locale = useLocale(); const copy = getStudentCopy(locale); const router = useRouter();
  const { accountType, user, isInitializing, signOut } = useAccount();
  const [section, setSection] = useState<SectionId>("overview"); const [data, setData] = useState<StudentPortalData | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [guardian, setGuardian] = useState<Tables<"guardian_accounts"> | null>(null);
  const [learners, setLearners] = useState<Tables<"student_profiles">[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigatedRef = useRef(false);
  const loadedUserRef = useRef("");
  const load = useCallback(async (id: string, silent = false) => { if (!silent) setLoading(true); const result = await getStudentPortalData(id); if (!silent) setLoading(false); if (result.error || !result.data?.profile.active) { if (!silent) setError(result.error || "INACTIVE_PROFILE"); return; } setError(""); setData(result.data); }, []);

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
    if (accountType === "student" && user && loadedUserRef.current !== user.id) {
      loadedUserRef.current = user.id;
      const supabase = getSupabaseClient();
      void Promise.all([
        supabase.from("guardian_accounts").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("guardian_students").select("student_id,is_primary").eq("guardian_user_id", user.id).eq("active", true),
      ]).then(async ([guardianResult, linkResult]) => {
        const links = linkResult.data ?? [];
        const ids = links.map((row) => row.student_id);
        const profileResult = ids.length ? await supabase.from("student_profiles").select("*").in("id", ids).eq("active", true) : { data: [] as Tables<"student_profiles">[] };
        const rows = profileResult.data ?? [];
        const saved = localStorage.getItem("oriens.selectedLearnerId");
        const selected = rows.some((row) => row.id === saved) ? saved! : links.find((row) => row.is_primary)?.student_id ?? rows[0]?.id ?? "";
        setGuardian(guardianResult.data);
        setLearners(rows);
        setSelectedLearnerId(selected);
        if (selected) await load(selected); else { setLoading(false); setError("NO_LINKED_LEARNER"); }
      });
    }
  }, [accountType, isInitializing, locale, load, router, user]);

  useEffect(() => {
    if (!selectedLearnerId) return;
    const refreshSilently = () => { if (document.visibilityState === "visible") void load(selectedLearnerId, true); };
    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", refreshSilently);
    return () => { window.removeEventListener("focus", refreshSilently); document.removeEventListener("visibilitychange", refreshSilently); };
  }, [load, selectedLearnerId]);

  async function handleConfirmLogout() {
    if (signingOut) return;
    setSigningOut(true);
    navigatedRef.current = true;
    await signOut();
    router.replace(localizedPath("home", locale));
  }

  if (isInitializing || accountType !== "student") return <AccountWaveLoader />;
  if (!loading && error === "NO_LINKED_LEARNER" && guardian && user) return <LearnerSetupState locale={locale} accountEmail={guardian.email || user.email || ""} onCreated={async (studentId) => { const profileResult = await getSupabaseClient().from("student_profiles").select("*").eq("id", studentId).single(); if (profileResult.data) setLearners([profileResult.data]); setSelectedLearnerId(studentId); localStorage.setItem("oriens.selectedLearnerId", studentId); await load(studentId); }} />;
  if (loading || !data) return <section className="min-h-screen bg-background pt-32"><div className="public-container"><div className="mx-auto max-w-6xl animate-pulse rounded-2xl border border-border bg-surface p-10 text-sm text-muted-foreground">{error || (locale === "tr" ? "Hesabınız yükleniyor…" : "Loading your account…")}</div></div></section>;

  return <section className="min-h-screen bg-background pt-24 pb-28 md:pt-28 lg:pb-16"><div className="public-container"><div className="mx-auto max-w-7xl">
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{locale === "tr" ? "Hesabım" : "My Account"}</p><h1 className="mt-2 font-heading text-4xl text-ink">{locale === "tr" ? "Hoş geldiniz" : "Welcome"}, {(guardian?.full_name || "").split(" ")[0]}</h1><p className="mt-2 text-xs text-muted-foreground">{locale === "tr" ? "Öğrenci" : "Learner"}: <strong className="text-ink">{data.profile.full_name}</strong></p>{learners.length > 1 ? <select aria-label={locale === "tr" ? "Öğrenci değiştir" : "Switch learner"} value={selectedLearnerId} onChange={(event) => { const id=event.target.value; setSelectedLearnerId(id); localStorage.setItem("oriens.selectedLearnerId",id); void load(id); }} className="mt-3 min-h-10 rounded-xl border border-input bg-surface px-3 text-sm">{learners.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select> : null}</div><button onClick={() => setLogoutModalOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"><LogOut className="size-4" />{locale === "tr" ? "Çıkış" : "Log out"}</button></header>
    <div className="mt-7 grid gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]"><nav aria-label={locale === "tr" ? "Hesap bölümleri" : "Account sections"} className="hidden h-fit rounded-2xl border border-border bg-surface p-2 lg:block">{visibleNavigation.map(({ id, labelIndex, Icon }) => <button key={id} onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors cursor-pointer", section === id ? "bg-ink font-semibold text-white" : "text-muted-foreground hover:bg-surface-muted hover:text-ink")}><Icon className="size-4" />{copy.tabs[labelIndex]}</button>)}</nav>
      <main className="min-w-0">{section === "overview" && <Overview data={data} locale={locale} onNavigate={setSection} />}{section === "profile" && <Profile key={data.profile.updated_at || data.profile.id} data={data} guardian={guardian} userId={selectedLearnerId} locale={locale} onReload={() => load(selectedLearnerId, true)} />}{section === "lessons" && <Lessons data={data} locale={locale} />}{section === "package" && <PackageView data={data} locale={locale} />}{section === "payments" && <Payments data={data} locale={locale} />}{section === "support" && <SupportSection userId={selectedLearnerId} locale={locale} />}</main>
    </div>
  </div></div><nav aria-label={locale === "tr" ? "Mobil hesap bölümleri" : "Mobile account sections"} className="fixed inset-x-0 bottom-0 z-40 w-full max-w-full overflow-x-auto overscroll-x-contain border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden"><div className="flex w-max min-w-full justify-start gap-1">{visibleNavigation.map(({ id, labelIndex, Icon }) => <button key={id} onClick={() => setSection(id)} className={cn("flex min-h-14 min-w-[4.4rem] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] cursor-pointer", section === id ? "bg-sage-soft font-semibold text-ink" : "text-muted-foreground")}><Icon className="size-4" />{copy.tabs[labelIndex]}</button>)}</div></nav>
  <LogoutConfirmationModal open={logoutModalOpen} signingOut={signingOut} locale={locale} onCancel={() => setLogoutModalOpen(false)} onConfirm={handleConfirmLogout} />
  </section>;
}

function LearnerSetupState({ locale, accountEmail, onCreated }: { locale: "tr" | "en"; accountEmail: string; onCreated: (studentId: string) => Promise<void> }) {
  const [form, setForm] = useState({ fullName: "", email: accountEmail, phone: "", school: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isTr = locale === "tr";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await setupLearnerProfile({ ...form, preferredLanguage: locale });
    const value = result.data as { success?: boolean; student_id?: string; error_code?: string } | null;
    if (result.error || !value?.success || !value.student_id) {
      setBusy(false);
      setError(result.error?.message || value?.error_code || (isTr ? "Öğrenci bilgileri kaydedilemedi." : "Learner details could not be saved."));
      return;
    }
    await onCreated(value.student_id);
  }

  return (
    <section className="min-h-screen bg-background px-4 pt-28 pb-20 sm:pt-36">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{isTr ? "Hesabım" : "My Account"}</p>
        <h1 className="mt-3 font-heading text-3xl text-ink">{isTr ? "Öğrenci Bilgileri" : "Learner Details"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isTr ? "Hesabınız hazır. Derslerin ve ders haklarının doğru kişiyle ilişkilendirilmesi için öğrenci bilgilerini tanımlayın." : "Your account is ready. Add learner details so lessons and lesson rights can be linked to the correct person."}
        </p>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-ink">{isTr ? "Öğrenci Adı Soyadı" : "Learner Full Name"}<input required minLength={2} maxLength={100} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /></label>
          <label className="text-xs font-semibold text-ink">{isTr ? "Öğrenci E-postası" : "Learner Email"}<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /></label>
          <label className="text-xs font-semibold text-ink">{isTr ? "Telefon (isteğe bağlı)" : "Phone (optional)"}<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /></label>
          <label className="text-xs font-semibold text-ink">{isTr ? "Okul (isteğe bağlı)" : "School (optional)"}<input value={form.school} onChange={(event) => setForm({ ...form, school: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /></label>
          <button disabled={busy} className="min-h-12 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-forest disabled:opacity-50 sm:col-span-2">{busy ? (isTr ? "Kaydediliyor…" : "Saving…") : (isTr ? "Öğrenci Bilgilerini Kaydet" : "Save Learner Details")}</button>
        </form>
      </div>
    </section>
  );
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
  const entitlement = data.entitlement || {
    totalGrantedLessons: 0,
    totalUsedLessons: 0,
    totalRemainingLessons: 0,
    activePackages: data.purchases || [],
    pastPackages: [],
    primaryPackage: data.currentPackage || data.purchases[0] || null,
  };
  const activeCount = entitlement.activePackages.length;
  const primaryPkg = entitlement.primaryPackage;

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

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Current Package / Total Remaining Lessons Banner */}
      <button onClick={() => onNavigate("package")} className="rounded-2xl border border-border bg-forest p-6 text-left text-white sm:col-span-2 cursor-pointer hover:border-border-strong transition-all">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-white/65">
            {activeCount > 1
              ? (locale === "tr" ? `${activeCount} Aktif Eğitim Paketi` : `${activeCount} Active Packages`)
              : (locale === "tr" ? "Eğitim Paketi" : "Education Package")}
          </p>
          <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white">
            {locale === "tr" ? `${entitlement.totalRemainingLessons} Ders Hakkı` : `${entitlement.totalRemainingLessons} Lessons Available`}
          </span>
        </div>

        <h2 className="mt-2 font-heading text-3xl">
          {primaryPkg
            ? primaryPkg.custom_package_name || (locale === "tr" ? primaryPkg.pricing_packages?.name_tr : primaryPkg.pricing_packages?.name_en) || primaryPkg.package_id
            : "—"}
        </h2>

        {entitlement.totalGrantedLessons > 0 && (
          <>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-warm-accent"
                style={{
                  width: `${Math.min(100, (entitlement.totalUsedLessons / entitlement.totalGrantedLessons) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-white/75">
              {locale === "tr" ? "Toplam Kullanılan" : "Total Completed"}: {entitlement.totalUsedLessons} / {entitlement.totalGrantedLessons} · {locale === "tr" ? "Toplam Kalan" : "Total Remaining"}: <strong className="text-white font-bold">{entitlement.totalRemainingLessons} {locale === "tr" ? "Ders" : "Lessons"}</strong>
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {locale === "tr" ? "Yaklaşan Ders / Seans" : "Upcoming Session"}
        </h3>
        <p className="mt-2 text-xl font-bold text-ink">
          {nextLesson
            ? nextLesson.title
            : nextBooking
            ? (nextBooking.appointment_subject || nextBooking.exam_code || "Randevu")
            : (locale === "tr" ? "Planlanmadı" : "Not Scheduled")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {nextLesson
            ? `${nextLesson.subject} · ${fmt(nextLesson.lesson_date, locale, true)}`
            : nextBooking
            ? fmt(nextBooking.availability_slots?.starts_at || nextBooking.created_at, locale, true)
            : (locale === "tr" ? "Aktif planlanmış ders bulunmuyor" : "No active scheduled session")}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{locale === "tr" ? "Akademik İlerleme" : "Academic Progress"}</h3>
        <p className="mt-2 text-2xl font-bold text-ink">{data.lessons.filter((lesson) => lesson.status === "completed").length}</p>
        <p className="mt-1 text-xs text-muted-foreground">{locale === "tr" ? "Tamamlanan ders" : "Completed lessons"}</p>
      </div>
    </div>
  );
}

function Profile({ data, guardian, userId, locale, onReload }: { data: StudentPortalData; guardian: Tables<"guardian_accounts"> | null; userId: string; locale: "tr" | "en"; onReload: () => void }) {
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
  const [preferredLanguage, setPreferredLanguage] = useState<"tr" | "en">(
    data.profile.preferred_language === "en" ? "en" : "tr"
  );

  const [busy, setBusy] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: data.profile.email });
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [guardianForm, setGuardianForm] = useState({
    fullName: guardian?.full_name || "",
    phone: guardian?.phone || "",
    contactAddress: guardian?.contact_address || "",
  });
  const [guardianBusy, setGuardianBusy] = useState(false);

  async function saveGuardian(e: React.FormEvent) {
    e.preventDefault();
    setGuardianBusy(true); setMsg(""); setErr("");
    if (guardianForm.fullName.trim().length < 2 || guardianForm.fullName.trim().length > 100) {
      setGuardianBusy(false); setErr(locale === "tr" ? "Ad soyad 2–100 karakter olmalıdır." : "Full name must be 2–100 characters."); return;
    }
    if (guardianForm.contactAddress.trim().length < 10 || guardianForm.contactAddress.trim().length > 300) {
      setGuardianBusy(false); setErr(locale === "tr" ? "Geçerli iletişim adresinizi girin." : "Enter a valid contact address."); return;
    }
    const result = await updateGuardianProfile({ ...guardianForm, preferredLanguage: locale });
    setGuardianBusy(false);
    if (result.error) setErr(result.error.message);
    else setMsg(locale === "tr" ? "Hesap bilgileri güncellendi." : "Account details updated.");
  }

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
        preferred_language: preferredLanguage,
      });

      if (profileError) {
        setBusy(false);
        setErr(profileError.message);
        return;
      }

      await saveStudentPreferences(userId, selectedExams, selectedCountries, true, preferredLanguage);
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

      <Panel title={locale === "tr" ? "Hesap Sahibi Bilgileri" : "Account Holder Details"}>
        <form onSubmit={saveGuardian} className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">{locale === "tr" ? "Ad Soyad" : "Full Name"}<input required minLength={2} maxLength={100} value={guardianForm.fullName} onChange={(event) => setGuardianForm({...guardianForm,fullName:event.target.value})} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-ink" /></label>
          <label className="text-xs font-medium text-muted-foreground">{locale === "tr" ? "Telefon" : "Phone"}<input required type="tel" value={guardianForm.phone} onChange={(event) => setGuardianForm({...guardianForm,phone:event.target.value})} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-ink" /></label>
          <label className="text-xs font-medium text-muted-foreground sm:col-span-2">{locale === "tr" ? "İletişim Adresi" : "Contact Address"}<textarea required minLength={10} maxLength={300} value={guardianForm.contactAddress} onChange={(event) => setGuardianForm({...guardianForm,contactAddress:event.target.value})} className="mt-1 min-h-20 w-full rounded-xl border border-input bg-surface p-3 text-sm text-ink" /></label>
          <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">{locale === "tr" ? `Doğrulanmış e-posta: ${guardian?.email || "—"}. E-posta değişikliği ayrı doğrulama gerektirir.` : `Verified email: ${guardian?.email || "—"}. Email changes require separate verification.`}</p><button disabled={guardianBusy} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50"><Save className="size-4" />{guardianBusy ? (locale === "tr" ? "Kaydediliyor…" : "Saving…") : (locale === "tr" ? "Hesap Bilgilerini Kaydet" : "Save Account Details")}</button></div>
        </form>
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

          {/* PREFERRED COMMUNICATION LANGUAGE */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink block mb-1">
              {locale === "tr" ? "Tercih Edilen İletişim Dili" : "Preferred Communication Language"}
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              {locale === "tr"
                ? "Ders, randevu, ödeme ve destek bildirimlerinizin iletileceği dil."
                : "The language used for your lesson, booking, payment, and support notifications."}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <button
                type="button"
                onClick={() => setPreferredLanguage("tr")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer",
                  preferredLanguage === "tr"
                    ? "border-primary bg-primary text-white shadow-xs"
                    : "border-border bg-surface text-ink hover:border-primary/50 hover:bg-surface-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>TR</span>
                </div>
                {preferredLanguage === "tr" && <Check className="size-4 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setPreferredLanguage("en")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer",
                  preferredLanguage === "en"
                    ? "border-primary bg-primary text-white shadow-xs"
                    : "border-border bg-surface text-ink hover:border-primary/50 hover:bg-surface-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>EN</span>
                </div>
                {preferredLanguage === "en" && <Check className="size-4 shrink-0" />}
              </button>
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

interface UnifiedSessionItem {
  id: string;
  sourceType: "lesson" | "booking";
  eventType: "lesson" | "pre_consultation" | "additional_consultation" | "consultation" | "discovery" | "other";
  title: string;
  subject: string;
  examCode?: string | null;
  dateIso: string;
  durationMinutes: number;
  status: string;
  teacherNote?: string | null;
  liveMeetingUrl?: string | null;
}

function Lessons({ data, locale }: { data: StudentPortalData; locale: "tr" | "en" }) {
  const isTr = locale === "tr";

  const allSessions: UnifiedSessionItem[] = useMemo(() => {
    const lessonItems: UnifiedSessionItem[] = data.lessons.map((l) => ({
      id: l.id,
      sourceType: "lesson",
      eventType: "lesson",
      title: l.title,
      subject: l.subject,
      examCode: l.exam_code,
      dateIso: l.lesson_date,
      durationMinutes: l.duration_minutes || 60,
      status: l.status,
      teacherNote: l.teacher_note,
      liveMeetingUrl: l.live_meeting_url,
    }));

    const bookingItems: UnifiedSessionItem[] = data.bookings.map((b) => {
      let resolvedType: UnifiedSessionItem["eventType"] = "consultation";
      const rawType = (b.event_type || "").toLowerCase();
      if (rawType === "lesson" || b.appointment_subject?.startsWith("[Ders]")) {
        resolvedType = "lesson";
      } else if (rawType === "pre_consultation" || rawType === "discovery" || b.appointment_subject?.startsWith("[Ön Görüşme]")) {
        resolvedType = "pre_consultation";
      } else if (rawType === "additional_consultation" || b.appointment_subject?.startsWith("[Ek Görüşme]")) {
        resolvedType = "additional_consultation";
      } else if (rawType === "other") {
        resolvedType = "other";
      }

      return {
        id: b.id,
        sourceType: "booking",
        eventType: resolvedType,
        title: b.appointment_subject || b.exam_code || b.custom_exam || (isTr ? "Randevu" : "Session"),
        subject: b.exam_code ? b.exam_code.toUpperCase() : (isTr ? "Akademik Danışmanlık" : "Academic Consultation"),
        examCode: b.exam_code,
        dateIso: b.availability_slots?.starts_at || b.created_at,
        durationMinutes: 60,
        status: b.status,
        teacherNote: null,
        liveMeetingUrl: b.live_meeting_url,
      };
    });

    return [...lessonItems, ...bookingItems];
  }, [data.lessons, data.bookings, isTr]);

  const upcoming = useMemo(() => {
    return allSessions
      .filter((s) => !["completed", "cancelled"].includes(s.status))
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }, [allSessions]);

  const history = useMemo(() => {
    return allSessions
      .filter((s) => ["completed", "cancelled"].includes(s.status))
      .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  }, [allSessions]);

  const renderTypeBadge = (eventType: UnifiedSessionItem["eventType"]) => {
    switch (eventType) {
      case "lesson":
        return (
          <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
            {isTr ? "Canlı Ders" : "Live Lesson"}
          </span>
        );
      case "pre_consultation":
      case "discovery":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            <span>{isTr ? "Tanışma Görüşmesi" : "Introduction Meeting"}</span>
          </span>
        );
      case "additional_consultation":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
            <span>{isTr ? "Ek Görüşme" : "Follow-up"}</span>
            <span className="text-[9px] text-purple-600 font-normal">({isTr ? "Paketten düşmez" : "Free"})</span>
          </span>
        );
      case "consultation":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            <span>{isTr ? "Danışmanlık" : "Consultation"}</span>
            <span className="text-[9px] text-amber-600 font-normal">({isTr ? "Paketten düşmez" : "Free"})</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <span>{isTr ? "Diğer" : "Other"}</span>
            <span className="text-[9px] font-normal">({isTr ? "Paketten düşmez" : "Free"})</span>
          </span>
        );
    }
  };

  const renderStatusBadge = (sessionStatus: string) => {
    const cancelled = sessionStatus === "cancelled";
    const completed = sessionStatus === "completed";
    return (
      <span className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold",
        cancelled
          ? "border-red-200 bg-red-50 text-red-800"
          : completed
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800",
      )}>
        {cancelled
          ? (isTr ? "İptal Edildi" : "Cancelled")
          : completed
            ? (isTr ? "Tamamlandı" : "Completed")
            : (isTr ? "Yaklaşan" : "Upcoming")}
      </span>
    );
  };

  const renderSession = (s: UnifiedSessionItem, past = false) => (
    <article
      key={`${s.sourceType}-${s.id}`}
      className={cn(
        "rounded-2xl border bg-surface p-4 sm:p-5",
        past ? "border-border" : "border-primary/25 shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">{renderTypeBadge(s.eventType)}{renderStatusBadge(s.status)}</div>
      </div>
      <h3 className="mt-3 font-heading text-lg font-bold text-ink">{s.title}</h3>
      <p className="mt-1 text-xs font-medium text-primary">
        {s.subject}{s.examCode ? ` · ${s.examCode.toUpperCase()}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {fmt(s.dateIso, locale, true)} · {s.durationMinutes} {isTr ? "dk" : "min"}
      </p>
      {s.teacherNote && <p className="mt-3 rounded-lg border border-border bg-surface-muted p-2.5 text-xs text-ink/80"><strong>{isTr ? "Eğitmen Notu" : "Teacher Note"}:</strong> {s.teacherNote}</p>}
      {!past && s.liveMeetingUrl && (
        <div className="mt-4 border-t border-primary/10 pt-3">
          <a href={s.liveMeetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-forest">
            <Video className="size-4 text-warm-accent" />
            {s.eventType === "lesson" ? (isTr ? "Canlı Derse Katıl" : "Join Live Lesson") : (isTr ? "Görüşmeye Katıl" : "Join Meeting")}
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </article>
  );

  return (
    <div>
      <Panel title={isTr ? "Dersler" : "Lessons"}>
        {!upcoming.length && !history.length ? (
          <Empty>{isTr ? "Henüz ders veya görüşme kaydı yok." : "No lesson or meeting records yet."}</Empty>
        ) : <div className="space-y-6">
          {upcoming.length ? <div className="grid gap-3 sm:grid-cols-2">{upcoming.map((s) => renderSession(s))}</div> : null}
          {history.length ? <div className={cn("grid gap-3 border-t border-border pt-6 sm:grid-cols-2", !upcoming.length && "border-t-0 pt-0")}>{history.map((s) => renderSession(s, true))}</div> : null}
        </div>}
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

function PackageView({ data, locale }: { data: StudentPortalData; locale: "tr" | "en" }) {
  const entitlement = data.entitlement || {
    totalGrantedLessons: 0,
    totalUsedLessons: 0,
    totalRemainingLessons: 0,
    activePackages: data.purchases.filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0),
    pastPackages: data.purchases.filter((p) => p.status !== "active" || (p.lesson_count || 0) - (p.lessons_used || 0) <= 0),
    primaryPackage: data.currentPackage || data.purchases[0] || null,
  };

  const hasPurchases = data.purchases.length > 0;

  if (!hasPurchases) {
    return (
      <Panel title={locale === "tr" ? "Ders Hakları / Paketler" : "Lesson Rights / Packages"}>
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

  const { activePackages, pastPackages, totalRemainingLessons, totalGrantedLessons, totalUsedLessons } = entitlement;

  return (
    <div className="space-y-6">
      {/* Top Aggregate Summary Panel */}
      <Panel title={locale === "tr" ? "Eğitim Paketlerim" : "My Education Packages"}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              {locale === "tr" ? "Toplam Kalan Ders" : "Total Remaining Lessons"}
            </p>
            <p className="mt-1 font-heading text-3xl text-ink font-bold">
              {totalRemainingLessons} <span className="text-sm font-normal text-muted-foreground">{locale === "tr" ? "Ders" : "Lessons"}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {locale === "tr" ? "Toplam Tanımlanan" : "Total Granted"}
            </p>
            <p className="mt-1 font-heading text-3xl text-ink font-bold">
              {totalGrantedLessons} <span className="text-sm font-normal text-muted-foreground">{locale === "tr" ? "Ders" : "Lessons"}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {locale === "tr" ? "Toplam Tamamlanan" : "Total Completed"}
            </p>
            <p className="mt-1 font-heading text-3xl text-ink font-bold">
              {totalUsedLessons} <span className="text-sm font-normal text-muted-foreground">{locale === "tr" ? "Ders" : "Lessons"}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {activePackages.length > 0
              ? (locale === "tr"
                  ? `${activePackages.length} aktif paketiniz üzerinden dersleriniz sırasıyla kullanılmaktadır.`
                  : `Lessons are consumed in order across your ${activePackages.length} active packages.`)
              : (locale === "tr" ? "Aktif kullanılabilir ders hakkınız kalmamıştır." : "No remaining active lesson entitlements.")}
          </p>
          <Link
            href={localizedPath("pricing", locale)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors"
          >
            {locale === "tr" ? "+ Yeni Paket Ekle / Yenile" : "+ Add / Renew Package"}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </Panel>

      {/* Active Packages List */}
      {activePackages.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-heading text-xl text-ink">
            {locale === "tr" ? "Aktif Paketler" : "Active Packages"}
          </h3>
          <div className="grid gap-4">
            {activePackages.map((p, idx) => {
              const pkgAdjustments = (data.adjustments || []).filter((a) => a.package_purchase_id === p.id);
              const extraLessonsSum = pkgAdjustments
                .filter((a) => a.adjustment_type === "extra_lessons")
                .reduce((sum, a) => sum + (a.lesson_delta || 0), 0);
              const baseLessonCount = Math.max(0, p.lesson_count - extraLessonsSum);
              const remaining = Math.max(0, p.lesson_count - p.lessons_used);
              const fee = p.price_amount === null ? "—" : new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: p.currency }).format(p.price_amount);

              return (
                <div key={p.id} className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest uppercase">
                          {locale === "tr" ? `Paket #${idx + 1}` : `Package #${idx + 1}`}
                        </span>
                        <h4 className="font-heading text-2xl text-ink">
                          {p.custom_package_name || (locale === "tr" ? p.pricing_packages?.name_tr : p.pricing_packages?.name_en) || p.package_id}
                        </h4>
                      </div>
                      {extraLessonsSum > 0 && (
                        <p className="mt-1 text-xs text-primary font-semibold">
                          {locale === "tr"
                            ? `Temel ${baseLessonCount} Ders + Ekstra ${extraLessonsSum} Ders = Toplam ${p.lesson_count} Ders`
                            : `Base ${baseLessonCount} Lessons + Extra ${extraLessonsSum} Lessons = Total ${p.lesson_count} Lessons`}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full border border-forest/30 bg-forest/10 px-3 py-1 text-xs font-bold text-forest">
                      {remaining} / {p.lesson_count} {locale === "tr" ? "Kaldı" : "Remaining"}
                    </span>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, p.lesson_count ? (p.lessons_used / p.lesson_count) * 100 : 0)}%` }}
                    />
                  </div>

                  <dl className="mt-4 grid gap-2 sm:grid-cols-4 text-sm">
                    <div className="rounded-lg bg-surface-muted p-2.5">
                      <dt className="text-[11px] text-muted-foreground">{locale === "tr" ? "Toplam Ders" : "Total Lessons"}</dt>
                      <dd className="font-semibold text-ink">{p.lesson_count}</dd>
                    </div>
                    <div className="rounded-lg bg-surface-muted p-2.5">
                      <dt className="text-[11px] text-muted-foreground">{locale === "tr" ? "Kullanılan" : "Completed"}</dt>
                      <dd className="font-semibold text-ink">{p.lessons_used}</dd>
                    </div>
                    <div className="rounded-lg bg-surface-muted p-2.5">
                      <dt className="text-[11px] text-muted-foreground">{locale === "tr" ? "Kalan" : "Remaining"}</dt>
                      <dd className="font-semibold text-primary font-bold">{remaining}</dd>
                    </div>
                    <div className="rounded-lg bg-surface-muted p-2.5">
                      <dt className="text-[11px] text-muted-foreground">{locale === "tr" ? "Ücret" : "Fee"}</dt>
                      <dd className="font-semibold text-ink">{fee}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past / Completed Packages */}
      {pastPackages.length > 0 && (
        <div className="space-y-4 pt-2">
          <h3 className="font-heading text-xl text-ink/75">
            {locale === "tr" ? "Geçmiş / Tamamlanan Paketler" : "Past / Completed Packages"}
          </h3>
          <div className="grid gap-3">
            {pastPackages.map((p) => {
              const fee = p.price_amount === null ? "—" : new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: p.currency }).format(p.price_amount);
              return (
                <div key={p.id} className="rounded-xl border border-border/70 bg-surface-muted/50 p-4 flex flex-wrap items-center justify-between gap-3 text-sm opacity-85">
                  <div>
                    <h4 className="font-medium text-ink">
                      {p.custom_package_name || (locale === "tr" ? p.pricing_packages?.name_tr : p.pricing_packages?.name_en) || p.package_id}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {p.lesson_count} {locale === "tr" ? "Ders" : "Lessons"} · {locale === "tr" ? "Kullanılan" : "Completed"}: {p.lessons_used} · {fmt(p.created_at, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">{fee}</span>
                    <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {p.status === "completed" || p.lessons_used >= p.lesson_count
                        ? (locale === "tr" ? "Tamamlandı" : "Completed")
                        : p.status === "refunded"
                        ? (locale === "tr" ? "İade Edildi" : "Refunded")
                        : (locale === "tr" ? "Süresi Doldu" : "Expired")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl border border-border bg-surface-muted p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold text-ink">{value}</dd></div>;}

function Payments({data,locale}:{data:StudentPortalData;locale:"tr"|"en"}) {
  const refundCopy = getPaymentRefundCopy(locale);
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
                    · <span className="font-semibold text-ink">{p.refund_status === "partial" ? refundCopy.partiallyRefunded : p.refund_status === "full" ? refundCopy.refunded : status(p.status, locale)}</span>
                  </p>
                  {Number(p.refunded_amount || 0) > 0 ? <p className="text-[11px] font-medium text-purple-800">{refundCopy.refundedAmount}: {new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: p.currency }).format(Number(p.refunded_amount))}</p> : null}
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
  const chatContainerRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom inside internal container only (never moves document viewport)
  useEffect(() => {
    if (activeThreadId && messages.length && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeThreadId]);

  // Handle new thread creation without unexpected document jump
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
    <div className="space-y-6 min-w-0 max-w-full">
      {/* 1. If viewing a specific thread conversation */}
      {activeThread ? (
        <Panel
          title={
            <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveThreadId(null)}
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-surface-muted text-ink hover:bg-surface transition-colors cursor-pointer shrink-0"
                  aria-label={isTr ? "Geri" : "Back"}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-md bg-sage-soft px-2 py-0.5 text-[11px] font-bold text-ink">
                      {SUPPORT_CATEGORIES.find((c) => c.id === activeThread.category)?.[isTr ? "labelTr" : "labelEn"] || activeThread.category}
                    </span>
                    <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {SUPPORT_STATUS_LABELS[activeThread.status]?.[locale] || activeThread.status}
                    </span>
                  </div>
                  <h3 className="mt-1 font-heading text-xl text-ink truncate">{activeThread.subject}</h3>
                </div>
              </div>
            </div>
          }
        >
          {/* Chat message stream */}
          <div ref={chatContainerRef} className="flex flex-col space-y-4 max-h-[480px] min-h-[260px] overflow-y-auto overflow-x-hidden pr-1 py-2 min-w-0 max-w-full">
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
                      "flex flex-col max-w-[85%] sm:max-w-[75%] min-w-0",
                      isStudent ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <span className="mb-1 text-[11px] font-medium text-muted-foreground">
                      {isStudent ? (isTr ? "Siz" : "You") : "Oriens Destek"} · {fmt(m.created_at, locale, true)}
                    </span>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-xs break-words [overflow-wrap:anywhere] max-w-full",
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
