import { formatPct, formatSigned } from '../../domain/money'
import { cn } from '../../lib/cn'

export interface DeltaBadgeProps {
  delta: number
  /** 증감률 (0~1). null이면 표시하지 않음 */
  deltaPct?: number | null
  /** 어느 방향이 좋은 변화인지 (지출은 down, 수입/순수입은 up) */
  goodWhen?: 'up' | 'down'
  /** 두 줄로 표시 (좁은 카드용) */
  stacked?: boolean
  className?: string
  title?: string
}

/** 전월 대비 증감 표시: ▲ +₩120,000 (12.3%) */
export function DeltaBadge({ delta, deltaPct, goodWhen = 'down', stacked = false, className, title }: DeltaBadgeProps) {
  const up = delta > 0
  const down = delta < 0
  const good = (up && goodWhen === 'up') || (down && goodWhen === 'down')
  const tone = delta === 0 ? 'text-muted' : good ? 'text-income' : 'text-expense'
  const arrow = up ? '▲' : down ? '▼' : '–'
  const pct = deltaPct != null ? formatPct(Math.abs(deltaPct)) : null
  if (stacked) {
    return (
      <span className={cn('tnum text-[11px] leading-tight', tone, className)} title={title}>
        <span className="block truncate">{`${arrow} ${formatSigned(delta)}`}</span>
        {pct && <span className="block text-muted">{pct}</span>}
      </span>
    )
  }
  return (
    <span className={cn('tnum text-[11px]', tone, className)} title={title}>
      {`${arrow} ${formatSigned(delta)}`}
      {pct && <span className="text-muted">{` (${pct})`}</span>}
    </span>
  )
}
