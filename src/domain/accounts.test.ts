import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../db/types'
import { accountBalances, netWorth } from './accounts'

const acc = (id: string, initialBalance = 0, type: Account['type'] = 'bank'): Account => ({
  id, name: id, type, initialBalance, color: '#000', sortOrder: 0, isArchived: false,
})
let n = 0
const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction => ({
  id: `t${++n}`, date: '2026-09-01', month: '2026-09', categoryId: null, accountId: null, toAccountId: null,
  payee: '', memo: '', isRefund: false, source: 'manual', importHash: null, recurringRuleId: null,
    recurringMonth: null, createdAt: 0, updatedAt: 0, ...p,
})

describe('accountBalances', () => {
  it('applies income, expense, refunds and transfers', () => {
    const accounts = [acc('bank', 1_000_000), acc('card', 0, 'card'), acc('cash', 50_000, 'cash')]
    const b = accountBalances(accounts, [
      tx({ type: 'income', amount: 3_000_000, accountId: 'bank' }),
      tx({ type: 'expense', amount: 120_000, accountId: 'card' }),
      tx({ type: 'expense', amount: 20_000, accountId: 'card', isRefund: true }),
      tx({ type: 'expense', amount: 10_000, accountId: 'cash' }),
      tx({ type: 'transfer', amount: 100_000, accountId: 'bank', toAccountId: 'card' }),
      tx({ type: 'expense', amount: 999, accountId: 'unknown' }),
      tx({ type: 'expense', amount: 999, accountId: null }),
    ])
    expect(b.get('bank')).toBe(3_900_000)
    expect(b.get('card')).toBe(0)
    expect(b.get('cash')).toBe(40_000)
    expect(netWorth(accounts, b)).toBe(3_940_000)
  })

  it('excludes archived accounts from net worth', () => {
    const accounts = [acc('a', 100), { ...acc('b', 200), isArchived: true }]
    expect(netWorth(accounts, accountBalances(accounts, []))).toBe(100)
  })
})
