import { currentMonthKey, formatMonthKo, type MonthKey } from '../../domain/dates'

export function MonthPicker({ month, onPrev, onNext, onToday }: { month: MonthKey; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  const isCurrent = month === currentMonthKey()
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={onPrev} aria-label="이전 달" className="h-9 w-9 rounded-full hover:bg-surface-2 text-lg">
        ‹
      </button>
      <button type="button" onClick={onToday} className="text-base font-bold tnum px-3 h-9 rounded-full hover:bg-surface-2" title="이번 달로">
        {formatMonthKo(month)}
        {!isCurrent && <span className="ml-1 text-xs font-normal text-muted">오늘</span>}
      </button>
      <button type="button" onClick={onNext} aria-label="다음 달" className="h-9 w-9 rounded-full hover:bg-surface-2 text-lg">
        ›
      </button>
    </div>
  )
}
