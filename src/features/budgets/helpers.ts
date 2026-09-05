import type { Budget, Category } from '../../db/types'
import { BUDGET_DEFAULT_MONTH, type BudgetUsage } from '../../domain/budget'
import type { MonthKey } from '../../domain/dates'
import { formatNumber } from '../../domain/money'
import type { CategoryShare } from '../../domain/summary'

/** 예산 편집 범위: 기본(매월) 예산 또는 이번 달 전용 예산 */
export type BudgetScope = 'default' | 'month'

/** n을 step 단위로 올림. 0 이하이면 0 */
export function roundUpTo(n: number, step = 10_000): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  if (!Number.isFinite(step) || step <= 0) return Math.ceil(n)
  return Math.ceil(n / step) * step
}

/**
 * 금액 입력 문자열을 정수로 파싱. 숫자가 없으면 null.
 * "300,000" → 300000, "" → null, allowNegative면 "-5,000" → -5000
 */
export function parseAmountInput(input: string, allowNegative = false): number | null {
  const s = input.trim()
  const negative = allowNegative && s.startsWith('-')
  const digits = s.replace(/\D/g, '').slice(0, 15)
  if (!digits) return null
  const n = Number(digits)
  return negative ? -n : n
}

/** 입력 중인 문자열을 천단위 구분자가 있는 형태로 정리. "3000a00" → "300,000" */
export function formatAmountInput(input: string, allowNegative = false): string {
  const n = parseAmountInput(input, allowNegative)
  if (n === null) return allowNegative && input.trim().startsWith('-') ? '-' : ''
  return formatNumber(n)
}

/** 저장된 금액을 입력 칸 문자열로. 0/null이면 빈 문자열(예산 없음) */
export function amountToInput(amount: number | null | undefined): string {
  return amount && amount !== 0 ? formatNumber(amount) : ''
}

/** 예산 화면에 나열할 지출 대분류: 보관되지 않은 것만, 정렬 순서대로 */
export function expenseParents(categories: Category[]): Category[] {
  return categories.filter((c) => c.kind === 'expense' && c.parentId === null && !c.isArchived).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'))
}

export interface BudgetRowModel {
  category: Category
  /** 이번 달 지출(환불 차감). 예산이 없어도 표시 */
  spent: number
  /** 기본(매월) 예산. 없으면 0 */
  defaultAmount: number
  /** 이번 달 전용 예산. 없으면 0 */
  monthAmount: number
  hasOverride: boolean
  /** 적용 예산 기준 사용량. 예산이 없으면 null */
  usage: BudgetUsage | null
}

/** 화면 행 모델: 카테고리별 지출·기본/월 예산·사용량을 한 번에 묶는다 (계산은 도메인 함수 결과를 조회만 함) */
export function budgetRows(categories: Category[], budgets: Budget[], month: MonthKey, usages: BudgetUsage[], shares: CategoryShare[]): BudgetRowModel[] {
  const spentBy = new Map(shares.map((s) => [s.categoryId, s.amount]))
  const usageBy = new Map(usages.map((u) => [u.categoryId, u]))
  return expenseParents(categories).map((category) => {
    const def = budgets.find((b) => b.categoryId === category.id && b.month === BUDGET_DEFAULT_MONTH)
    const ov = budgets.find((b) => b.categoryId === category.id && b.month === month)
    return {
      category,
      spent: spentBy.get(category.id) ?? 0,
      defaultAmount: def?.amount ?? 0,
      monthAmount: ov?.amount ?? 0,
      hasOverride: Boolean(ov && ov.amount > 0),
      usage: usageBy.get(category.id) ?? null,
    }
  })
}

/**
 * "지난달 지출을 예산으로 채우기": 기본(*) 예산이 없는 지출 대분류에 대해
 * 지난달 지출을 step 단위로 올림한 금액을 제안한다. 지출이 0 이하인 카테고리는 제외.
 */
export function fillFromPrevious(categories: Category[], budgets: Budget[], prevShares: CategoryShare[], step = 10_000): Array<{ categoryId: string; amount: number }> {
  const hasDefault = new Set(budgets.filter((b) => b.month === BUDGET_DEFAULT_MONTH && b.amount > 0).map((b) => b.categoryId))
  const prevBy = new Map(prevShares.map((s) => [s.categoryId, s.amount]))
  const out: Array<{ categoryId: string; amount: number }> = []
  for (const c of expenseParents(categories)) {
    if (hasDefault.has(c.id)) continue
    const amount = roundUpTo(prevBy.get(c.id) ?? 0, step)
    if (amount > 0) out.push({ categoryId: c.id, amount })
  }
  return out
}

/** 진행 막대 색: 정상은 카테고리 색, 경고/초과는 테마 토큰 */
export function barColor(status: BudgetUsage['status'] | null, categoryColor: string): string {
  if (status === 'over') return 'var(--expense)'
  if (status === 'warn') return 'var(--warn)'
  return categoryColor || 'var(--accent)'
}
