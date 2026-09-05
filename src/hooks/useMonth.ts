import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { addMonths, currentMonthKey, isMonthKey, type MonthKey } from '../domain/dates'

/** URL의 ?m=YYYY-MM 로 선택 월을 관리한다 (뒤로가기·공유 가능) */
export function useMonth(): { month: MonthKey; setMonth: (m: MonthKey) => void; prev: () => void; next: () => void; today: () => void } {
  const [params, setParams] = useSearchParams()
  const raw = params.get('m')
  const month = raw && isMonthKey(raw) ? raw : currentMonthKey()
  const setMonth = useCallback(
    (m: MonthKey) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('m', m)
          return n
        },
        { replace: true },
      )
    },
    [setParams],
  )
  return {
    month,
    setMonth,
    prev: () => setMonth(addMonths(month, -1)),
    next: () => setMonth(addMonths(month, 1)),
    today: () => setMonth(currentMonthKey()),
  }
}
