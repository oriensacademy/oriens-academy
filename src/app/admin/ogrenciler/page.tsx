"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, RefreshCw, Search, Users } from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { CreateBookingModal } from "@/components/admin/CreateBookingModal";
import { StudentDetailSheet } from "@/components/admin/StudentDetailSheet";
import { listAdminStudents, type StudentProfile } from "@/lib/admin/students";

type StatusFilter = "all" | "active" | "inactive";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selected, setSelected] = useState<StudentProfile | null>(null);
  const [bookingStudent, setBookingStudent] = useState<StudentProfile | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [exam, setExam] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => { setLoading(true); setError(""); const result = await listAdminStudents(); setStudents(result.data); setError(result.error || ""); setLoading(false); }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const exams = useMemo(() => [...new Set(students.map((s) => s.targetExam).filter(Boolean) as string[])].sort(), [students]);
  const packages = useMemo(() => [...new Set(students.map((s) => s.activePackage?.name).filter(Boolean) as string[])].sort(), [students]);
  const visible = useMemo(() => { const query = search.trim().toLocaleLowerCase("tr-TR"); return students.filter((student) => {
    const searchable = [student.fullName, student.email, student.phone || ""].join(" ").toLocaleLowerCase("tr-TR");
    return (!query || searchable.includes(query)) && (status === "all" || (status === "active" ? student.active : !student.active)) && (exam === "all" || student.targetExam === exam) && (packageFilter === "all" || (packageFilter === "none" ? !student.activePackage : student.activePackage?.name === packageFilter));
  }); }, [students, search, status, exam, packageFilter]);

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Users className="size-6 text-primary"/><h1 className="text-xl font-bold text-ink">Öğrenci CRM</h1></div><p className="mt-1 text-xs text-muted-foreground">Öğrenci, randevu, ders, ödev, paket ve ödeme süreçlerini tek profilden yönetin.</p></div><button onClick={refresh} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw className="size-3.5"/>Yenile</button></header>
    <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_160px_180px_180px]"><label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><span className="sr-only">Öğrenci ara</span><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Ad, e-posta veya telefon ara…" className="min-h-9 w-full rounded-lg border border-input pl-9 pr-3 text-xs focus:border-primary focus:outline-hidden"/></label><Filter value={status} onChange={(value)=>setStatus(value as StatusFilter)}><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="inactive">Pasif</option></Filter><Filter value={exam} onChange={setExam}><option value="all">Tüm sınavlar</option>{exams.map((item)=><option key={item}>{item}</option>)}</Filter><Filter value={packageFilter} onChange={setPackageFilter}><option value="all">Tüm paketler</option><option value="none">Paketi olmayan</option>{packages.map((item)=><option key={item}>{item}</option>)}</Filter></div>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"><AlertCircle className="size-4"/>{error}</div>}
    {loading ? <div className="rounded-xl border border-border bg-white p-10"><AdminWaveStatus label="Öğrenciler yükleniyor…"/></div> : visible.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">Filtrelerle eşleşen öğrenci bulunamadı.</div> : <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white lg:block"><table className="w-full min-w-[1180px] text-left text-xs"><thead className="border-b border-border bg-background-soft text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Öğrenci</th><th className="px-4 py-3">Hedef sınav</th><th className="px-4 py-3">Aktif paket</th><th className="px-4 py-3">Kalan ders</th><th className="px-4 py-3">Son randevu</th><th className="px-4 py-3">Sonraki randevu</th><th className="px-4 py-3">Durum</th><th/></tr></thead><tbody className="divide-y divide-border">{visible.map((student)=><tr key={student.id} onClick={()=>setSelected(student)} className="cursor-pointer hover:bg-background-soft/70"><td className="px-4 py-3"><strong className="block text-ink">{student.fullName}</strong><span className="text-[10px] text-muted-foreground">{student.email} · {student.phone || "Telefon yok"}</span></td><td className="px-4 py-3">{student.targetExam || "—"}</td><td className="px-4 py-3">{student.activePackage?.name || "—"}</td><td className="px-4 py-3 font-semibold">{student.activePackage ? Math.max(0,student.activePackage.lessonCount-student.activePackage.lessonsUsed) : "—"}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(student.latestAppointment)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(student.nextAppointment,true)}</td><td className="px-4 py-3"><Status active={student.active}/></td><td className="px-4 py-3"><ChevronRight className="ml-auto size-4"/></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 lg:hidden">{visible.map((student)=><button key={student.id} onClick={()=>setSelected(student)} className="rounded-xl border border-border bg-white p-4 text-left"><div className="flex justify-between gap-3"><div><strong className="block text-sm text-ink">{student.fullName}</strong><span className="text-[11px] text-muted-foreground">{student.email}<br/>{student.phone || "Telefon yok"}</span></div><Status active={student.active}/></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]"><Datum label="Hedef" value={student.targetExam||"—"}/><Datum label="Paket" value={student.activePackage?.name||"—"}/><Datum label="Kalan ders" value={student.activePackage ? String(Math.max(0,student.activePackage.lessonCount-student.activePackage.lessonsUsed)) : "—"}/><Datum label="Sonraki randevu" value={formatDate(student.nextAppointment,true)}/></div></button>)}</div>
    </>}
    <StudentDetailSheet student={selected} onClose={()=>setSelected(null)} onChanged={()=>void refresh()} onCreateBooking={()=>{setBookingStudent(selected);setSelected(null);}}/>
    {bookingStudent && <CreateBookingModal key={bookingStudent.id} isOpen initialName={bookingStudent.fullName} initialEmail={bookingStudent.email} initialPhone={bookingStudent.phone||""} initialStudentUserId={bookingStudent.userId} onClose={()=>setBookingStudent(null)} onCreated={()=>{setBookingStudent(null);void refresh();}}/>}
  </div>;
}
function Filter({value,onChange,children}:{value:string;onChange:(value:string)=>void;children:React.ReactNode}){return <select value={value} onChange={(e)=>onChange(e.target.value)} className="min-h-9 rounded-lg border border-input bg-white px-3 text-xs focus:border-primary focus:outline-hidden">{children}</select>}
function Status({active}:{active:boolean}){return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${active?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-border bg-surface-muted text-muted-foreground"}`}>{active?"Aktif":"Pasif"}</span>}
function Datum({label,value}:{label:string;value:string}){return <div><span className="block text-[9px] uppercase text-muted-foreground">{label}</span><span className="font-semibold text-ink">{value}</span></div>}
function formatDate(value:string|null,withTime=false){return value?new Date(value).toLocaleString("tr-TR",withTime?{dateStyle:"short",timeStyle:"short"}:{dateStyle:"short"}):"—"}
