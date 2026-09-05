import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

export function PageHeader({ title, subtitle, right, back }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; back?: boolean | string }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-lg px-4 h-14 flex items-center gap-2">
        {back && (
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="-ml-2 h-9 w-9 rounded-full hover:bg-surface-2 text-lg"
          >
            ‹
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-1">{right}</div>}
      </div>
    </header>
  )
}
