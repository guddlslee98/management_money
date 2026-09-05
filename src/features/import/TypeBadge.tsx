import type { TxType } from '../../db/types'
import { cn } from '../../lib/cn'

const LABEL: Record<TxType, string> = { expense: '지출', income: '수입', transfer: '이체' }
const COLOR: Record<TxType, string> = { expense: 'text-expense', income: 'text-income', transfer: 'text-transfer' }

export function TypeBadge({ type, className }: { type: TxType; className?: string }) {
  return <span className={cn('inline-flex shrink-0 items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold', COLOR[type], className)}>{LABEL[type]}</span>
}
