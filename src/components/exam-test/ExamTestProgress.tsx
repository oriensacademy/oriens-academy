export function ExamTestProgress({ current, total, label }: { current: number; total: number; label: string }) {
  const safeTotal = Math.max(1, Number.isFinite(total) ? total : 6);
  const safeCurrent = Math.max(0, Number.isFinite(current) ? current : 0);
  const percentage = Math.min(100, Math.max(0, Math.round((safeCurrent / safeTotal) * 100)));

  return (
    <div aria-label={`${label} ${safeCurrent} / ${safeTotal}`}>
      <div className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground">
        <span>{label} {safeCurrent} / {safeTotal}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
