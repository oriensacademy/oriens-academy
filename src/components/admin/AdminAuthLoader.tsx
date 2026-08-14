import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

export function AdminAuthLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F2] px-6 text-center antialiased">
      <div className="rounded-2xl border border-[#DDE5DC] bg-white px-8 py-7 text-[#819586] shadow-sm">
        <AdminWaveStatus
          label="Yönetim paneli hazırlanıyor..."
          className="text-sm font-semibold"
        />
      </div>
    </div>
  );
}
