"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ChevronRight, RefreshCw, Search, Users } from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { CreateBookingModal } from "@/components/admin/CreateBookingModal";
import { StudentDetailSheet } from "@/components/admin/StudentDetailSheet";
import { listAdminStudents, type StudentProfile } from "@/lib/admin/students";
import { formatExamBadges, formatDestinationBadges } from "@/lib/student/preferences";

type StatusFilter = "all" | "active" | "inactive";

export default function AdminStudentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Öğrenci paneli yükleniyor…</div>}>
      <AdminStudentsContent />
    </Suspense>
  );
}

function AdminStudentsContent() {
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selected, setSelected] = useState<StudentProfile | null>(null);
  const [bookingStudent, setBookingStudent] = useState<StudentProfile | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [exam, setExam] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const targetStudentId = searchParams.get("student");
  const initialSearchParam = searchParams.get("search");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listAdminStudents();
    setStudents(result.data);
    setError(result.error || "");
    setLoading(false);
  }, []);

  // Background reconciliation after a mutation inside the (already showing
  // its own optimistic update) detail sheet -- deliberately does not toggle
  // the page-level loading state, and re-syncs the open `selected` student
  // so a still-open sheet doesn't keep pointing at stale data (see "DERS
  // İPTAL UI STATE BUG" / "DERS PLANLAMA PERFORMANSI").
  const syncAfterChange = useCallback(async () => {
    const result = await listAdminStudents();
    setStudents(result.data);
    setSelected((current) => {
      if (!current) return current;
      return result.data.find((s) => s.id === current.id) || current;
    });
  }, []);

  useEffect(() => {
    let active = true;
    listAdminStudents().then((result) => {
      if (!active) return;
      setStudents(result.data);
      setError(result.error || "");
      setLoading(false);

      // Deep link resolution
      if (targetStudentId) {
        const found = result.data.find((s) => s.id === targetStudentId);
        if (found) setSelected(found);
      } else if (initialSearchParam) {
        const found = result.data.find(
          (s) => s.email.toLowerCase() === initialSearchParam.toLowerCase() || s.fullName.toLowerCase() === initialSearchParam.toLowerCase()
        );
        if (found) setSelected(found);
      }
    });
    return () => {
      active = false;
    };
  }, [targetStudentId, initialSearchParam]);

  // Collect all unique exams across multi-select arrays and single fields
  const exams = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.targetExams && s.targetExams.length > 0) {
        s.targetExams.forEach((e) => set.add(e));
      } else if (s.targetExam) {
        set.add(s.targetExam);
      }
    });
    return [...set].sort();
  }, [students]);

  const packages = useMemo(
    () => [...new Set(students.map((s) => s.activePackage?.name).filter(Boolean) as string[])].sort(),
    [students]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    return students.filter((student) => {
      const searchable = [
        student.fullName,
        student.email,
        ...(student.targetExams || []),
        ...(student.targetCountries || []),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus = status === "all" || (status === "active" ? student.active : !student.active);

      // Multi-exam filter matching: student matches if selected exam is in targetExams array or equals targetExam
      const matchesExam =
        exam === "all" ||
        (student.targetExams && student.targetExams.includes(exam)) ||
        student.targetExam === exam;

      const matchesPackage =
        packageFilter === "all" ||
        (packageFilter === "none" ? !student.activePackage : student.activePackage?.name === packageFilter);

      return matchesSearch && matchesStatus && matchesExam && matchesPackage;
    });
  }, [students, search, status, exam, packageFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-6 text-primary" />
            <h1 className="text-xl font-bold text-ink">Kullanıcılar</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Kullanıcı, hedef sınavlar, randevu, ders, ödev, paket ve ödeme süreçlerini tek profilden yönetin.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" />
          Yenile
        </button>
      </header>

      <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_160px_180px_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <span className="sr-only">Kullanıcı ara</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, e-posta veya hedef sınav ara…"
            className="min-h-9 w-full rounded-lg border border-input pl-9 pr-3 text-xs focus:border-primary focus:outline-hidden"
          />
        </label>
        <Filter value={status} onChange={(value) => setStatus(value as StatusFilter)}>
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </Filter>
        <Filter value={exam} onChange={setExam}>
          <option value="all">Tüm sınavlar</option>
          {exams.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Filter>
        <Filter value={packageFilter} onChange={setPackageFilter}>
          <option value="all">Tüm paketler</option>
          <option value="none">Paketi olmayan</option>
          {packages.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Filter>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-white p-10">
          <AdminWaveStatus label="Öğrenciler yükleniyor…" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
          Filtrelerle eşleşen öğrenci bulunamadı.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-white lg:block">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Öğrenci</th>
                  <th className="px-4 py-3">Hedef Sınavlar</th>
                  <th className="px-4 py-3">Hedef Ülkeler</th>
                  <th className="px-4 py-3">Aktif Paket</th>
                  <th className="px-4 py-3">Kalan Ders</th>
                  <th className="px-4 py-3">Son Randevu</th>
                  <th className="px-4 py-3">Sonraki Randevu</th>
                  <th className="px-4 py-3">Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((student) => {
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
                    <tr
                      key={student.id}
                      onClick={() => setSelected(student)}
                      className="cursor-pointer hover:bg-background-soft/70"
                    >
                      <td className="px-4 py-3">
                        <strong className="block text-ink">{student.fullName}</strong>
                        <span className="text-[10px] text-muted-foreground">{student.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        {examBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {examBadges.map((b) => (
                              <span
                                key={b}
                                className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {countryBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {countryBadges.map((b) => (
                              <span
                                key={b}
                                className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{student.activePackage?.name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">
                        {student.activePackage
                          ? Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(student.latestAppointment)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(student.nextAppointment, true)}</td>
                      <td className="px-4 py-3">
                        <Status active={student.active} />
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="ml-auto size-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {visible.map((student) => {
              const examBadges = formatExamBadges(
                student.targetExams && student.targetExams.length > 0
                  ? student.targetExams
                  : student.targetExam
                  ? [student.targetExam]
                  : []
              );

              return (
                <button
                  key={student.id}
                  onClick={() => setSelected(student)}
                  className="rounded-xl border border-border bg-white p-4 text-left"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <strong className="block text-sm text-ink">{student.fullName}</strong>
                      <span className="text-[11px] text-muted-foreground">{student.email}</span>
                    </div>
                    <Status active={student.active} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
                    <div>
                      <span className="block text-[9px] uppercase text-muted-foreground">Hedefler</span>
                      <span className="font-semibold text-ink">
                        {examBadges.length > 0 ? examBadges.join(", ") : "—"}
                      </span>
                    </div>
                    <Datum label="Paket" value={student.activePackage?.name || "—"} />
                    <Datum
                      label="Kalan ders"
                      value={
                        student.activePackage
                          ? String(Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed))
                          : "—"
                      }
                    />
                    <Datum label="Sonraki randevu" value={formatDate(student.nextAppointment, true)} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <StudentDetailSheet
        key={selected?.id || "closed"}
        student={bookingStudent ? null : selected}
        onClose={() => setSelected(null)}
        onChanged={() => void syncAfterChange()}
        onCreateBooking={() => {
          setBookingStudent(selected);
        }}
      />

      {bookingStudent && (
        <CreateBookingModal
          key={bookingStudent.id}
          isOpen
          initialName={bookingStudent.fullName}
          initialEmail={bookingStudent.email}
          initialPhone={bookingStudent.phone || ""}
          initialStudentUserId={bookingStudent.userId}
          onClose={() => setBookingStudent(null)}
          onCreated={async () => {
            const currentSelected = selected;
            setBookingStudent(null);
            const res = await listAdminStudents();
            setStudents(res.data);
            if (currentSelected) {
              const updated = res.data.find((s) => s.id === currentSelected.id);
              if (updated) setSelected(updated);
            }
          }}
        />
      )}
    </div>
  );
}

function Filter({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-9 rounded-lg border border-input bg-white px-3 text-xs focus:border-primary focus:outline-hidden"
    >
      {children}
    </select>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-border bg-surface-muted text-muted-foreground"
      }`}
    >
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[9px] uppercase text-muted-foreground">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function formatDate(value: string | null, withTime = false) {
  return value
    ? new Date(value).toLocaleString("tr-TR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" })
    : "—";
}
