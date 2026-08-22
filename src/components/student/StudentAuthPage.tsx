"use client";

import { Suspense } from "react";
import { UnifiedLoginPage } from "@/components/auth/UnifiedLoginPage";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";

export function StudentAuthPage() {
  return (
    <Suspense fallback={<AccountWaveLoader />}>
      <UnifiedLoginPage />
    </Suspense>
  );
}

export default StudentAuthPage;
