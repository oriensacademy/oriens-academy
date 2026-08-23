"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Calendar, RefreshCcw, Award, Mail, ArrowRight, UserPlus } from "lucide-react";
import type { TestResult, ExamTest, QuestionBreakdownItem, TopicResult } from "@/data/exam-tests";
import { getExamTestCopy } from "@/content/exam-test";
import type { Locale } from "@/content/dictionaries";
import { useAccount } from "@/lib/auth/account-context";
import { submitContact } from "@/lib/contact/api";
import { saveStudentExamAttempt, sendExamResultEmail, type QuestionSnapshot } from "@/lib/student/exam-history";
import { localizedPath } from "@/lib/routes";
import { ExamQuestionReview } from "./ExamQuestionReview";

function normalizeTestResult(input?: TestResult | null): TestResult {
  const topics = Array.isArray(input?.topics) ? input.topics.filter(Boolean) : [];
  const breakdown = Array.isArray(input?.breakdown) ? input.breakdown.filter(Boolean) : [];
  const strengths = Array.isArray(input?.strengths) ? input.strengths.filter(Boolean) : [];
  const improvementAreas = Array.isArray(input?.improvementAreas) ? input.improvementAreas.filter(Boolean) : [];
  const total = Number.isFinite(input?.total) ? Math.max(0, input!.total) : 0;
  const correct = Number.isFinite(input?.correct) ? Math.max(0, input!.correct) : 0;
  const incorrect = Number.isFinite(input?.incorrect) ? Math.max(0, input!.incorrect) : 0;
  const unanswered = Number.isFinite(input?.unanswered) ? Math.max(0, input!.unanswered) : 0;
  const rawAccuracy = input?.accuracy;
  const accuracy = Number.isFinite(rawAccuracy) ? Math.min(100, Math.max(0, Math.round(rawAccuracy!))) : 0;
  const performanceTier = input?.performanceTier || (accuracy >= 75 ? "strong" : accuracy >= 40 ? "moderate" : "foundation");

  return {
    examCode: input?.examCode || "SAT",
    total,
    correct,
    incorrect,
    unanswered,
    accuracy,
    performanceTier,
    topics,
    strengths,
    improvementAreas,
    breakdown,
  };
}

