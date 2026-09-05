import { UNCATEGORIZED, type Category } from '../../db/types'
import { cn } from '../../lib/cn'

export function CategoryBadge({ category, size = 'md', className }: { category: Pick<Category, 'name' | 'emoji' | 'color'> | null | undefined; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const c = category ?? UNCATEGORIZED
  const dim = size === 'lg' ? 'h-10 w-10 text-xl' : size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-base'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('inline-flex items-center justify-center rounded-full shrink-0', dim)} style={{ background: `${c.color}26`, color: c.color }} aria-hidden>
        {c.emoji}
      </span>
      <span className="truncate">{c.name}</span>
    </span>
  )
}
