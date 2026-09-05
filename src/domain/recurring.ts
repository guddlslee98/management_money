import { newId, type RecurringRule, type Transaction } from '../db/types'
import { addMonths, compareMonth, dateInMonth, toMonthKey, type DateKey, type MonthKey } from './dates'

export interface Occurrence {
  month: MonthKey
  date: DateKey
}

/**
 * 규칙에 따라 생성해야 할 발생분.
 * - startMonth..min(endMonth, today의 달) 범위
 * - 발생일이 today 이후면 아직 생성하지 않는다(미래 지출을 미리 잡지 않음)
 * - 이미 생성된 달(existingMonths)은 건너뛴다
 */
export function dueOccurrences(rule: RecurringRule, today: DateKey, existingMonths: Iterable<MonthKey>): Occurrence[] {
  if (!rule.isActive) return []
  const done = new Set(existingMonths)
  const thisMonth = toMonthKey(today)
  const last = rule.endMonth && compareMonth(rule.endMonth, thisMonth) < 0 ? rule.endMonth : thisMonth
  const out: Occurrence[] = []
  for (let m = rule.startMonth; compareMonth(m, last) <= 0; m = addMonths(m, 1)) {
    if (done.has(m)) continue
    const date = dateInMonth(m, rule.dayOfMonth)
    if (date > today) continue
    out.push({ month: m, date })
    if (out.length > 240) break // 안전장치: 20년치
  }
  return out
}

export function buildRecurringTransaction(rule: RecurringRule, occ: Occurrence, now: number): Transaction {
  return {
    id: newId(),
    type: rule.type,
    date: occ.date,
    month: occ.month,
    amount: rule.amount,
    categoryId: rule.type === 'transfer' ? null : rule.categoryId,
    accountId: rule.accountId,
    toAccountId: rule.type === 'transfer' ? rule.toAccountId : null,
    payee: rule.payee,
    memo: rule.memo,
    isRefund: false,
    source: 'recurring',
    importHash: null,
    recurringRuleId: rule.id,
    recurringMonth: occ.month,
    createdAt: now,
    updatedAt: now,
  }
}

/** 다음 발생 예정일 (today 이후 첫 발생). 없으면 null */
export function nextOccurrence(rule: RecurringRule, today: DateKey): DateKey | null {
  if (!rule.isActive) return null
  let m = toMonthKey(today)
  if (compareMonth(m, rule.startMonth) < 0) m = rule.startMonth
  for (let i = 0; i < 24; i++) {
    if (rule.endMonth && compareMonth(m, rule.endMonth) > 0) return null
    const d = dateInMonth(m, rule.dayOfMonth)
    if (d > today) return d
    m = addMonths(m, 1)
  }
  return null
}
