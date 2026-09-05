import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { amountToInput, formatAmountInput, parseAmountInput } from './helpers'

/**
 * 인라인 예산 입력. 천단위 구분자를 유지하며 입력하고, 포커스가 빠지거나 Enter를 누르면 저장한다.
 * 빈 값은 0(=예산 없음)으로 저장한다.
 */
export function BudgetAmountInput({ value, label, placeholder = '없음', className, onCommit }: { value: number; label: string; placeholder?: string; className?: string; onCommit: (amount: number) => void | Promise<void> }) {
  const [text, setText] = useState(() => amountToInput(value))
  const focused = useRef(false)
  const cancelled = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(amountToInput(value))
  }, [value])

  const commit = async () => {
    const n = parseAmountInput(text) ?? 0
    if (n !== value) await onCommit(n)
    else setText(amountToInput(value))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      // blur 가 setText 반영 전에 동기적으로 발생하므로, 취소 플래그로 onBlur 의 저장을 막는다
      cancelled.current = true
      setText(amountToInput(value))
      e.currentTarget.blur()
    }
  }

  return (
    <label className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 h-9 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25', className)}>
      <span className="text-xs text-muted" aria-hidden>
        ₩
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(formatAmountInput(e.target.value))}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          if (cancelled.current) {
            cancelled.current = false
            setText(amountToInput(value))
            return
          }
          void commit()
        }}
        onKeyDown={onKeyDown}
        className="w-24 bg-transparent text-right text-sm tnum font-semibold outline-none placeholder:text-muted/60 placeholder:font-normal"
      />
    </label>
  )
}
