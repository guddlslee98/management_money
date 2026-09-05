import { cn } from '../../lib/cn'

const IMPORT_STEPS = ['파일 선택', '열 매핑', '미리보기', '완료'] as const

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1" aria-label="가져오기 단계">
      {IMPORT_STEPS.map((label, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'active' : 'todo'
        return (
          <li key={label} className="flex items-center gap-1 flex-1 min-w-0" aria-current={state === 'active' ? 'step' : undefined}>
            <span
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                state === 'active' && 'bg-accent text-white',
                state === 'done' && 'bg-accent-soft text-accent',
                state === 'todo' && 'bg-surface-2 text-muted',
              )}
            >
              {state === 'done' ? '✓' : n}
            </span>
            <span className={cn('text-xs truncate', state === 'active' ? 'font-semibold text-text' : 'text-muted')}>{label}</span>
            {i < IMPORT_STEPS.length - 1 && <span className="flex-1 h-px bg-border mx-1" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
