"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StudentDetailRouteClient } from "@/components/admin/StudentDetailRouteClient";

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#5B635C]">Öğrenci bilgileri yükleniyor…</div>}>
      <StudentDetailRoute />
    </Suspense>
  );
}

function StudentDetailRoute() {
  const searchParams = useSearchParams();
  return <StudentDetailRouteClient studentId={searchParams.get("student") || ""} />;
}
