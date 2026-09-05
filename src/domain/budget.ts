import type { Budget } from '../db/types'
import type { MonthKey } from './dates'
import type { CategoryShare } from './summary'

export const BUDGET_DEFAULT_MONTH = '*'

export type BudgetStatus = 'ok' | 'warn' | 'over'

export interface BudgetUsage {
  categoryId: string
  budget: number
  spent: number
  remaining: number
  /** spent / budget. budget 0이면 0 */
  ratio: number
  status: BudgetStatus
}

/** 특정 월 예산: 월 지정 예산이 있으면 그것, 없으면 기본(*) 예산 */
export function budgetFor(budgets: Budget[], categoryId: string, month: MonthKey): Budget | null {
  let fallback: Budget | null = null
  for (const b of budgets) {
    if (b.categoryId !== categoryId) continue
    if (b.month === month) return b
    if (b.month === BUDGET_DEFAULT_MONTH) fallback = b
  }
  return fallback
}

export function statusFor(ratio: number, warnAt = 0.8): BudgetStatus {
  if (ratio >= 1) return 'over'
  if (ratio >= warnAt) return 'warn'
  return 'ok'
}

/** 예산이 설정된 대분류만, 예산 초과 비율 내림차순 */
export function budgetUsage(budgets: Budget[], month: MonthKey, shares: CategoryShare[], warnAt = 0.8): BudgetUsage[] {
  const spentBy = new Map(shares.map((s) => [s.categoryId, s.amount]))
  const categoryIds = [...new Set(budgets.map((b) => b.categoryId))]
  const out: BudgetUsage[] = []
  for (const categoryId of categoryIds) {
    const b = budgetFor(budgets, categoryId, month)
    if (!b || b.amount <= 0) continue
    const spent = Math.max(0, spentBy.get(categoryId) ?? 0)
    const ratio = spent / b.amount
    out.push({ categoryId, budget: b.amount, spent, remaining: b.amount - spent, ratio, status: statusFor(ratio, warnAt) })
  }
  out.sort((a, b) => b.ratio - a.ratio)
  return out
}

export function totalBudget(usages: BudgetUsage[]): { budget: number; spent: number; ratio: number } {
  const budget = usages.reduce((s, u) => s + u.budget, 0)
  const spent = usages.reduce((s, u) => s + u.spent, 0)
  return { budget, spent, ratio: budget > 0 ? spent / budget : 0 }
}
