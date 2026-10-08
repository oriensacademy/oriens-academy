"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { useAccount } from "@/lib/auth/account-context";
import { loginPathWithReturn } from "@/lib/auth/account-routing";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { getStudentPortalData, type StudentPortalData } from "@/lib/student/data";
import { invalidateStudentData, queryKeys, useQuery } from "@/lib/data/query-store";
import { claimAnonymousExamResult } from "@/lib/student/exam-history";
import { EmailOtpGate } from "@/components/auth/EmailOtpGate";
import { HesabimView } from "@/components/student/hesabim/HesabimView";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export function StudentPortal() {
  const locale = useLocale();
  const router = useRouter();
  const { accountType, user, isInitializing, signOut } = useAccount();
  const [bootstrapError, setBootstrapError] = useState("");
  const [guardian, setGuardian] = useState<Tables<"guardian_accounts"> | null>(null);
  const [learners, setLearners] = useState<Tables<"student_profiles">[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [bootstrapRetry, setBootstrapRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const navigatedRef = useRef(false);
  const loadedUserRef = useRef("");

  const portalQuery = useQuery(
    selectedLearnerId ? queryKeys.studentPortal(selectedLearnerId) : null,
    () => getStudentPortalData(selectedLearnerId),
    { staleTime: 30_000, enabled: Boolean(selectedLearnerId) },
  );
  const data: StudentPortalData | null = portalQuery.data?.data ?? null;
  const dataError = portalQuery.error || portalQuery.data?.error || "";
  const inactiveProfile = Boolean(portalQuery.data?.data && !portalQuery.data.data.profile.active);
  const noLearner = bootstrapDone && !selectedLearnerId;
  const error = bootstrapError || dataError || (inactiveProfile ? "INACTIVE_PROFILE" : "") || (noLearner ? "NO_LEARNER" : "");
  const load = useCallback(() => portalQuery.refetch(), [portalQuery]);

  useEffect(() => {
    try {
      const claimToken = sessionStorage.getItem("oriens.pendingExamClaimToken");
      if (claimToken) {
        void claimAnonymousExamResult(claimToken).then((result) => {
          if (result.success) {
            sessionStorage.removeItem("oriens.pendingExamClaimToken");
            sessionStorage.removeItem("oriens.pendingSignupEmail");
          }
        });
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }
  }, []);

  useEffect(() => {
    if (isInitializing || navigatedRef.current) return;
    if (accountType === "unauthenticated" || accountType === "unknown") {
      navigatedRef.current = true;
      router.replace(loginPathWithReturn(locale, localizedPath("studentAccount", locale)));
      return;
    }
    if (accountType === "admin") {
      navigatedRef.current = true;
      router.replace("/admin/");
      return;
    }
    if (accountType !== "student" || !user || loadedUserRef.current === user.id) return;

    loadedUserRef.current = user.id;
    setBootstrapError("");
    const supabase = getSupabaseClient();
    void Promise.all([
      supabase.from("guardian_accounts").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("guardian_students").select("student_id,is_primary").eq("guardian_user_id", user.id).eq("active", true),
    ]).then(async ([guardianResult, linkResult]) => {
      const links = linkResult.data ?? [];
      const ids = links.map((row) => row.student_id);
      const profileResult = ids.length
        ? await supabase.from("student_profiles").select("*").in("id", ids).eq("active", true)
        : { data: [] as Tables<"student_profiles">[] };
      const rows = profileResult.data ?? [];
      const saved = localStorage.getItem("oriens.selectedLearnerId");
      let selected = rows.some((row) => row.id === saved)
        ? saved!
        : links.find((row) => row.is_primary)?.student_id ?? rows[0]?.id ?? "";

      if (!selected) {
        const selfName = guardianResult.data?.full_name || user.email?.split("@")[0] || "Student";
        const { data: newProfile } = await supabase.from("student_profiles").upsert({
          id: user.id,
          full_name: selfName,
          email: user.email || "",
          preferred_language: locale,
          active: true,
        }).select().single();
        await supabase.from("guardian_students").upsert({
          guardian_user_id: user.id,
          student_id: user.id,
          relationship_role: "self",
          is_primary: true,
          active: true,
        });
        if (newProfile) setLearners([newProfile]);
        selected = user.id;
      }

      setGuardian(guardianResult.data);
      if (rows.length > 0) setLearners(rows);
      setSelectedLearnerId(selected);
      setBootstrapDone(true);
    }).catch((reason: unknown) => {
      loadedUserRef.current = "";
      setBootstrapDone(true);
      setBootstrapError(reason instanceof Error ? reason.message : "PORTAL_BOOTSTRAP_FAILED");
    });
  }, [accountType, bootstrapRetry, isInitializing, locale, router, user]);

  async function handleConfirmLogout() {
    if (signingOut) return;
    setSigningOut(true);
    navigatedRef.current = true;
    await signOut();
    router.replace(localizedPath("home", locale));
  }

  if (accountType !== "student") return <AccountWaveLoader />;

  if (error && !data) {
    const isTr = locale === "tr";
    return (
      <section className="min-h-screen bg-background pt-32">
        <div className="public-container">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-10 text-center">
            <h2 className="font-heading text-xl text-ink">{isTr ? "Hesabınız yüklenemedi" : "We couldn’t load your account"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {error === "INACTIVE_PROFILE"
                ? isTr ? "Profiliniz şu anda aktif değil. Lütfen bizimle iletişime geçin." : "Your profile is not active right now. Please contact us."
                : error === "NO_LEARNER"
                  ? isTr ? "Hesabınıza bağlı bir öğrenci profili bulunamadı. Lütfen bizimle iletişime geçin." : "No learner profile is linked to your account. Please contact us."
                  : isTr ? "Bağlantı kurulamadı. Lütfen tekrar deneyin." : "We could not reach the server. Please try again."}
            </p>
            {error !== "INACTIVE_PROFILE" ? (
              <button
                type="button"
                onClick={() => {
                  loadedUserRef.current = "";
                  setBootstrapError("");
                  setBootstrapDone(false);
                  setBootstrapRetry((value) => value + 1);
                  void load();
                }}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:opacity-90 cursor-pointer"
              >
                {isTr ? "Tekrar dene" : "Try again"}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (!data) {
    return <section className="min-h-screen bg-background pt-32"><div className="public-container"><div className="mx-auto max-w-6xl animate-pulse rounded-2xl border border-border bg-surface p-10 text-sm text-muted-foreground">{locale === "tr" ? "Hesabınız yükleniyor…" : "Loading your account…"}</div></div></section>;
  }

  if (guardian && !guardian.email_verified_at) {
    return (
      <EmailOtpGate
        email={(guardian.email || user?.email || "").trim().toLowerCase()}
        locale={locale}
        onVerified={() => setGuardian((current) => current ? { ...current, email_verified_at: new Date().toISOString() } : current)}
        onLogout={handleConfirmLogout}
      />
    );
  }

  return (
    <section className="min-h-screen">
      <HesabimView
        locale={locale}
        data={data}
        guardian={guardian}
        learners={learners}
        selectedLearnerId={selectedLearnerId}
        onSelectLearner={(id) => {
          setSelectedLearnerId(id);
          localStorage.setItem("oriens.selectedLearnerId", id);
        }}
        onLogout={handleConfirmLogout}
        onGuardianChange={(patch) => setGuardian((current) => current ? { ...current, ...patch } : current)}
        onReload={() => invalidateStudentData()}
        onAccountDeleted={handleConfirmLogout}
      />
    </section>
  );
}
