import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../db/types'
import { addDays, defaultDate, displayAmount, filterTransactions, groupByDate } from './txView'

let seq = 0
function tx(p: Partial<Transaction>): Transaction {
  seq++
  return {
    id: `t${seq}`,
    type: 'expense',
    date: '2026-09-05',
    month: '2026-09',
    amount: 1000,
    categoryId: null,
    accountId: null,
    toAccountId: null,
    payee: '',
    memo: '',
    isRefund: false,
    source: 'manual',
    importHash: null,
    recurringRuleId: null,
    createdAt: seq,
    updatedAt: seq,
    ...p,
  }
}

describe('groupByDate', () => {
  it('groups consecutive dates in input order and sums expenses net of refunds', () => {
    const rows = [
      tx({ date: '2026-09-05', amount: 5000 }),
      tx({ date: '2026-09-05', amount: 2000, isRefund: true }),
      tx({ date: '2026-09-05', type: 'income', amount: 100000 }),
      tx({ date: '2026-09-05', type: 'transfer', amount: 7000 }),
      tx({ date: '2026-09-03', amount: 1500 }),
    ]
    const g = groupByDate(rows)
    expect(g.map((x) => x.date)).toEqual(['2026-09-05', '2026-09-03'])
    expect(g[0].items.length).toBe(4)
    expect(g[0].expenseTotal).toBe(3000)
    expect(g[1].expenseTotal).toBe(1500)
  })

  it('returns empty for no rows', () => {
    expect(groupByDate([])).toEqual([])
  })
})

describe('filterTransactions', () => {
  const rows = [tx({ payee: '스타벅스', memo: '' }), tx({ type: 'income', payee: '회사', memo: '9월 급여' }), tx({ type: 'transfer', payee: '카드대금' })]
  it('returns the same array when nothing is filtered', () => {
    expect(filterTransactions(rows, 'all', '  ')).toBe(rows)
  })
  it('filters by type', () => {
    expect(filterTransactions(rows, 'transfer', '').map((t) => t.payee)).toEqual(['카드대금'])
  })
  it('searches payee and memo case-insensitively', () => {
    expect(filterTransactions(rows, 'all', '급여').map((t) => t.payee)).toEqual(['회사'])
    expect(filterTransactions(rows, 'all', '스타').map((t) => t.payee)).toEqual(['스타벅스'])
    expect(filterTransactions(rows, 'expense', '급여')).toEqual([])
  })
})

describe('displayAmount', () => {
  it('signs by type and flips on refund', () => {
    expect(displayAmount({ type: 'expense', amount: 1000, isRefund: false })).toBe(-1000)
    expect(displayAmount({ type: 'expense', amount: 1000, isRefund: true })).toBe(1000)
    expect(displayAmount({ type: 'income', amount: 1000, isRefund: false })).toBe(1000)
    expect(displayAmount({ type: 'income', amount: 1000, isRefund: true })).toBe(-1000)
    expect(displayAmount({ type: 'transfer', amount: 1000, isRefund: false })).toBe(1000)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-09-05', 1)).toBe('2026-09-06')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })
})

describe('defaultDate', () => {
  const today = '2026-09-05'
  it('prefers a valid ?date', () => {
    expect(defaultDate('2026-08-20', '2026-07', today)).toBe('2026-08-20')
    expect(defaultDate('2026-13-99', null, today)).toBe(today)
  })
  it('uses the same day in ?m when it is another month (clamped to month end)', () => {
    expect(defaultDate(null, '2026-07', today)).toBe('2026-07-05')
    expect(defaultDate(null, '2026-02', '2026-09-30')).toBe('2026-02-28')
    expect(defaultDate(null, '2026-09', today)).toBe(today)
  })
  it('falls back to today', () => {
    expect(defaultDate(null, null, today)).toBe(today)
    expect(defaultDate(null, 'nope', today)).toBe(today)
  })
})
