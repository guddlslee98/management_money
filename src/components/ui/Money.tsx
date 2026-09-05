import { formatKRW, formatSigned } from '../../domain/money'
import { cn } from '../../lib/cn'

type Tone = 'income' | 'expense' | 'transfer' | 'neutral' | 'auto'

export function Money({ value, tone = 'neutral', signed = false, className }: { value: number; tone?: Tone; signed?: boolean; className?: string }) {
  const t = tone === 'auto' ? (value > 0 ? 'income' : value < 0 ? 'expense' : 'neutral') : tone
  const color = t === 'income' ? 'text-income' : t === 'expense' ? 'text-expense' : t === 'transfer' ? 'text-transfer' : 'text-text'
  return <span className={cn('tnum font-semibold', color, className)}>{signed ? formatSigned(value) : formatKRW(value)}</span>
}
