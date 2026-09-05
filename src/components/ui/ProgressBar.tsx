import { cn } from '../../lib/cn'

export function ProgressBar({ ratio, color, className }: { ratio: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className={cn('h-2 w-full rounded-full bg-surface-2 overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }} />
    </div>
  )
}
