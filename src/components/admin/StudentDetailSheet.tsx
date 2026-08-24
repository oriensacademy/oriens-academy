import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  CalendarPlus,
  Mail,
  Phone,
  X,
  BookOpen,
  ClipboardList,
  Package,
  Award,
  StickyNote,
  LayoutDashboard,
  KeyRound,
  Video,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { StudentLearningManager, type LearningSection } from "@/components/admin/StudentLearningManager";
import { completeStudentAppointment } from "@/lib/admin/student-learning";
import { updateAdminBookingStatus } from "@/lib/admin/bookings";
import { sendStudentPasswordReset, type StudentProfile } from "@/lib/admin/students";
import { formatExamBadges, formatDestinationBadges } from "@/lib/student/preferences";

type Tab = "overview" | "education" | "homework" | "packages" | "exam_history" | "notes";
const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Genel", icon: LayoutDashboard },
  { id: "education", label: "Eğitim", icon: BookOpen },
  { id: "homework", label: "Ödevler", icon: ClipboardList },
  { id: "packages", label: "Paket & Ödeme", icon: Package },
  { id: "exam_history", label: "Sınavlar", icon: Award },
  { id: "notes", label: "Notlar", icon: StickyNote },
];

export function StudentDetailSheet({
  student,
  onClose,
  onCreateBooking,
  onChanged,
}: {
  student: StudentProfile | null;
  onClose: () => void;
  onCreateBooking: () => void;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, startResetTransition] = useTransition();

  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  useEffect(() => {
    if (!student) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (resetModalOpen) setResetModalOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [student, onClose, resetModalOpen]);

  if (!student || !mounted || typeof document === "undefined") return null;

  const handlePasswordReset = () => {
    startResetTransition(async () => {
      setMessage("");
      setErrorMessage("");
      const res = await sendStudentPasswordReset(student.email, (student.preferredLanguage as "tr" | "en") || "tr");
      if (res.success) {
        setMessage(`Şifre sıfırlama bağlantısı başarıyla ${student.email} adresine iletildi.`);
        setResetModalOpen(false);
      } else {
        setErrorMessage(res.error || "Şifre sıfırlama bağlantısı gönderilemedi.");
      }
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
      {/* Fixed backdrop - clicking backdrop does NOT accidentally close the modal */}
      <div className="fixed inset-0 bg-ink/55 backdrop-blur-xs transition-opacity cursor-default" />

      <div className="relative z-10 flex h-[min(900px,92vh)] w-[min(1280px,94vw)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <header className="shrink-0 border-b border-border bg-surface px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-forest/10 font-heading text-lg font-bold text-primary">
                {student.fullName?.slice(0, 2).toUpperCase() || "ÖG"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="student-detail-title" className="font-heading text-xl font-bold text-ink">{student.fullName}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      student.active
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border border-red-300 bg-red-50 text-red-800"
                    }`}
                  >
                    {student.active ? "Aktif Öğrenci" : "Pasif"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {student.email} · {student.phone || "Telefon belirtilmemiş"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink cursor-pointer"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav aria-label="Öğrenci detay bölümleri" className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    tab === item.id
                      ? "border-primary bg-primary text-white shadow-xs"
                      : "border-border bg-white text-muted-foreground hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
          {message && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
              <span>{message}</span>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium animate-in fade-in">
              <AlertCircle className="size-4 shrink-0 text-red-700" />
              <span>{errorMessage}</span>
            </div>
          )}

          {tab === "overview" && (
            <Overview
              student={student}
              onCreateBooking={onCreateBooking}
              onOpenPasswordReset={() => {
                setErrorMessage("");
                setResetModalOpen(true);
              }}
            />
          )}

          {tab === "education" && (
            <Appointments
              student={student}
              onCreateBooking={onCreateBooking}
              onDone={(text) => {
                setMessage(text);
                onChanged?.();
              }}
            />
          )}

          {tab === "packages" && student.userId && (
            <div className="space-y-6">
              <StudentLearningManager userId={student.userId} section="packages" onChanged={onChanged} />
              <StudentLearningManager userId={student.userId} section="payments" onChanged={onChanged} />
            </div>
          )}

          {(["homework", "exam_history", "notes"] as Tab[]).includes(tab) && student.userId && (
            <StudentLearningManager
              userId={student.userId}
              studentName={student.fullName}
              section={tab as LearningSection}
              onChanged={onChanged}
            />
          )}

          {(["education", "homework", "packages", "exam_history", "notes"] as Tab[]).includes(tab) && !student.userId && (
            <NoAccount />
          )}
        </div>
      </div>

      {/* Password Reset Confirmation Dialog */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="alertdialog">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="font-heading text-base font-bold text-ink">Şifre Sıfırlama Bağlantısı</h3>
                <p className="text-xs text-muted-foreground">{student.fullName}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/60 p-3.5 text-xs text-ink/80 space-y-2">
              <p>
                <strong>{student.email}</strong> adresine güvenli şifre sıfırlama bağlantısı gönderilecektir.
              </p>
              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0 text-emerald-700 mt-0.5" />
                <span>
                  Yönetici panelinde hiçbir düz metin geçici şifre oluşturulmaz veya görüntülenmez. Öğrenci kendi şifresini güvenle belirler.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setResetModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handlePasswordReset}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
              >
                <KeyRound className="size-3.5" />
                {isResetting ? "Gönderiliyor..." : "Bağlantıyı Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function Overview({
  student,
  onCreateBooking,
  onOpenPasswordReset,
}: {
  student: StudentProfile;
  onCreateBooking: () => void;
  onOpenPasswordReset: () => void;
}) {
  const val = (input: string | null | undefined) => input?.trim() || "Belirtilmemiş";
  const examBadges = formatExamBadges(
    student.targetExams && student.targetExams.length > 0
      ? student.targetExams
      : student.targetExam
      ? [student.targetExam]
      : []
  );
  const countryBadges = formatDestinationBadges(
    student.targetCountries && student.targetCountries.length > 0
      ? student.targetCountries
      : student.targetCountry
      ? [student.targetCountry]
      : []
  );

  return (
    <div className="space-y-6">
      {/* KİŞİSEL BİLGİLER (READ-ONLY) */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Kişisel Bilgiler
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Ad Soyad" value={val(student.fullName)} />
          <Info label="E-posta" value={val(student.email)} />
          <Info label="Telefon" value={val(student.phone)} />
          <div className="rounded-xl border border-border bg-background-soft/50 p-3">
            <span className="block text-[9px] uppercase text-muted-foreground font-semibold">Öğrenci Durumu</span>
            <div className="mt-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  student.active
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border border-red-300 bg-red-50 text-red-800"
                }`}
              >
                {student.active ? "Aktif Öğrenci" : "Pasif"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* AKADEMİK PROFİL (READ-ONLY) */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Akademik Profil
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Okul" value={val(student.school)} />
          <Info label="Hedef Üniversite" value={val(student.targetUniversity)} />
          <Info
            label="Tercih Edilen Dil"
            value={student.preferredLanguage === "en" ? "English" : "Türkçe"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background-soft/50 p-3.5 space-y-1.5">
            <span className="block text-[9px] uppercase font-semibold text-muted-foreground">Hedef Sınavlar</span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {examBadges.length > 0 ? (
                examBadges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                  >
                    {b}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Belirtilmemiş</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background-soft/50 p-3.5 space-y-1.5">
            <span className="block text-[9px] uppercase font-semibold text-muted-foreground">Hedef Ülkeler</span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {countryBadges.length > 0 ? (
                countryBadges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                  >
                    {b}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Belirtilmemiş</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PAKET VE RANDEVU ÖZETİ */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Eğitim & Aktivite Özeti
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Aktif Paket" value={student.activePackage?.name || "Tanımlı Paket Yok"} />
          <Info
            label="Kalan Ders"
            value={
              student.activePackage
                ? `${Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed)} ders`
                : "—"
            }
          />
          <Info label="Bekleyen Ödev" value={`${student.pendingHomework} ödev`} />
          <Info label="Sonraki Randevu" value={date(student.nextAppointment)} />
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <a href={`mailto:${student.email}`} className={action}>
          <Mail className="size-4" />
          E-posta Gönder
        </a>
        {student.phone && (
          <a href={`tel:${student.phone}`} className={action}>
            <Phone className="size-4" />
            Ara
          </a>
        )}
        <button
          onClick={onCreateBooking}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors"
        >
          <CalendarPlus className="size-4" />
          Ders / Görüşme Planla
        </button>
        <button
          onClick={onOpenPasswordReset}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer transition-colors"
        >
          <KeyRound className="size-4 text-amber-700" />
          Şifre Sıfırlama Bağlantısı Gönder
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface-muted/40 p-4">
        <h4 className="text-xs font-bold text-ink">Etkileşim Kayıtları</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {student.contacts.length} iletişim talebi · {student.bookings.length} randevu / ders seansı · {student.deliveries.length} bildirim teslimatı
        </p>
      </div>
    </div>
  );
}

function Appointments({
  student,
  onCreateBooking,
  onDone,
}: {
  student: StudentProfile;
  onCreateBooking: () => void;
  onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function finish(id: string, asLesson: boolean) {
    setBusy(id);
    setError("");
    if (asLesson) {
      const r = await completeStudentAppointment({
        bookingId: id,
        packagePurchaseId: student.activePackage?.id || null,
        title: `${student.targetExam || "Akademik"} dersi`,
        subject: student.targetExam || "Genel akademik çalışma",
        examCode: student.targetExam || "",
        durationMinutes: 60,
        teacherNote: "",
      });
      if (r.error) setError(r.error);
      else
        onDone(
          r.alreadyCompleted
            ? "Bu randevu daha önce ders olarak tamamlanmış; paket yeniden düşülmedi."
            : "Randevu tamamlandı, ders geçmişi ve paket kullanımı işlendi."
        );
    } else {
      const r = await updateAdminBookingStatus(id, "completed");
      if (r.error) setError(r.error);
      else onDone("Randevu ders/paket kaydı oluşturmadan tamamlandı.");
    }
    setBusy("");
  }

  const upcoming = student.bookings.filter((b) => !["completed", "cancelled", "no_show"].includes(b.status));
  const past = student.bookings.filter((b) => ["completed", "cancelled", "no_show"].includes(b.status));

  return (
    <div className="space-y-5">
      {/* Top Header with ONE single CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-ink">Ders & Randevu Yönetimi</h3>
          <p className="text-xs text-muted-foreground">
            Öğrencinin yaklaşan ve geçmiş ders/görüşme seanslarını görüntüleyin ve yeni seans planlayın.
          </p>
        </div>
        <button
          onClick={onCreateBooking}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors shadow-xs"
        >
          <CalendarPlus className="size-4" />
          Ders / Görüşme Planla
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Yaklaşan Ders & Randevular */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Yaklaşan Ders / Randevular ({upcoming.length})
        </h4>
        {upcoming.length > 0 ? (
          upcoming.map((b) => {
            const hasMeetingLink = Boolean(b.live_meeting_url);
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-surface p-4 text-xs space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-ink">
                        {b.appointment_subject || b.exam_code || b.custom_exam || "Birebir Seans"}
                      </strong>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        {b.status === "confirmed" ? "Onaylandı" : b.status === "pending" ? "Bekliyor" : b.status}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {date(b.availability_slots?.starts_at || b.created_at)}
                      {b.availability_slots?.ends_at ? ` — ${new Date(b.availability_slots.ends_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={busy === b.id}
                      onClick={() => void finish(b.id, false)}
                      className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer disabled:opacity-50"
                    >
                      Yalnız randevuyu tamamla
                    </button>
                    {student.userId && (
                      <button
                        disabled={busy === b.id}
                        onClick={() => void finish(b.id, true)}
                        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer disabled:opacity-50"
                      >
                        Ders olarak tamamla (Paketten Düş)
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Meeting URL Box */}
                {hasMeetingLink && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-forest/5 p-3">
                    <div className="flex items-center gap-2 text-ink">
                      <Video className="size-4 text-primary" />
                      <span className="font-semibold">Görüşme Bağlantısı:</span>
                      <a
                        href={b.live_meeting_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-primary underline break-all flex items-center gap-1 hover:text-forest"
                      >
                        {b.live_meeting_url}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </div>
                    <a
                      href={b.live_meeting_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest"
                    >
                      <Video className="size-3.5" />
                      Görüşmeye Katıl
                    </a>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-surface-muted/30">
            Yaklaşan planlanmış ders veya randevu bulunmuyor.
          </div>
        )}
      </div>

      {/* Geçmiş Ders & Randevular */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Geçmiş Ders / Randevular ({past.length})
        </h4>
        {past.length > 0 ? (
          past.map((b) => (
            <div key={b.id} className="rounded-2xl border border-border bg-surface p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-ink">
                    {b.appointment_subject || b.exam_code || b.custom_exam || "Birebir Seans"}
                  </strong>
                  <p className="mt-0.5 text-muted-foreground">
                    {date(b.availability_slots?.starts_at || b.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    b.status === "completed"
                      ? "bg-emerald-100 text-emerald-800"
                      : b.status === "cancelled"
                      ? "bg-neutral-200 text-neutral-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {b.status === "completed" ? "Tamamlandı" : b.status === "cancelled" ? "İptal Edildi" : b.status === "no_show" ? "Gelmedi" : b.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-surface-muted/30">
            Geçmiş seans kaydı bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}

function NoAccount() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-900 leading-relaxed">
      Bu kişi henüz doğrulanmış bir öğrenci hesabına bağlı değil. Ders, ödev, paket, ödeme ve özel not işlevleri öğrenci
      hesabı oluşturulduktan sonra açılır.
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background-soft/50 p-3">
      <span className="block text-[9px] uppercase font-semibold text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-words text-xs text-ink">{value}</strong>
    </div>
  );
}

const action =
  "inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer";

function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
    : "—";
}
