import type { Category, Transaction } from '../../db/types'
import type { MonthKey } from '../../domain/dates'
import { summarizeMonth, type MonthTotals, type TrendPoint } from '../../domain/summary'

export type Period = '6' | '12' | 'ytd'

/** 기간 옵션 → 개월 수. 올해는 1월부터 기준 월까지 */
export function periodLength(period: Period, endMonth: MonthKey): number {
  if (period === 'ytd') return Number(endMonth.slice(5, 7))
  return Number(period)
}

/** 기간 합계 (표의 합계 행) */
export function sumTotals(points: TrendPoint[]): MonthTotals {
  const income = points.reduce((s, p) => s + p.income, 0)
  const expense = points.reduce((s, p) => s + p.expense, 0)
  return { income, expense, net: income - expense }
}

/** 저축률 = net / income. 수입이 0이면 null */
export function savingsRateOf(t: MonthTotals): number | null {
  return t.income > 0 ? t.net / t.income : null
}

export interface CategoryTrendPoint {
  month: MonthKey
  value: number
}

/** 특정 대분류의 월별 지출 합계(소분류 롤업은 summarizeMonth가 처리)와 월 평균 */
export function categoryTrend(months: MonthKey[], txs: Transaction[], categories: Category[], categoryId: string): { points: CategoryTrendPoint[]; average: number } {
  const byMonth = new Map<MonthKey, Transaction[]>()
  for (const tx of txs) {
    const list = byMonth.get(tx.month)
    if (list) list.push(tx)
    else byMonth.set(tx.month, [tx])
  }
  const points = months.map((month) => {
    const share = summarizeMonth(month, byMonth.get(month) ?? [], categories).byCategory.find((c) => c.categoryId === categoryId)
    return { month, value: share?.amount ?? 0 }
  })
  const average = points.length > 0 ? Math.round(points.reduce((s, p) => s + p.value, 0) / points.length) : 0
  return { points, average }
}
