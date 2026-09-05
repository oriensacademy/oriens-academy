import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, X, AlertCircle, UserCheck, Search, Clock, Check, ChevronDown } from "lucide-react";
import { Wave } from "@/components/ui/wave";
import { createManualAdminBooking } from "@/lib/admin/bookings";
import { listAdminStudents, type StudentProfile } from "@/lib/admin/students";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";

const emptySubscribe = () => () => {};
function useIsHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialEmail?: string;
  initialName?: string;
  initialPhone?: string;
  initialStudentUserId?: string | null;
}

const DURATION_OPTIONS = [
  { value: 30, label: "30 dakika" },
  { value: 45, label: "45 dakika" },
  { value: 60, label: "60 dakika (1 saat)" },
  { value: 90, label: "90 dakika (1.5 saat)" },
  { value: 120, label: "120 dakika (2 saat)" },
];

function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime || !startTime.includes(":")) return "14:00";
  const [hStr, mStr] = startTime.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return "14:00";

  const total = h * 60 + m + durationMinutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function CreateBookingModal({
  isOpen,
  onClose,
  onCreated,
  initialEmail = "",
  initialName: _initialName = "",
  initialPhone: _initialPhone = "",
  initialStudentUserId = null,
}: CreateBookingModalProps) {
  const isHydrated = useIsHydrated();
  const comboboxId = useId();

  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  // Combobox state
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Form Fields
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("13:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [subject, setSubject] = useState("");
  const [sendNotification, setSendNotification] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Calculate dynamic end time
  const computedEndTime = useMemo(
    () => calculateEndTime(startTime, durationMinutes),
    [startTime, durationMinutes]
  );

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students;
    return students.filter((s) => {
      const name = (s.fullName || "").toLocaleLowerCase("tr-TR");
      const email = (s.email || "").toLocaleLowerCase("tr-TR");
      const phone = (s.phone || "").toLocaleLowerCase("tr-TR");
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [students, searchQuery]);

  // Body scroll lock & Escape handler
  useEffect(() => {
    if (!isOpen) return;
    const unlockBodyScroll = lockBodyScroll();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockBodyScroll();
    };
  }, [isOpen, onClose]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch student list when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setLoadingStudents(true);
    });
    listAdminStudents().then((res) => {
      if (!active) return;
      const list = res.data || [];
      setStudents(list);
      setLoadingStudents(false);

      // Pre-bind if student ID or email is provided
      if (initialStudentUserId || initialEmail) {
        const found = list.find(
          (s) =>
            (initialStudentUserId && (s.userId === initialStudentUserId || s.id === initialStudentUserId)) ||
            (initialEmail && s.email.toLowerCase() === initialEmail.toLowerCase())
        );
        if (found) {
          setSelectedStudent(found);
          setSearchQuery(found.fullName || found.email);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, initialStudentUserId, initialEmail]);

  if (!isOpen || !isHydrated || typeof document === "undefined") return null;

  const handleSelectStudent = (student: StudentProfile) => {
    setSelectedStudent(student);
    setSearchQuery(student.fullName || student.email);
    setIsDropdownOpen(false);
    setValidationError(null);
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setSearchQuery("");
    setIsDropdownOpen(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setValidationError(null);

    if (!selectedStudent) {
      setValidationError("Lütfen kayıtlı bir öğrenci seçin.");
      return;
    }
    if (!date) {
      setValidationError("Tarih seçilmelidir.");
      return;
    }
    if (!startTime) {
      setValidationError("Başlangıç saati gereklidir.");
      return;
    }

    setSubmitting(true);

    const lessonSubject = subject.trim()
      ? `[Ders] ${subject.trim()}`
      : `[Ders] ${selectedStudent.fullName || "Öğrenci"} Birebir Ders Seansı`;

    const { error } = await createManualAdminBooking({
      fullName: selectedStudent.fullName || "Kayıtlı Öğrenci",
      email: selectedStudent.email,
      phone: selectedStudent.phone || "",
      exam: selectedStudent.targetExam || "Genel",
      subject: lessonSubject,
      startsAt: new Date(`${date}T${startTime}:00`).toISOString(),
      endsAt: new Date(`${date}T${computedEndTime}:00`).toISOString(),
      notes: `Süre: ${durationMinutes} dakika`,
      status: "confirmed",
      privacyConsent: true,
      studentUserId: selectedStudent.userId || selectedStudent.id,
      liveMeetingUrl: null,
      eventType: "lesson",
      sendNotification,
    });

    setSubmitting(false);
    if (error) {
      setErrorMsg(error);
      return;
    }

    onCreated();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[150] min-h-[100dvh] w-screen flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-lg rounded-3xl border border-border bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-border pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-primary">
              <CalendarPlus className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Ders / Görüşme Planla</h2>
              <p className="text-[11px] text-muted-foreground">Kayıtlı öğrenci için yeni ders seansı oluşturun</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer transition-colors"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {validationError && (
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        <form noValidate onSubmit={submit} className="space-y-4">
          {/* 1. Kayıtlı Öğrenci Seç (Searchable Combobox) */}
          <div className="space-y-1.5" ref={comboboxRef}>
            <label htmlFor={comboboxId} className="flex items-center justify-between text-xs font-semibold text-ink">
              <span className="flex items-center gap-1.5">
                <UserCheck className="size-3.5 text-primary" />
                Kayıtlı Öğrenci Seç
              </span>
              {selectedStudent && (
                <button
                  type="button"
                  onClick={handleClearStudent}
                  className="text-[11px] text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                >
                  Değiştir
                </button>
              )}
            </label>

            {selectedStudent ? (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-[#F4F6F0] p-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-forest/10 font-heading text-xs font-bold text-primary">
                    {selectedStudent.fullName?.slice(0, 2).toUpperCase() || "ÖG"}
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-ink">{selectedStudent.fullName}</strong>
                    <span className="text-[11px] text-muted-foreground">{selectedStudent.email}</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  <Check className="size-3" /> Seçildi
                </span>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    id={comboboxId}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder={loadingStudents ? "Öğrenciler yükleniyor..." : "Öğrenci adı veya e-posta ile arayın..."}
                    className="w-full rounded-xl border border-input bg-white pl-9 pr-9 py-2 text-xs text-foreground outline-hidden transition-colors focus:border-primary"
                    autoComplete="off"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>

                {/* Dropdown list */}
                {isDropdownOpen && (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-xl">
                    {loadingStudents ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">Yükleniyor...</div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        {students.length === 0 ? "Kayıtlı öğrenci bulunamadı." : "Eşleşen öğrenci bulunamadı."}
                      </div>
                    ) : (
                      filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="flex w-full items-center justify-between rounded-lg p-2 text-left text-xs hover:bg-surface-muted transition-colors cursor-pointer"
                        >
                          <div>
                            <strong className="block font-semibold text-ink">{s.fullName}</strong>
                            <span className="text-[11px] text-muted-foreground">{s.email}</span>
                          </div>
                          {s.targetExam && (
                            <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {s.targetExam}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Tarih */}
          <div className="space-y-1">
            <label htmlFor="booking-date" className="block text-xs font-semibold text-ink">
              Tarih
            </label>
            <input
              id="booking-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-foreground outline-hidden transition-colors focus:border-primary"
              required
            />
          </div>

          {/* 3. Başlangıç Saati & 4. Ders Süresi + Otomatik Bitiş Saati */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="booking-start-time" className="block text-xs font-semibold text-ink">
                Başlangıç Saati
              </label>
              <input
                id="booking-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-foreground outline-hidden transition-colors focus:border-primary"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="booking-duration" className="block text-xs font-semibold text-ink">
                Ders Süresi
              </label>
              <select
                id="booking-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-foreground outline-hidden transition-colors focus:border-primary cursor-pointer"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Otomatik Bitiş Saati Kartı */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5 text-primary" />
              Hesaplanan Bitiş Saati:
            </span>
            <strong className="font-bold text-ink">
              {startTime} → {computedEndTime}
            </strong>
          </div>

          {/* 5. Ders / Konu Başlığı (İsteğe Bağlı) */}
          <div className="space-y-1">
            <label htmlFor="booking-subject" className="block text-xs font-semibold text-ink">
              Ders / Konu Başlığı <span className="font-normal text-muted-foreground">(İsteğe Bağlı)</span>
            </label>
            <input
              id="booking-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Örn: SAT Math — Fonksiyonlar ve Paraboller"
              className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-foreground outline-hidden transition-colors focus:border-primary"
            />
          </div>

          {/* E-posta ile bildir seçeneği (Default: OFF) */}
          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
                className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
              />
              <span>Hesap sahibine e-posta ile bildir</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-xs font-semibold text-white shadow-xs hover:bg-forest cursor-pointer disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <>
                  <Wave className="size-3.5 text-white" />
                  <span>Planlanıyor...</span>
                </>
              ) : (
                <>
                  <CalendarPlus className="size-3.5" />
                  <span>Dersi Planla</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
