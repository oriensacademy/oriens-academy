import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

export default function AdminLoading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center px-6 text-[#819586]">
      <AdminWaveStatus label="Yükleniyor…" className="text-sm font-medium" />
    </div>
  );
}
