import { ValidationError } from '../../db/repo'
import type { Account, Category, CategoryKind, RecurringRule, TxType } from '../../db/types'
import { isMonthKey, type MonthKey } from '../../domain/dates'
import { parseAmountInput } from '../../lib/amountInput'

export interface CategoryGroup {
  parent: Category
  children: Category[]
}

/** 카테고리 선택용: 종류가 맞고 보관되지 않은 대분류와 그 소분류 (정렬 순서대로) */
export function groupCategories(categories: Category[], kind: CategoryKind): CategoryGroup[] {
  const bySort = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko')
  const live = categories.filter((c) => c.kind === kind && !c.isArchived)
  return live
    .filter((c) => c.parentId === null)
    .sort(bySort)
    .map((parent) => ({ parent, children: live.filter((c) => c.parentId === parent.id).sort(bySort) }))
}

/** 이체는 카테고리가 없으므로 지출/수입만 카테고리 종류로 변환 */
export function kindOfType(type: TxType): CategoryKind | null {
  return type === 'transfer' ? null : type
}

export const TYPE_LABEL: Record<TxType, string> = { expense: '지출', income: '수입', transfer: '이체' }
export const TYPE_TEXT_CLASS: Record<TxType, string> = { expense: 'text-expense', income: 'text-income', transfer: 'text-transfer' }

/** "매월 25일" */
export function describeDay(dayOfMonth: number): string {
  return `매월 ${dayOfMonth}일`
}

/** 폼 상태 (문자열 위주, 저장 시 변환) */
export interface RuleForm {
  type: TxType
  amount: string
  categoryId: string
  accountId: string
  toAccountId: string
  payee: string
  memo: string
  dayOfMonth: string
  startMonth: string
  endMonth: string
  isActive: boolean
}

export type RuleInput = Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'>

export function emptyRuleForm(currentMonth: MonthKey): RuleForm {
  return { type: 'expense', amount: '', categoryId: '', accountId: '', toAccountId: '', payee: '', memo: '', dayOfMonth: '1', startMonth: currentMonth, endMonth: '', isActive: true }
}

export function ruleToForm(rule: RecurringRule): RuleForm {
  return {
    type: rule.type,
    amount: rule.amount ? String(rule.amount) : '',
    categoryId: rule.categoryId ?? '',
    accountId: rule.accountId ?? '',
    toAccountId: rule.toAccountId ?? '',
    payee: rule.payee,
    memo: rule.memo,
    dayOfMonth: String(rule.dayOfMonth),
    startMonth: rule.startMonth,
    endMonth: rule.endMonth ?? '',
    isActive: rule.isActive,
  }
}

/** 폼 → 저장소 입력. 화면에서 바로 보여줄 수 있도록 ValidationError로 실패한다 */
export function formToRuleInput(f: RuleForm): RuleInput {
  const amount = parseAmountInput(f.amount)
  if (amount === null || amount <= 0) throw new ValidationError('금액을 입력하세요')
  const dayOfMonth = Number(f.dayOfMonth)
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) throw new ValidationError('반복일은 1~31 사이여야 합니다')
  if (!isMonthKey(f.startMonth)) throw new ValidationError('시작 월을 입력하세요')
  const endMonth = f.endMonth.trim()
  if (endMonth && !isMonthKey(endMonth)) throw new ValidationError('종료 월 형식이 올바르지 않습니다')
  if (endMonth && endMonth < f.startMonth) throw new ValidationError('종료 월은 시작 월 이후여야 합니다')
  if (f.type === 'transfer') {
    if (!f.accountId || !f.toAccountId) throw new ValidationError('이체는 출금 계좌와 입금 계좌가 모두 필요합니다')
    if (f.accountId === f.toAccountId) throw new ValidationError('출금 계좌와 입금 계좌가 같을 수 없습니다')
  }
  return {
    type: f.type,
    amount,
    categoryId: f.type === 'transfer' ? null : f.categoryId || null,
    accountId: f.accountId || null,
    toAccountId: f.type === 'transfer' ? f.toAccountId || null : null,
    payee: f.payee.trim(),
    memo: f.memo.trim(),
    dayOfMonth,
    startMonth: f.startMonth,
    endMonth: endMonth || null,
    isActive: f.isActive,
  }
}

/** 계좌 이름 (없거나 삭제된 계좌면 대체 문구) */
export function accountName(accounts: Map<string, Account>, id: string | null, fallback = '계좌 없음'): string {
  return id ? (accounts.get(id)?.name ?? fallback) : fallback
}
