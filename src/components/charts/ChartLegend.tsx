import { cn } from '../../lib/cn'

export interface LegendItem {
  label: string
  color: string
  kind?: 'bar' | 'line'
}

/** 차트 아래 범례 (테마 토큰 사용, Recharts Legend 대신) */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn('inline-block', i.kind === 'line' ? 'h-0.5 w-4 rounded' : 'h-2.5 w-2.5 rounded-sm')} style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
