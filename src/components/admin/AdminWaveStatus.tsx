import { Wave } from "@/components/ui/wave";
import { cn } from "@/lib/utils";

export function AdminWaveStatus({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center gap-2", className)} role="status" aria-label={label}>
      <Wave className="h-4 w-8 text-current motion-reduce:hidden" aria-label={label} />
      <span>{label}</span>
    </span>
  );
}
