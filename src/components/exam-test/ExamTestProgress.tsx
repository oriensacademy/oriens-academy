export function ExamTestProgress({ current, total, label }: { current: number; total: number; label: string }) {
  const percentage = Math.round((current / total) * 100);
  return (
    <div aria-label={`${label} ${current} / ${total}`}>
      <div className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground"><span>{label} {current} / {total}</span><span>{percentage}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percentage}%` }} /></div>
    </div>
  );
}
