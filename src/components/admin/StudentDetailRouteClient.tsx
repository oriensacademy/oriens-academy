"use client";

import { useRouter } from "next/navigation";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { StudentDetailSheet } from "@/components/admin/StudentDetailSheet";
import { invalidateStudentData, queryKeys, useQuery } from "@/lib/data/query-store";
import { listAdminStudents } from "@/lib/admin/students";

export function StudentDetailRouteClient({ studentId }: { studentId: string }) {
  const router = useRouter();
  const { data: result, loading, refetch } = useQuery(
    `${queryKeys.adminStudents}:active`,
    () => listAdminStudents({ archived: false }),
    { staleTime: 30_000 }
  );
  const activeStudent = result?.data.find((item) => item.userId === studentId || item.id === studentId) ?? null;
  // Arşivdeki öğrenci (arşiv listesi veya genel arama) aktif listede yoktur.
  const lookInArchive = Boolean(result && !result.error && !activeStudent);
  const { data: archiveResult, loading: archiveLoading } = useQuery(
    `${queryKeys.adminStudents}:archive`,
    () => listAdminStudents({ archived: true }),
    { staleTime: 30_000, enabled: lookInArchive }
  );
  const student = activeStudent
    ?? (lookInArchive ? archiveResult?.data.find((item) => item.userId === studentId || item.id === studentId) ?? null : null);

  if ((loading && !result) || (lookInArchive && archiveLoading && !archiveResult)) {
    return <div className="flex min-h-[50vh] items-center justify-center"><AdminWaveStatus label="Öğrenci bilgileri yükleniyor…" /></div>;
  }

  if (result?.error || !student) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#E6E4DC] bg-white p-8 text-center">
        <h1 className="font-heading text-2xl font-semibold text-[#1C231E]">Öğrenci bulunamadı</h1>
        <p className="mt-2 text-sm text-[#5B635C]">{result?.error || "Bu öğrenci kaydı mevcut değil veya arşivlenmiş olabilir."}</p>
        <button type="button" onClick={() => router.push("/admin/ogrenciler")} className="mt-5 rounded-xl bg-[#10271B] px-4 py-2.5 text-sm font-semibold text-white">Öğrencilere Dön</button>
      </div>
    );
  }

  return (
    <StudentDetailSheet
      student={student}
      pageMode
      onClose={() => router.back()}
      onCreateBooking={() => undefined}
      onChanged={() => {
        invalidateStudentData();
        void refetch();
      }}
    />
  );
}
