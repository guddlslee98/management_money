import { effectiveAmount, type Account, type Transaction } from '../db/types'

/**
 * 계좌별 현재 잔액 = 초기잔액 + 수입 − 지출 − 이체출금 + 이체입금.
 * 카드 계좌는 사용액만큼 음수가 되며, 카드대금 납부는 은행→카드 이체로 기록하면 0으로 돌아온다.
 */
export function accountBalances(accounts: Account[], txs: Iterable<Transaction>): Map<string, number> {
  const bal = new Map<string, number>()
  for (const a of accounts) bal.set(a.id, a.initialBalance)
  const add = (id: string | null, v: number) => {
    if (!id || !bal.has(id)) return
    bal.set(id, bal.get(id)! + v)
  }
  for (const tx of txs) {
    if (tx.type === 'income') add(tx.accountId, effectiveAmount(tx))
    else if (tx.type === 'expense') add(tx.accountId, -effectiveAmount(tx))
    else if (tx.type === 'transfer') {
      add(tx.accountId, -tx.amount)
      add(tx.toAccountId, tx.amount)
    }
  }
  return bal
}

/** 순자산: 보관 처리되지 않은 계좌 잔액 합 */
export function netWorth(accounts: Account[], balances: Map<string, number>): number {
  let s = 0
  for (const a of accounts) if (!a.isArchived) s += balances.get(a.id) ?? 0
  return s
}
