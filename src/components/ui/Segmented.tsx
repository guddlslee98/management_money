import { cn } from '../../lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  activeClass?: string
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; className?: string }) {
  return (
    <div role="tablist" className={cn('grid gap-1 p-1 rounded-xl bg-surface-2', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn('h-9 rounded-lg text-sm font-medium transition', active ? cn('bg-surface shadow-xs', o.activeClass ?? 'text-text') : 'text-muted hover:text-text')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
