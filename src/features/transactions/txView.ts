/**
 * 거래 목록/폼 화면용 순수 헬퍼. (domain/ 은 다른 작업과 충돌을 피하려고 건드리지 않고 여기 둔다)
 */
import { effectiveAmount, type Transaction, type TxType } from '../../db/types'
import { dateInMonth, dateKeyOf, isDateKey, isMonthKey, todayKey, type DateKey } from '../../domain/dates'

export type TxFilter = 'all' | TxType

export interface DayGroup {
  date: DateKey
  /** 그 날 지출 합계 (환불 차감, 이체 제외) */
  expenseTotal: number
  items: Transaction[]
}

/** 같은 날짜끼리 묶는다. 입력 순서를 유지하므로 날짜 내림차순 배열을 주면 그대로 내림차순이다. O(n) */
export function groupByDate(txs: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = []
  const index = new Map<string, DayGroup>()
  for (const tx of txs) {
    let g = index.get(tx.date)
    if (!g) {
      g = { date: tx.date, expenseTotal: 0, items: [] }
      index.set(tx.date, g)
      groups.push(g)
    }
    g.items.push(tx)
    if (tx.type === 'expense') g.expenseTotal += effectiveAmount(tx)
  }
  return groups
}

/** 종류 필터 + 거래처/메모 부분 일치(대소문자 무시) */
export function filterTransactions(txs: Transaction[], filter: TxFilter, query: string): Transaction[] {
  const q = query.trim().toLowerCase()
  if (filter === 'all' && !q) return txs
  return txs.filter((t) => (filter === 'all' || t.type === filter) && (!q || t.payee.toLowerCase().includes(q) || t.memo.toLowerCase().includes(q)))
}

/** 목록에 부호를 붙여 보여줄 금액: 지출 -, 수입 +, 환불/반환은 반대 부호, 이체는 그대로 */
export function displayAmount(tx: Pick<Transaction, 'type' | 'amount' | 'isRefund'>): number {
  if (tx.type === 'transfer') return tx.amount
  const v = effectiveAmount(tx)
  return tx.type === 'expense' ? -v : v
}

/** 날짜에 n일을 더한다 (로컬 달력 기준) */
export function addDays(date: DateKey, n: number): DateKey {
  const [y, m, d] = date.split('-').map(Number)
  return dateKeyOf(new Date(y, m - 1, d + n))
}

/** 새 거래의 기본 날짜: ?date= 우선, 아니면 ?m= 달의 같은 일자(말일 보정), 아니면 오늘 */
export function defaultDate(dateParam: string | null, monthParam: string | null, today: DateKey = todayKey()): DateKey {
  if (dateParam && isDateKey(dateParam)) return dateParam
  if (monthParam && isMonthKey(monthParam) && monthParam !== today.slice(0, 7)) return dateInMonth(monthParam, Number(today.slice(8, 10)))
  return today
}
