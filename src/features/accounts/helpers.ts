import { ValidationError } from '../../db/repo'
import type { Account, AccountType, Transaction } from '../../db/types'
import { parseAmountInput } from '../../lib/amountInput'

export const ACCOUNT_TYPES: Array<{ value: AccountType; label: string; emoji: string }> = [
  { value: 'cash', label: '현금', emoji: '💵' },
  { value: 'bank', label: '은행', emoji: '🏦' },
  { value: 'card', label: '카드', emoji: '💳' },
  { value: 'savings', label: '저축', emoji: '🐷' },
  { value: 'investment', label: '투자', emoji: '📈' },
  { value: 'other', label: '기타', emoji: '📦' },
]

export function accountTypeEmoji(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.emoji ?? '📦'
}

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? '기타'
}

/** 계좌 색상 팔레트 (12색) */
export const ACCOUNT_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#16a34a', '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#7c3aed', '#6b7280']

/** 계좌에 영향을 준 거래(출금·입금·이체 양쪽)를 최근순으로 limit개. txs는 이미 날짜 내림차순 */
export function recentForAccount(txs: Transaction[], accountId: string, limit = 10): Transaction[] {
  const out: Transaction[] = []
  for (const t of txs) {
    if (t.accountId === accountId || t.toAccountId === accountId) {
      out.push(t)
      if (out.length >= limit) break
    }
  }
  return out
}

/** 해당 계좌 입장에서 본 거래 금액: 입금(+) / 출금(−). 환불은 방향이 뒤집힌다 */
export function amountForAccount(tx: Transaction, accountId: string): number {
  const v = tx.isRefund ? -tx.amount : tx.amount
  if (tx.type === 'income') return v
  if (tx.type === 'expense') return -v
  if (tx.toAccountId === accountId && tx.accountId === accountId) return 0
  return tx.toAccountId === accountId ? tx.amount : -tx.amount
}

export interface AccountForm {
  name: string
  type: AccountType
  initialBalance: string
  color: string
}

export function emptyAccountForm(): AccountForm {
  return { name: '', type: 'bank', initialBalance: '', color: ACCOUNT_COLORS[0] }
}

export function accountToForm(a: Account): AccountForm {
  return { name: a.name, type: a.type, initialBalance: a.initialBalance ? String(a.initialBalance) : '', color: a.color }
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'initialBalance' | 'color'>

/** 폼 → 저장소 입력. 초기 잔액은 비어 있으면 0, 음수 허용(카드 미결제 잔액 등) */
export function formToAccountInput(f: AccountForm): AccountInput {
  const name = f.name.trim()
  if (!name) throw new ValidationError('계좌 이름을 입력하세요')
  const initialBalance = f.initialBalance.trim() ? parseAmountInput(f.initialBalance, true) : 0
  if (initialBalance === null) throw new ValidationError('초기 잔액은 정수여야 합니다')
  return { name, type: f.type, initialBalance, color: f.color || ACCOUNT_COLORS[0] }
}
