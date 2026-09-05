import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-surface border border-border p-4 shadow-xs', className)} {...rest} />
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-sm font-semibold text-muted mb-2', className)} {...rest} />
}
