export function Meter({ value, max = 10, tone }: { value: number; max?: number; tone?: 'good' | 'warn' | 'bad' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const t = tone ?? (pct >= 70 ? 'good' : pct >= 45 ? 'warn' : 'bad');
  return (
    <div className={`meter ${t}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