export function ExamTestResults({
  locale,
  result,
  testData,
  onRetry,
  onChangeExam,
}: {
  locale: Locale;
  result: TestResult;
  testData?: ExamTest | null;
  onRetry: () => void;
  onChangeExam: () => void;
}) {
  const router = useRouter();
  const copy = getExamTestCopy(locale);
  const isTr = locale === "tr";
  const { user } = useAccount();

  const safeResult = normalizeTestResult(result);
  const consultationRef = useRef<HTMLElement>(null);

  // Auto-save state for authenticated students
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveAttemptedRef = useRef(false);

  // Email Report Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [reportEmail, setReportEmail] = useState(() => user?.email || "");
  const [reportName, setReportName] = useState(() => user?.user_metadata?.full_name || "");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  const [isSendingEmail, startEmailTransition] = useTransition();

  // Consultation Modal State
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultName, setConsultName] = useState(() => user?.user_metadata?.full_name || "");
  const [consultEmail, setConsultEmail] = useState(() => user?.email || "");
  const [consultPhone, setConsultPhone] = useState(() => user?.user_metadata?.phone || "");
  const [consultSuccess, setConsultSuccess] = useState(false);
  const [consultError, setConsultError] = useState("");
  const [isSendingConsult, startConsultTransition] = useTransition();

  // Build question snapshots
  const questionSnapshots: QuestionSnapshot[] = safeResult.breakdown.map((b: QuestionBreakdownItem) => {
    const selectedOpt = b.answers?.find((a) => a.id === b.selectedAnswer);
    const correctOpt = b.answers?.find((a) => a.id === b.correctAnswer);
    return {
      id: b.id,
      prompt: b.questionText,
      topicId: b.topic,
      topicLabel: b.topic,
      selectedAnswer: selectedOpt ? `${selectedOpt.id.toUpperCase()}) ${selectedOpt.label[locale]}` : b.selectedAnswer ? b.selectedAnswer.toUpperCase() : null,
      correctAnswer: correctOpt ? `${correctOpt.id.toUpperCase()}) ${correctOpt.label[locale]}` : b.correctAnswer.toUpperCase(),
      wasCorrect: b.isCorrect,
      explanation: b.explanation,
    };
  });

  // Automatically persist attempt for authenticated student
  useEffect(() => {
    if (!user?.id || saveAttemptedRef.current) return;
    saveAttemptedRef.current = true;
    setSaveStatus("saving");

    saveStudentExamAttempt({
      examCode: safeResult.examCode,
      locale,
      result: safeResult,
      questionSnapshots,
    })
      .then((res) => {
        if (res.success) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      })
      .catch(() => {
        setSaveStatus("error");
      });
  }, [user?.id, safeResult, locale, questionSnapshots]);

  const topics = safeResult.topics;
  const strong = safeResult.strengths;
  const improve = safeResult.improvementAreas;
  const totalQuestions = safeResult.total;
  const correctCount = safeResult.correct;
  const incorrectCount = safeResult.incorrect;
  const accuracy = safeResult.accuracy;

  const reviewItems = safeResult.breakdown.map((b: QuestionBreakdownItem, idx: number) => ({
    id: b.id,
    questionNumber: idx + 1,
    topic: b.topic,
    prompt: b.questionText,
    selectedAnswerId: b.selectedAnswer,
    correctAnswerId: b.correctAnswer,
    selectedAnswerText: b.selectedAnswer ? b.selectedAnswer.toUpperCase() : null,
    correctAnswerText: b.correctAnswer.toUpperCase(),
    isCorrect: b.isCorrect,
    explanation: b.explanation,
    options: (b.answers || []).map((a) => ({
      id: a.id,
      label: a.label?.[locale] || a.id,
    })),
  }));

  const handleCompleteReview = () => {
    consultationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const recommendation =
    accuracy >= 75
      ? copy.performance.strong
      : accuracy >= 40
        ? copy.performance.moderate
        : copy.performance.foundation;

  // Handle Email Report submission
  const handleSendEmailReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportEmail.trim() || !reportEmail.includes("@")) {
      setEmailError(isTr ? "Lütfen geçerli bir e-posta adresi girin." : "Please enter a valid email address.");
      return;
    }

    setEmailError("");
    startEmailTransition(async () => {
      const res = await sendExamResultEmail({
        email: reportEmail.trim().toLowerCase(),
        fullName: reportName.trim() || undefined,
        examCode: safeResult.examCode,
        locale,
        result: safeResult,
        questionSnapshots,
      });

      if (res.success) {
        setEmailSuccess(true);
        if (res.claimToken) {
          setClaimToken(res.claimToken);
        }
      } else {
        setEmailError(isTr ? "E-posta gönderilemedi, lütfen tekrar deneyin." : "Could not send email, please retry.");
      }
    });
  };

  // Handle Registration Conversion Click
  const handleProceedToRegistration = () => {
    try {
      if (typeof window !== "undefined") {
        if (reportEmail.trim()) {
          sessionStorage.setItem("oriens.pendingSignupEmail", reportEmail.trim().toLowerCase());
        }
        if (claimToken) {
          sessionStorage.setItem("oriens.pendingExamClaimToken", claimToken);
        }
      }
    } catch {
      // safe fallback
    }
    setShowEmailModal(false);
    const signupPath = localizedPath("login", locale) + "?mode=register";
    router.push(signupPath);
  };

  // Handle Consultation submit
  const handleSendToConsultant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultEmail.trim() || !consultName.trim()) {
      setConsultError(isTr ? "Lütfen ad soyad ve e-posta adresinizi girin." : "Please enter your name and email.");
      return;
    }

    setConsultError("");
    startConsultTransition(async () => {
      const examName = (safeResult.examCode || "Exam").toUpperCase();
      const topicSummary = topics
        .map((t) => `${t.label}: %${t.accuracy} (${t.correct}/${t.total})`)
        .join(" | ");

      const resultPayloadMessage = [
        `[KENDİNİ DENE TEST SONUCU]`,
        `Sınav: ${examName}`,
        `Doğru/Toplam: ${correctCount}/${totalQuestions} (%${accuracy})`,
        `Konu Dağılımı: ${topicSummary}`,
        consultPhone ? `Telefon: ${consultPhone}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await submitContact({
        fullName: consultName.trim(),
        email: consultEmail.trim().toLowerCase(),
        phone: consultPhone.trim() || "Belirtilmedi",
        subject: `${examName} Kendini Dene Sonuç Analizi (${correctCount}/${totalQuestions})`,
        message: resultPayloadMessage,
        locale: locale as "tr" | "en",
        privacyConsent: true,
        source: "consultation",
      });

      if (res.success) {
        setConsultSuccess(true);
      } else {
        setConsultError(res.message || (isTr ? "Sonuç iletilemedi, lütfen tekrar deneyin." : "Could not send results, please retry."));
      }
    });
  };

  return (
    <div aria-live="polite" data-testid="exam-result" className="space-y-8">
      {/* Header & Score Badge */}
      <div className="border-b border-[#DDE4DC] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF0E6] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#2E4A36]">
            <Award className="size-3.5" />
            {safeResult.examCode?.toUpperCase()} · {totalQuestions} {isTr ? "Soruluk Değerlendirme" : "Question Diagnostic"}
          </span>
          <div className="flex items-center gap-2">
            {saveStatus === "saved" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="size-3" />
                {copy.attemptSaved}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-[11px] text-amber-700">
                {copy.attemptSaveFailed}
              </span>
            )}
            <span className="text-xs font-semibold text-muted-foreground">
              {isTr ? "Tamamlandı" : "Completed"}
            </span>
          </div>
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          {copy.resultsTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-2xl">
          {recommendation}
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div
          data-testid="exam-result-correct"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 text-center shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {copy.correct}
          </span>
          <p className="mt-1 text-2xl font-extrabold text-emerald-950 sm:text-3xl">
            {correctCount} / {totalQuestions}
          </p>
        </div>

        <div
          data-testid="exam-result-incorrect"
          className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 sm:p-5 text-center shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
            {copy.incorrect}
          </span>
          <p className="mt-1 text-2xl font-extrabold text-rose-950 sm:text-3xl">
            {incorrectCount} / {totalQuestions}
          </p>
        </div>

        <div
          data-testid="exam-result-accuracy"
          className="rounded-2xl border border-primary/20 bg-[#F4F6F0] p-4 sm:p-5 text-center shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {copy.accuracy}
          </span>
          <p className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
            {accuracy}%
          </p>
        </div>
      </div>

      {/* Topics Breakdown */}
      {topics.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-bold text-ink sm:text-lg">
            {copy.topicBreakdown}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {topics.map((t: TopicResult) => {
              const acc = t?.accuracy ?? 0;
              const isStrong = acc >= 80;
              const isModerate = acc >= 60 && acc < 80;
              const tone = isStrong
                ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                : isModerate
                  ? "border-amber-200 bg-amber-50/40 text-amber-900"
                  : "border-rose-200 bg-rose-50/40 text-rose-900";

              const badge = isStrong
                ? copy.statusStrong
                : isModerate
                  ? copy.statusModerate
                  : copy.statusImprove;

              const badgeColor = isStrong
                ? "bg-emerald-100 text-emerald-800"
                : isModerate
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800";

              return (
                <div
                  key={t.category || t.label}
                  className={`flex flex-col justify-between rounded-xl border p-4 shadow-2xs ${tone}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold">{t.label}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${badgeColor}`}
                    >
                      {badge}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span>{t.correct} / {t.total} {isTr ? "Doğru" : "Correct"}</span>
                      <span>%{acc}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isStrong ? "bg-emerald-600" : isModerate ? "bg-amber-600" : "bg-rose-600"
                        }`}
                        style={{ width: `${acc}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Strengths and Focus Areas */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-5">
          <div className="flex items-center gap-2 text-emerald-800 mb-3">
            <CheckCircle2 className="size-4 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {copy.strongAreas}
            </h4>
          </div>
          {strong.length > 0 ? (
            <ul className="space-y-1.5 text-xs font-medium text-emerald-950">
              {strong.map((label: string, idx: number) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-600 shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.emptyStrong}</p>
          )}
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-5">
          <div className="flex items-center gap-2 text-rose-800 mb-3">
            <XCircle className="size-4 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {copy.improveAreas}
            </h4>
          </div>
          {improve.length > 0 ? (
            <ul className="space-y-1.5 text-xs font-medium text-rose-950">
              {improve.map((label: string, idx: number) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-rose-600 shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.emptyImprove}</p>
          )}
        </div>
      </section>

      {/* One-Question-At-A-Time Review Component */}
      {reviewItems.length > 0 && (
        <ExamQuestionReview
          items={reviewItems}
          locale={locale}
          onCompleteReview={handleCompleteReview}
        />
      )}

      {/* Next Step / Email & Consultation CTAs */}
      <section
        ref={consultationRef}
        id="consultation-section"
        className="rounded-2xl border border-primary/40 bg-[#F4F6F0] p-6 sm:p-8 shadow-sm scroll-mt-6"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {copy.nextStep}
            </span>
            <h3 className="font-heading text-2xl text-ink">
              {isTr ? "Sonuçlarınızı uzman eğitmenlerimizle analiz edin" : "Review your results with our academic team"}
            </h3>
            <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
              {copy.nextStepBody}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Primary Action: Email Report */}
            <button
              type="button"
              onClick={() => {
                setShowEmailModal(true);
                setEmailSuccess(false);
                setEmailError("");
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white shadow-sm hover:bg-forest transition-colors cursor-pointer"
            >
              <Mail className="size-4" />
              {user?.id ? copy.sendToMyEmail : copy.emailReportCTA}
            </button>

            {/* Secondary Action: Consultation */}
            <button
              type="button"
              onClick={() => {
                setShowConsultModal(true);
                setConsultSuccess(false);
                setConsultError("");
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 text-sm font-semibold text-ink shadow-sm hover:bg-[#F9FAF8] transition-colors cursor-pointer"
            >
              <Calendar className="size-4 text-primary" />
              {copy.requestConsultation}
            </button>
          </div>
        </div>
      </section>

      {/* Email Report Modal (Includes Post-Email Registration Conversion) */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-[#DDE4DC] bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            {emailSuccess ? (
              <div className="text-center py-2 space-y-4">
                <div className="size-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="size-7" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink">{copy.emailReportSentTitle}</h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {copy.emailReportSentDesc}
                  </p>
                </div>

                {/* Anonymous Visitor Post-Email Registration Conversion Card */}
                {!user?.id && (
                  <div className="rounded-xl border border-primary/20 bg-[#F4F6F0] p-4 text-left space-y-3">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <UserPlus className="size-4" />
                      <span>{copy.conversionTitle}</span>
                    </div>
                    <div className="text-xs text-ink/80 whitespace-pre-line leading-relaxed">
                      {copy.conversionDesc}
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleProceedToRegistration}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer"
                      >
                        {copy.createAccountBtn}
                        <ArrowRight className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmailModal(false)}
                        className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-ink transition-colors cursor-pointer"
                      >
                        {copy.notNowBtn}
                      </button>
                    </div>
                  </div>
                )}

                {user?.id && (
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="mt-2 w-full rounded-xl bg-ink py-2.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer"
                  >
                    {isTr ? "Kapat" : "Close"}
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSendEmailReport} className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1">
                    <Mail className="size-4" />
                    <span>{copy.emailReportCTA}</span>
                  </div>
                  <h4 className="text-lg font-bold text-ink">{copy.emailReportModalTitle}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.emailReportModalDesc}</p>
                </div>

                {emailError && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                    {emailError}
                  </div>
                )}

                {!user?.id && (
                  <div>
                    <label className="block text-xs font-semibold text-ink">{copy.fullName} ({isTr ? "İsteğe Bağlı" : "Optional"})</label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder={isTr ? "Adınız Soyadınız" : "Full Name"}
                      className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ink">{copy.email}</label>
                  <input
                    type="email"
                    required
                    value={reportEmail}
                    onChange={(e) => setReportEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
                  >
                    {copy.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingEmail}
                    className="flex-1 rounded-xl bg-ink py-2.5 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingEmail ? copy.sending : (isTr ? "Raporu Gönder" : "Send Report")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Consultation Modal */}
      {showConsultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-[#DDE4DC] bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            {consultSuccess ? (
              <div className="text-center py-4 space-y-4">
                <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
                <h4 className="text-xl font-bold text-ink">{isTr ? "Talebiniz Alındı!" : "Request Received!"}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {copy.sentSuccess}
                </p>
                <button
                  type="button"
                  onClick={() => setShowConsultModal(false)}
                  className="mt-4 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-white hover:bg-forest cursor-pointer"
                >
                  {isTr ? "Kapat" : "Close"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendToConsultant} className="space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-ink">{copy.sendModalTitle}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.sendModalDesc}</p>
                </div>

                {consultError && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                    {consultError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ink">{copy.fullName}</label>
                  <input
                    type="text"
                    required
                    value={consultName}
                    onChange={(e) => setConsultName(e.target.value)}
                    placeholder={isTr ? "Adınız Soyadınız" : "Full Name"}
                    className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">{copy.email}</label>
                  <input
                    type="email"
                    required
                    value={consultEmail}
                    onChange={(e) => setConsultEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">{copy.phone}</label>
                  <input
                    type="tel"
                    value={consultPhone}
                    onChange={(e) => setConsultPhone(e.target.value)}
                    placeholder={copy.phonePlaceholder}
                    className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConsultModal(false)}
                    className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
                  >
                    {copy.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingConsult}
                    className="flex-1 rounded-xl bg-ink py-2.5 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingConsult ? copy.sending : copy.sendBtn}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons: Retry / Change Exam */}
      <div className="flex flex-col gap-3 sm:flex-row pt-4 border-t border-[#DDE4DC]">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest cursor-pointer"
        >
          <RefreshCcw className="size-4" />
          {copy.retry}
        </button>
        <button
          type="button"
          onClick={onChangeExam}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted cursor-pointer"
        >
          {copy.changeExam}
        </button>
      </div>
    </div>
  );
}
