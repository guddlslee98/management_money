import type { InputHTMLAttributes, Ref } from 'react'
import { formatNumber } from '../../domain/money'
import { cn } from '../../lib/cn'
import { formatAmountInput } from './formatAmountInput'

export interface AmountInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode' | 'size'> {
  /** 정수 원. null이면 비어 있음 */
  value: number | null
  onChange: (value: number | null) => void
  size?: 'lg' | 'md'
  /** React 19: ref는 일반 prop으로 전달된다 */
  ref?: Ref<HTMLInputElement>
}

/** 큰 숫자 입력칸. 입력 중에도 천단위 구분자를 보여주고 값은 항상 정수(원)로 넘긴다. */
export function AmountInput({ value, onChange, size = 'lg', className, placeholder = '0', ref, ...rest }: AmountInputProps) {
  const display = value === null ? '' : formatNumber(value)
  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9,]*"
        value={display}
        placeholder={placeholder}
        onChange={(e) => onChange(formatAmountInput(e.target.value).value)}
        className={cn(
          'w-full rounded-xl border border-border bg-surface pl-3 pr-10 text-right tnum text-text placeholder:text-muted/50 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60',
          size === 'lg' ? 'h-16 text-3xl font-bold' : 'h-11 text-base',
          className,
        )}
        {...rest}
      />
      <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-muted', size === 'lg' ? 'text-base' : 'text-sm')} aria-hidden>
        원
      </span>
    </div>
  )
}
