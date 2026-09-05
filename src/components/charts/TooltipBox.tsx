import type { ReactNode } from 'react'

export interface TooltipRow {
  label: ReactNode
  value: ReactNode
  color?: string
}

/** Recharts Tooltip content 공통 박스 (HTML, 테마 토큰만 사용) */
export function TooltipBox({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-32 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text shadow-md">
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <ul className="space-y-0.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted">
              {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />}
              {r.label}
            </span>
            <span className="tnum font-medium">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
