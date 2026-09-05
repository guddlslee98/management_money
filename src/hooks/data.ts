import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { accountRepo, budgetRepo, categoryRepo, recurringRepo, ruleRepo, settingsRepo, txRepo } from '../db/repo'
import type { Account, Category, Transaction } from '../db/types'
import type { MonthKey } from '../domain/dates'

const EMPTY: never[] = []

export function useCategories(): Category[] {
  return useLiveQuery(() => categoryRepo.all(), [], EMPTY as Category[])
}

export function useCategoryMap(): Map<string, Category> {
  const cats = useCategories()
  return useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])
}

export function useAccounts(): Account[] {
  return useLiveQuery(() => accountRepo.all(), [], EMPTY as Account[])
}

export function useAccountMap(): Map<string, Account> {
  const accs = useAccounts()
  return useMemo(() => new Map(accs.map((a) => [a.id, a])), [accs])
}

/** undefined = 로딩 중 */
export function useMonthTransactions(month: MonthKey): Transaction[] | undefined {
  return useLiveQuery(() => txRepo.byMonth(month), [month])
}

export function useTransactionsInMonths(months: MonthKey[]): Transaction[] | undefined {
  const key = months.join(',')
  return useLiveQuery(() => txRepo.byMonths(key ? key.split(',') : []), [key])
}

export function useTransaction(id: string | undefined): Transaction | undefined | null {
  return useLiveQuery(async () => (id ? (await txRepo.get(id)) ?? null : null), [id])
}

export function useBudgets() {
  return useLiveQuery(() => budgetRepo.all(), [], EMPTY)
}

export function useRecurringRules() {
  return useLiveQuery(() => recurringRepo.all(), [], EMPTY)
}

export function useClassifyRules() {
  return useLiveQuery(() => ruleRepo.all(), [], EMPTY)
}

export function useSetting<T>(key: string, fallback: T): T {
  return useLiveQuery(() => settingsRepo.get<T>(key, fallback), [key], fallback)
}

export function useTransactionCount(): number {
  return useLiveQuery(() => txRepo.count(), [], 0)
}

/** 전체 거래 (계좌 잔액·순자산 계산용). undefined = 로딩 중 */
export function useAllTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => txRepo.all(), [])
}

/** 최근 사용 거래처 (자동완성용) */
export function useRecentPayees(limit = 30): string[] {
  return useLiveQuery(() => txRepo.recentPayees(limit), [limit], EMPTY as string[])
}
