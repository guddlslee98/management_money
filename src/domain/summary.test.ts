import { describe, expect, it } from 'vitest'
import { UNCATEGORIZED_ID, type Category, type Transaction } from '../db/types'
import { averageTotals, monthlyTrend, monthTotals, summarizeMonth } from './summary'

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'food.delivery', kind: 'expense', name: '배달', emoji: '🛵', color: '#f97316', parentId: 'food', sortOrder: 1, isArchived: false },
  { id: 'housing', kind: 'expense', name: '주거', emoji: '🏠', color: '#3b82f6', parentId: null, sortOrder: 1, isArchived: false },
  { id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
]

let seq = 0
function tx(p: Partial<Transaction> & Pick<Transaction, 'type' | 'date' | 'amount'>): Transaction {
  seq++
  return {
    id: `t${seq}`,
    month: p.date.slice(0, 7),
    categoryId: null,
    accountId: null,
    toAccountId: null,
    payee: '',
    memo: '',
    isRefund: false,
    source: 'manual',
    importHash: null,
    recurringRuleId: null,
    recurringMonth: null,
    createdAt: 0,
    updatedAt: 0,
    ...p,
  }
}

describe('monthTotals', () => {
  it('excludes transfers and subtracts refunds', () => {
    const t = monthTotals([
      tx({ type: 'income', date: '2026-09-01', amount: 3_000_000 }),
      tx({ type: 'expense', date: '2026-09-02', amount: 500_000 }),
      tx({ type: 'expense', date: '2026-09-03', amount: 50_000, isRefund: true }),
      tx({ type: 'transfer', date: '2026-09-04', amount: 1_000_000 }),
      tx({ type: 'income', date: '2026-09-05', amount: 100_000, isRefund: true }),
    ])
    expect(t.income).toBe(2_900_000)
    expect(t.expense).toBe(450_000)
    expect(t.net).toBe(2_450_000)
    expect(t.txCount).toBe(5)
  })

  it('handles empty input', () => {
    expect(monthTotals([])).toEqual({ income: 0, expense: 0, net: 0, txCount: 0 })
  })
})

