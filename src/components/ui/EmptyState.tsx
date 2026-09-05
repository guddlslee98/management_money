import type { ReactNode } from 'react'

export function EmptyState({ emoji = '🗒️', title, description, action }: { emoji?: string; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-2" aria-hidden>
        {emoji}
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-muted mt-1">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
