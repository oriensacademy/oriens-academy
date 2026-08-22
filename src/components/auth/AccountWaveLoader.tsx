"use client";

import { Wave } from "@/components/ui/wave";

export function AccountWaveLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  return <div className={fullScreen ? "flex min-h-screen items-center justify-center bg-background" : "flex min-h-11 items-center justify-center"} role="status" aria-label="Oriens Academy"><Wave className="h-6 w-16 text-primary" aria-label="Oriens Academy" /></div>;
}