describe('summarizeMonth', () => {
  const sep = [
    tx({ type: 'income', date: '2026-09-25', amount: 3_000_000, categoryId: 'salary' }),
    tx({ type: 'expense', date: '2026-09-01', amount: 600_000, categoryId: 'housing' }),
    tx({ type: 'expense', date: '2026-09-02', amount: 120_000, categoryId: 'food.cafe' }),
    tx({ type: 'expense', date: '2026-09-03', amount: 180_000, categoryId: 'food.delivery' }),
    tx({ type: 'expense', date: '2026-09-04', amount: 100_000, categoryId: null }),
    tx({ type: 'transfer', date: '2026-09-05', amount: 2_000_000 }),
    // 다른 달 거래는 무시되어야 함
    tx({ type: 'expense', date: '2026-10-01', amount: 999_999, categoryId: 'housing' }),
  ]
  const aug = [
    tx({ type: 'income', date: '2026-08-25', amount: 3_000_000, categoryId: 'salary' }),
    tx({ type: 'expense', date: '2026-08-01', amount: 600_000, categoryId: 'housing' }),
    tx({ type: 'expense', date: '2026-08-02', amount: 200_000, categoryId: 'food.cafe' }),
  ]

  it('rolls sub-categories up to top-level and computes shares', () => {
    const s = summarizeMonth('2026-09', sep, cats, aug)
    expect(s.income).toBe(3_000_000)
    expect(s.expense).toBe(1_000_000)
    expect(s.net).toBe(2_000_000)
    expect(s.savingsRate).toBeCloseTo(2 / 3)
    expect(s.txCount).toBe(6)

    expect(s.byCategory.map((c) => c.categoryId)).toEqual(['housing', 'food', UNCATEGORIZED_ID])
    const food = s.byCategory[1]
    expect(food.amount).toBe(300_000)
    expect(food.pct).toBeCloseTo(0.3)
    expect(food.txCount).toBe(2)
    expect(food.children.map((c) => c.categoryId)).toEqual(['food.delivery', 'food.cafe'])
    expect(food.children[1].pct).toBeCloseTo(0.4) // 120k / 300k
    expect(food.prevAmount).toBe(200_000)
    expect(food.delta).toBe(100_000)
    expect(food.deltaPct).toBeCloseTo(0.5)

    const housing = s.byCategory[0]
    expect(housing.pct).toBeCloseTo(0.6)
    expect(housing.delta).toBe(0)
    expect(housing.deltaPct).toBe(0)

    const unc = s.byCategory[2]
    expect(unc.pct).toBeCloseTo(0.1)
    expect(unc.prevAmount).toBe(0)
    expect(unc.deltaPct).toBeNull()

    expect(s.prev).toEqual({ income: 3_000_000, expense: 800_000, net: 2_200_000 })
    expect(s.incomeByCategory[0]).toMatchObject({ categoryId: 'salary', amount: 3_000_000, pct: 1 })
  })

  it('treats unknown category ids as uncategorized', () => {
    const s = summarizeMonth('2026-09', [tx({ type: 'expense', date: '2026-09-01', amount: 10, categoryId: 'ghost' })], cats)
    expect(s.byCategory[0].categoryId).toBe(UNCATEGORIZED_ID)
  })

  it('handles a month with zero expense without dividing by zero', () => {
    const s = summarizeMonth('2026-09', [tx({ type: 'income', date: '2026-09-01', amount: 100 })], cats)
    expect(s.expense).toBe(0)
    expect(s.byCategory).toEqual([])
    expect(s.savingsRate).toBe(1)
    const s2 = summarizeMonth('2026-09', [], cats)
    expect(s2.savingsRate).toBeNull()
    expect(s2.prev).toBeNull()
  })

  it('keeps negative category totals when refunds exceed spend, with pct 0 base guard', () => {
    const s = summarizeMonth(
      '2026-09',
      [
        tx({ type: 'expense', date: '2026-09-01', amount: 30_000, categoryId: 'food' }),
        tx({ type: 'expense', date: '2026-09-02', amount: 50_000, categoryId: 'food', isRefund: true }),
        tx({ type: 'expense', date: '2026-09-03', amount: 20_000, categoryId: 'housing' }),
      ],
      cats,
    )
    expect(s.expense).toBe(0)
    const food = s.byCategory.find((c) => c.categoryId === 'food')!
    expect(food.amount).toBe(-20_000)
    expect(food.pct).toBe(0)
    expect(s.byCategory[0].categoryId).toBe('housing')
    // 분모는 양수 합계(20,000)만 → 주거 100%, 다른 카테고리가 100%를 넘지 않는다
    expect(s.byCategory[0].pct).toBe(1)
  })
})

describe('monthlyTrend', () => {
  it('fills missing months with zeros and accumulates net', () => {
    const t = monthlyTrend('2026-09', 3, [
      tx({ type: 'income', date: '2026-07-10', amount: 100 }),
      tx({ type: 'expense', date: '2026-07-11', amount: 30 }),
      tx({ type: 'expense', date: '2026-09-01', amount: 50 }),
      tx({ type: 'transfer', date: '2026-09-01', amount: 999 }),
      tx({ type: 'expense', date: '2025-09-01', amount: 999 }),
    ])
    expect(t.map((p) => p.month)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(t[0]).toMatchObject({ income: 100, expense: 30, net: 70, cumulativeNet: 70 })
    expect(t[1]).toMatchObject({ income: 0, expense: 0, net: 0, cumulativeNet: 70 })
    expect(t[2]).toMatchObject({ income: 0, expense: 50, net: -50, cumulativeNet: 20 })
    expect(averageTotals(t)).toEqual({ income: 33, expense: 27, net: 6 })
  })

  it('crosses year boundaries', () => {
    const t = monthlyTrend('2026-02', 4, [])
    expect(t.map((p) => p.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})
