"use client";

import { ListChecks } from "lucide-react";
import { AssignedHomeworkList } from "@/components/admin/homework/AssignedHomeworkList";

export default function AdminEvaluationsPage() {
  return (
    <div className="space-y-6 pb-12">
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-primary">
            <ListChecks className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink font-heading">
              Değerlendirmeler / Evaluations
            </h1>
            <p className="text-xs text-muted-foreground">
              Gönderilmiş öğrenci çalışmalarını inceleyin ve geri bildirim kaydedin.
            </p>
          </div>
        </div>
      </header>

      <AssignedHomeworkList filterSubmissionsOnly />
    </div>
  );
}
