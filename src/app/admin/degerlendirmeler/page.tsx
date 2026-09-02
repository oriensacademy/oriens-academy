"use client";

import { MessageSquareQuote } from "lucide-react";
import { TestimonialsManager } from "@/components/admin/TestimonialsManager";

export default function AdminEvaluationsPage() {
  return (
    <div className="space-y-6 pb-12">
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-primary">
            <MessageSquareQuote className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink font-heading">
              Değerlendirmeler
            </h1>
            <p className="text-xs text-muted-foreground">
              Öğrenci ve veli yorumlarını, öne çıkan değerlendirmeleri yönetin.
            </p>
          </div>
        </div>
      </header>

      <TestimonialsManager />
    </div>
  );
}
