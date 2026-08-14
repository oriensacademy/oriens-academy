"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Search, RefreshCw, AlertCircle, ChevronRight } from "lucide-react";
import { Wave } from "@/components/ui/wave";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { StudentDetailSheet } from "@/components/admin/StudentDetailSheet";
import { CreateBookingModal } from "@/components/admin/CreateBookingModal";
import { listAdminStudents, type StudentProfile } from "@/lib/admin/students";

type Filter = "all" | "booking" | "contact_only" | "recent";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selected, setSelected] = useState<StudentProfile | null>(null);
  const [bookingStudent, setBookingStudent] = useState<StudentProfile | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    const result = await listAdminStudents();
    setLoading(false);
    if (result.error) setError(result.error); else setStudents(result.data);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return students.filter((student) => {
      const matchesSearch = !query || [student.fullName, student.email, student.phone || ""].some((value) => value.toLocaleLowerCase("tr-TR").includes(query));
      const matchesFilter = filter === "all"
        || (filter === "booking" && student.bookings.length > 0)
        || (filter === "contact_only" && student.bookings.length === 0)
        || (filter === "recent" && new Date(student.latestActivity).getTime() >= recentCutoff);
      return matchesSearch && matchesFilter;
    });
  }, [students, search, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><Users className="size-6 text-[#819586]" /><h1 className="text-xl font-bold text-[#10271B]">Öğrenciler</h1></div><p className="mt-1 text-xs text-muted-foreground">İletişim ve randevu kayıtlarından otomatik oluşan kişi dizini.</p></div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">{loading ? <Wave className="h-3.5 w-7 text-[#819586]" /> : <RefreshCw className="size-3.5" />}Yenile</button>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, e-posta veya telefon ara…" className="w-full rounded-lg border border-input py-2 pl-9 pr-3 text-xs focus:border-[#10271B] focus:outline-hidden" /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-lg border border-input bg-white px-3 py-2 text-xs"><option value="all">Tüm kişiler</option><option value="booking">Randevusu olan</option><option value="contact_only">Yalnızca iletişim</option><option value="recent">Son 30 gün</option></select>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"><AlertCircle className="size-4" />{error}</div>}
      {loading && <div className="rounded-xl border border-border bg-white p-10"><AdminWaveStatus label="Öğrenci dizini hazırlanıyor…" /></div>}
      {!loading && !error && visible.length === 0 && <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center"><Users className="mx-auto size-7 text-muted-foreground" /><h2 className="mt-2 text-sm font-bold">Kişi bulunamadı</h2><p className="mt-1 text-xs text-muted-foreground">İletişim veya randevu kaydı geldiğinde profil otomatik görünür.</p></div>}

      {!loading && visible.length > 0 && <>
        <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
          <table className="w-full text-left text-xs"><thead className="border-b border-border bg-background-soft text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Kişi</th><th className="px-4 py-3">İlgi Alanı</th><th className="px-4 py-3">Son İletişim</th><th className="px-4 py-3">Son Randevu</th><th className="px-4 py-3">Bağlam</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{visible.map((student) => <tr key={student.id} onClick={() => setSelected(student)} className="cursor-pointer hover:bg-background-soft/70"><td className="px-4 py-3"><div className="font-semibold">{student.fullName}</div><div className="text-[11px] text-muted-foreground">{student.email} · {student.phone || "Telefon yok"}</div></td><td className="px-4 py-3">{student.interests.join(", ") || "—"}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(student.latestContact)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(student.latestAppointment)}</td><td className="px-4 py-3"><ContextBadge context={student.context} /></td><td className="px-4 py-3 text-right"><ChevronRight className="ml-auto size-4" /></td></tr>)}</tbody></table>
        </div>
        <div className="grid gap-3 md:hidden">{visible.map((student) => <button key={student.id} type="button" onClick={() => setSelected(student)} className="rounded-xl border border-border bg-white p-4 text-left"><div className="flex justify-between gap-3"><div><div className="font-semibold">{student.fullName}</div><div className="mt-1 text-[11px] text-muted-foreground">{student.email}<br />{student.phone || "Telefon yok"}</div></div><ContextBadge context={student.context} /></div><div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground"><span>Son aktivite: {formatDate(student.latestActivity)}</span><ChevronRight className="size-4" /></div></button>)}</div>
      </>}

      <StudentDetailSheet student={selected} onClose={() => setSelected(null)} onCreateBooking={() => { setBookingStudent(selected); setSelected(null); }} />
      {bookingStudent && <CreateBookingModal key={bookingStudent.id} isOpen initialName={bookingStudent.fullName} initialEmail={bookingStudent.email} initialPhone={bookingStudent.phone || ""} onClose={() => setBookingStudent(null)} onCreated={() => { setBookingStudent(null); void refresh(); }} />}
    </div>
  );
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString("tr-TR") : "—"; }
function ContextBadge({ context }: { context: StudentProfile["context"] }) { const label = context === "booking" ? "Randevulu" : context === "quick_contact" ? "Hızlı iletişim" : "İletişim"; return <span className="inline-flex shrink-0 rounded-md border border-border bg-background-soft px-2 py-0.5 text-[10px] font-semibold">{label}</span>; }
