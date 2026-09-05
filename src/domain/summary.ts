import { effectiveAmount, UNCATEGORIZED_ID, type Category, type Transaction } from '../db/types'
import { lastNMonths, prevMonth, type MonthKey } from './dates'

export interface CategoryShare {
  categoryId: string
  /** 해당 월 합계(환불 차감). 음수 가능 */
  amount: number
  /** 상위 합계 대비 비율 0~1. 상위 합계가 0 이하이면 0 */
  pct: number
  /** 전월 합계 */
  prevAmount: number
  /** amount - prevAmount */
  delta: number
  /** 전월 대비 증감률. 전월이 0이면 null */
  deltaPct: number | null
  txCount: number
  children: CategoryShare[]
}

export interface MonthTotals {
  income: number
  expense: number
  net: number
}

export interface MonthlySummary extends MonthTotals {
  month: MonthKey
  /** net / income. income이 0이면 null */
  savingsRate: number | null
  /** 지출 대분류별(소분류는 children) — 금액 내림차순 */
  byCategory: CategoryShare[]
  /** 수입 대분류별 */
  incomeByCategory: CategoryShare[]
  prev: MonthTotals | null
  txCount: number
}

export interface TrendPoint extends MonthTotals {
  month: MonthKey
  cumulativeNet: number
}

/** 이체는 수입/지출 어느 쪽에도 포함하지 않는다. */
export function monthTotals(txs: Iterable<Transaction>): MonthTotals & { txCount: number } {
  let income = 0
  let expense = 0
  let txCount = 0
  for (const tx of txs) {
    txCount++
    if (tx.type === 'income') income += effectiveAmount(tx)
    else if (tx.type === 'expense') expense += effectiveAmount(tx)
  }
  return { income, expense, net: income - expense, txCount }
}

interface Bucket {
  amount: number
  count: number
  children: Map<string, { amount: number; count: number }>
}

/** 대분류 id를 구한다. 소분류면 부모, 미분류/알 수 없는 id면 UNCATEGORIZED */
function topLevelOf(categoryId: string | null, byId: Map<string, Category>): { top: string; sub: string } {
  if (!categoryId) return { top: UNCATEGORIZED_ID, sub: UNCATEGORIZED_ID }
  const c = byId.get(categoryId)
  if (!c) return { top: UNCATEGORIZED_ID, sub: UNCATEGORIZED_ID }
  if (c.parentId && byId.has(c.parentId)) return { top: c.parentId, sub: c.id }
  return { top: c.id, sub: c.id }
}

function bucketize(txs: Iterable<Transaction>, type: 'expense' | 'income', byId: Map<string, Category>): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>()
  for (const tx of txs) {
    if (tx.type !== type) continue
    const { top, sub } = topLevelOf(tx.categoryId, byId)
    let b = buckets.get(top)
    if (!b) {
      b = { amount: 0, count: 0, children: new Map() }
      buckets.set(top, b)
    }
    const v = effectiveAmount(tx)
    b.amount += v
    b.count++
    const ch = b.children.get(sub) ?? { amount: 0, count: 0 }
    ch.amount += v
    ch.count++
    b.children.set(sub, ch)
  }
  return buckets
}

function positiveChildTotal(b: Bucket): number {
  let s = 0
  for (const ch of b.children.values()) s += Math.max(0, ch.amount)
  return s
}

function toShares(cur: Map<string, Bucket>, prev: Map<string, Bucket>): CategoryShare[] {
  // 비율의 분모는 양수 합계만 사용: 환불로 음수가 된 카테고리가 다른 카테고리를 100% 넘게 보이게 하지 않는다
  const total = [...cur.values()].reduce((s, b) => s + Math.max(0, b.amount), 0)
  const ids = new Set<string>([...cur.keys()])
  const shares: CategoryShare[] = []
  for (const id of ids) {
    const b = cur.get(id)!
    const p = prev.get(id)
    const prevAmount = p?.amount ?? 0
    const children: CategoryShare[] = []
    for (const [subId, ch] of b.children) {
      const pch = p?.children.get(subId)
      const pa = pch?.amount ?? 0
      children.push({
        categoryId: subId,
        amount: ch.amount,
        pct: positiveChildTotal(b) > 0 ? Math.max(0, ch.amount) / positiveChildTotal(b) : 0,
        prevAmount: pa,
        delta: ch.amount - pa,
        deltaPct: pa !== 0 ? (ch.amount - pa) / Math.abs(pa) : null,
        txCount: ch.count,
        children: [],
      })
    }
    children.sort((x, y) => y.amount - x.amount)
    shares.push({
      categoryId: id,
      amount: b.amount,
      pct: total > 0 ? Math.max(0, b.amount) / total : 0,
      prevAmount,
      delta: b.amount - prevAmount,
      deltaPct: prevAmount !== 0 ? (b.amount - prevAmount) / Math.abs(prevAmount) : null,
      txCount: b.count,
      children,
    })
  }
  shares.sort((x, y) => y.amount - x.amount)
  return shares
}

/**
 * 한 달 요약. txs는 해당 월 거래, prevTxs는 전월 거래(없으면 전월 비교 생략).
 * - 이체는 제외
 * - 환불은 차감
 * - 소분류는 대분류로 롤업, 비율은 대분류 합계 기준
 */
export function summarizeMonth(
  month: MonthKey,
  txs: Transaction[],
  categories: Category[],
  prevTxs: Transaction[] | null = null,
): MonthlySummary {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const cur = txs.filter((t) => t.month === month)
  const pm = prevMonth(month)
  const prev = prevTxs ? prevTxs.filter((t) => t.month === pm) : []
  const totals = monthTotals(cur)
  const prevTotals = prevTxs ? monthTotals(prev) : null

  const byCategory = toShares(bucketize(cur, 'expense', byId), bucketize(prev, 'expense', byId))
  const incomeByCategory = toShares(bucketize(cur, 'income', byId), bucketize(prev, 'income', byId))

  return {
    month,
    income: totals.income,
    expense: totals.expense,
    net: totals.net,
    savingsRate: totals.income > 0 ? totals.net / totals.income : null,
    byCategory,
    incomeByCategory,
    prev: prevTotals ? { income: prevTotals.income, expense: prevTotals.expense, net: prevTotals.net } : null,
    txCount: totals.txCount,
  }
}

/** endMonth 포함 최근 n개월 추세 (오름차순). 거래가 없는 달도 0으로 채운다. */
export function monthlyTrend(endMonth: MonthKey, n: number, txs: Iterable<Transaction>): TrendPoint[] {
  const months = lastNMonths(endMonth, n)
  const idx = new Map(months.map((m, i) => [m, i]))
  const acc = months.map((m) => ({ month: m, income: 0, expense: 0, net: 0, cumulativeNet: 0 }))
  for (const tx of txs) {
    const i = idx.get(tx.month)
    if (i === undefined) continue
    if (tx.type === 'income') acc[i].income += effectiveAmount(tx)
    else if (tx.type === 'expense') acc[i].expense += effectiveAmount(tx)
  }
  let cum = 0
  for (const p of acc) {
    p.net = p.income - p.expense
    cum += p.net
    p.cumulativeNet = cum
  }
  return acc
}

/** 여러 달 평균(거래가 없는 달 포함) */
export function averageTotals(points: TrendPoint[]): MonthTotals {
  if (points.length === 0) return { income: 0, expense: 0, net: 0 }
  const income = Math.round(points.reduce((s, p) => s + p.income, 0) / points.length)
  const expense = Math.round(points.reduce((s, p) => s + p.expense, 0) / points.length)
  return { income, expense, net: income - expense }
}
