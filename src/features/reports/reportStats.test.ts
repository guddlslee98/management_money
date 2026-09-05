import { describe, expect, it } from 'vitest'
import type { Category, Transaction } from '../../db/types'
import { categoryTrend, periodLength, savingsRateOf, sumTotals } from './reportStats'

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'housing', kind: 'expense', name: '주거', emoji: '🏠', color: '#3b82f6', parentId: null, sortOrder: 1, isArchived: false },
]

let seq = 0
function tx(p: Partial<Transaction> & Pick<Transaction, 'type' | 'date' | 'amount'>): Transaction {
  seq++
  return { id: `t${seq}`, month: p.date.slice(0, 7), categoryId: null, accountId: null, toAccountId: null, payee: '', memo: '', isRefund: false, source: 'manual', importHash: null, recurringRuleId: null, createdAt: 0, updatedAt: 0, ...p }
}

describe('periodLength', () => {
  it('maps period options to month counts', () => {
    expect(periodLength('6', '2026-09')).toBe(6)
    expect(periodLength('12', '2026-09')).toBe(12)
    expect(periodLength('ytd', '2026-09')).toBe(9)
    expect(periodLength('ytd', '2026-01')).toBe(1)
  })
})

describe('sumTotals / savingsRateOf', () => {
  it('sums the period and derives the savings rate', () => {
    const total = sumTotals([
      { month: '2026-08', income: 100, expense: 30, net: 70, cumulativeNet: 70 },
      { month: '2026-09', income: 200, expense: 120, net: 80, cumulativeNet: 150 },
    ])
    expect(total).toEqual({ income: 300, expense: 150, net: 150 })
    expect(savingsRateOf(total)).toBeCloseTo(0.5)
    expect(sumTotals([])).toEqual({ income: 0, expense: 0, net: 0 })
    expect(savingsRateOf({ income: 0, expense: 10, net: -10 })).toBeNull()
  })
})

describe('categoryTrend', () => {
  it('rolls sub-categories up per month, fills empty months with 0 and averages', () => {
    const { points, average } = categoryTrend(
      ['2026-07', '2026-08', '2026-09'],
      [
        tx({ type: 'expense', date: '2026-07-03', amount: 30_000, categoryId: 'food' }),
        tx({ type: 'expense', date: '2026-07-04', amount: 20_000, categoryId: 'food.cafe' }),
        tx({ type: 'expense', date: '2026-09-04', amount: 10_000, categoryId: 'food.cafe' }),
        tx({ type: 'expense', date: '2026-09-05', amount: 4_000, categoryId: 'food.cafe', isRefund: true }),
        tx({ type: 'expense', date: '2026-09-06', amount: 999_999, categoryId: 'housing' }),
        tx({ type: 'transfer', date: '2026-08-06', amount: 999_999 }),
      ],
      cats,
      'food',
    )
    expect(points).toEqual([
      { month: '2026-07', value: 50_000 },
      { month: '2026-08', value: 0 },
      { month: '2026-09', value: 6_000 },
    ])
    expect(average).toBe(Math.round(56_000 / 3))
    expect(categoryTrend([], [], cats, 'food')).toEqual({ points: [], average: 0 })
  })
})
